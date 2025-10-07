-- Modify rfp_nda_access table to support countersignatures
ALTER TABLE rfp_nda_access 
ADD COLUMN IF NOT EXISTS countersigned_at timestamptz,
ADD COLUMN IF NOT EXISTS countersigned_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS countersigner_name text,
ADD COLUMN IF NOT EXISTS countersigner_title text,
ADD COLUMN IF NOT EXISTS countersignature_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejection_date timestamptz,
ADD COLUMN IF NOT EXISTS rejection_by uuid REFERENCES profiles(id);

-- Function to countersign an NDA
CREATE OR REPLACE FUNCTION countersign_nda(
  p_nda_id uuid,
  p_countersigner_name text,
  p_countersigner_title text,
  p_countersignature_data jsonb
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is authorized to countersign
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'client_reviewer')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins and client reviewers can countersign NDAs'
    );
  END IF;
  
  -- Update NDA record with countersignature
  UPDATE rfp_nda_access
  SET 
    countersigned_at = now(),
    countersigned_by = auth.uid(),
    countersigner_name = p_countersigner_name,
    countersigner_title = p_countersigner_title,
    countersignature_data = p_countersignature_data
  WHERE id = p_nda_id
  RETURNING to_jsonb(rfp_nda_access.*) INTO v_result;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NDA not found or not in signable state'
    );
  END IF;
  
  -- Create audit trail entry
  INSERT INTO nda_audit_trail (
    nda_id,
    action,
    metadata,
    created_by
  ) VALUES (
    p_nda_id,
    'countersigned',
    jsonb_build_object(
      'countersigner_name', p_countersigner_name,
      'countersigner_title', p_countersigner_title,
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::json->>'user-agent',
      'timestamp', now()
    ),
    auth.uid()
  );
  
  -- Create notification for the bidder
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) 
  SELECT 
    user_id,
    'NDA Approved',
    'Your NDA for "' || rfps.title || '" has been approved and countersigned.',
    'nda_approved',
    rfps.id
  FROM rfp_nda_access
  JOIN rfps ON rfp_nda_access.rfp_id = rfps.id
  WHERE rfp_nda_access.id = p_nda_id;
  
  -- Add success info to result
  v_result = v_result || jsonb_build_object(
    'success', true,
    'message', 'NDA successfully countersigned'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject an NDA
CREATE OR REPLACE FUNCTION reject_nda(
  p_nda_id uuid,
  p_rejection_reason text
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is authorized to reject NDAs
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'client_reviewer')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins and client reviewers can reject NDAs'
    );
  END IF;
  
  -- Update NDA record with rejection
  UPDATE rfp_nda_access
  SET 
    rejection_reason = p_rejection_reason,
    rejection_date = now(),
    rejection_by = auth.uid()
  WHERE id = p_nda_id
  RETURNING to_jsonb(rfp_nda_access.*) INTO v_result;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NDA not found or not in rejectable state'
    );
  END IF;
  
  -- Create audit trail entry
  INSERT INTO nda_audit_trail (
    nda_id,
    action,
    metadata,
    created_by
  ) VALUES (
    p_nda_id,
    'rejected',
    jsonb_build_object(
      'rejection_reason', p_rejection_reason,
      'timestamp', now()
    ),
    auth.uid()
  );
  
  -- Create notification for the bidder
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) 
  SELECT 
    user_id,
    'NDA Rejected',
    'Your NDA for "' || rfps.title || '" has been rejected. Reason: ' || p_rejection_reason,
    'nda_rejected',
    rfps.id
  FROM rfp_nda_access
  JOIN rfps ON rfp_nda_access.rfp_id = rfps.id
  WHERE rfp_nda_access.id = p_nda_id;
  
  -- Add success info to result
  v_result = v_result || jsonb_build_object(
    'success', true,
    'message', 'NDA successfully rejected'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get NDA status with detailed signature information
CREATE OR REPLACE FUNCTION get_nda_status(
  p_rfp_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'nda_exists', TRUE,
    'nda_id', id,
    'rfp_id', rfp_id,
    'user_id', user_id,
    'full_name', full_name,
    'company', company,
    'title', title,
    'signed_at', signed_at,
    'countersigned_at', countersigned_at,
    'countersigner_name', countersigner_name,
    'countersigner_title', countersigner_title,
    'has_bidder_signature', (signature_data IS NOT NULL AND signature_data != '{}'::jsonb),
    'has_client_signature', (countersignature_data IS NOT NULL AND countersignature_data != '{}'::jsonb),
    'rejected', (rejection_reason IS NOT NULL),
    'rejection_reason', rejection_reason,
    'rejection_date', rejection_date
  ) INTO v_result
  FROM rfp_nda_access
  WHERE rfp_id = p_rfp_id
  AND user_id = auth.uid();
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'nda_exists', FALSE,
      'rfp_id', p_rfp_id,
      'user_id', auth.uid()
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;