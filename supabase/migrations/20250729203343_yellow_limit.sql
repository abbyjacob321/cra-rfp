/*
  # Add Document Access Approval and Company Registration Approval
  
  1. Changes
    - Add requires_approval field to documents table
    - Add approval status to rfp_interest_registrations
    - Add approval workflow functions
    - Update RLS policies for access control
    
  2. Features
    - Documents can require access approval
    - Company registrations go through approval process
    - Approved companies can see approval-required documents
*/

-- Add requires_approval field to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false;

-- Add approval fields to rfp_interest_registrations table
ALTER TABLE rfp_interest_registrations 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Create index for approval status
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_status_idx 
  ON rfp_interest_registrations(status);

-- Update RLS policy for documents to include approval requirements
DROP POLICY IF EXISTS "Users can access documents with company approval" ON documents;

CREATE POLICY "Users can access documents with company approval"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Document doesn't require approval
  (NOT requires_approval) OR
  -- User's company has approved registration for this RFP
  EXISTS (
    SELECT 1 FROM rfp_interest_registrations rir
    JOIN profiles p ON p.company_id = rir.company_id
    WHERE p.id = auth.uid()
    AND rir.rfp_id = documents.rfp_id
    AND rir.status = 'approved'
  ) OR
  -- User has individual access (for client reviewers)
  EXISTS (
    SELECT 1 FROM rfp_access ra
    WHERE ra.rfp_id = documents.rfp_id
    AND ra.user_id = auth.uid()
    AND ra.status = 'approved'
  ) OR
  -- Admin users have access to everything
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Function to approve company registration
CREATE OR REPLACE FUNCTION approve_company_registration(
  p_registration_id uuid,
  p_approval_notes text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_registration record;
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can approve company registrations'
    );
  END IF;

  -- Get registration details
  SELECT 
    rir.*,
    c.name as company_name,
    r.title as rfp_title
  INTO v_registration
  FROM rfp_interest_registrations rir
  JOIN companies c ON rir.company_id = c.id
  JOIN rfps r ON rir.rfp_id = r.id
  WHERE rir.id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Registration not found'
    );
  END IF;

  -- Update registration status
  UPDATE rfp_interest_registrations
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    notes = COALESCE(p_approval_notes, notes)
  WHERE id = p_registration_id;

  -- Notify all company members
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT 
    p.id,
    'Company Registration Approved',
    'Your company registration for "' || v_registration.rfp_title || '" has been approved. You now have access to protected documents.',
    'registration_approved',
    v_registration.rfp_id
  FROM profiles p
  WHERE p.company_id = v_registration.company_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Company registration approved successfully',
    'company_name', v_registration.company_name,
    'rfp_title', v_registration.rfp_title
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject company registration
CREATE OR REPLACE FUNCTION reject_company_registration(
  p_registration_id uuid,
  p_rejection_reason text
) RETURNS jsonb AS $$
DECLARE
  v_registration record;
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can reject company registrations'
    );
  END IF;

  -- Get registration details
  SELECT 
    rir.*,
    c.name as company_name,
    r.title as rfp_title
  INTO v_registration
  FROM rfp_interest_registrations rir
  JOIN companies c ON rir.company_id = c.id
  JOIN rfps r ON rir.rfp_id = r.id
  WHERE rir.id = p_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Registration not found'
    );
  END IF;

  -- Update registration status
  UPDATE rfp_interest_registrations
  SET 
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = p_rejection_reason
  WHERE id = p_registration_id;

  -- Notify the user who registered
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) VALUES (
    v_registration.user_id,
    'Company Registration Rejected',
    'Your company registration for "' || v_registration.rfp_title || '" has been rejected. Reason: ' || p_rejection_reason,
    'registration_rejected',
    v_registration.rfp_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Company registration rejected',
    'company_name', v_registration.company_name,
    'rfp_title', v_registration.rfp_title
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check document access with approval requirements
CREATE OR REPLACE FUNCTION check_document_access_with_approval(
  p_document_id uuid
) RETURNS jsonb AS $$
DECLARE
  doc record;
  v_has_access boolean := false;
  v_access_reason text;
BEGIN
  -- Get document details
  SELECT * INTO doc FROM documents WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'reason', 'Document not found'
    );
  END IF;

  -- Admin users always have access
  IF EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    v_has_access := true;
    v_access_reason := 'Admin access';
  -- Check if document requires approval
  ELSIF doc.requires_approval THEN
    -- Check company registration approval
    IF EXISTS (
      SELECT 1 FROM rfp_interest_registrations rir
      JOIN profiles p ON p.company_id = rir.company_id
      WHERE p.id = auth.uid()
      AND rir.rfp_id = doc.rfp_id
      AND rir.status = 'approved'
    ) THEN
      v_has_access := true;
      v_access_reason := 'Approved company registration';
    -- Check individual access approval
    ELSIF EXISTS (
      SELECT 1 FROM rfp_access ra
      WHERE ra.rfp_id = doc.rfp_id
      AND ra.user_id = auth.uid()
      AND ra.status = 'approved'
    ) THEN
      v_has_access := true;
      v_access_reason := 'Individual access approval';
    ELSE
      v_has_access := false;
      v_access_reason := 'Requires approval - not granted';
    END IF;
  ELSE
    -- Document doesn't require approval
    v_has_access := true;
    v_access_reason := 'No approval required';
  END IF;

  RETURN jsonb_build_object(
    'has_access', v_has_access,
    'reason', v_access_reason,
    'requires_approval', doc.requires_approval,
    'requires_nda', doc.requires_nda
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.access_approval.20250131140000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added document access approval and company registration approval system',
    'details', 'Documents can now require access approval, company registrations go through approval workflow'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();