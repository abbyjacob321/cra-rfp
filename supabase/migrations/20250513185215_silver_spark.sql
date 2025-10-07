/*
  # Add RFP access control for client reviewers
  
  1. Changes
     - Add RLS policies for rfp_access table
     - Add index for rfp_access lookup
     - Add function to assign user access
     - Add function to check access status
*/

-- Ensure RLS is enabled on rfp_access table
ALTER TABLE rfp_access ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for rfp_access
CREATE POLICY "Admins can manage all access records"
  ON rfp_access
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Client reviewers can view their own access records"
  ON rfp_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'client_reviewer'
  ));

-- Add function to grant access to an RFP
CREATE OR REPLACE FUNCTION grant_rfp_access(
  p_rfp_id uuid,
  p_user_id uuid,
  p_status text DEFAULT 'approved'
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_user_role text;
  v_access_id uuid;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can grant RFP access'
    );
  END IF;
  
  -- Check if the target user is a client reviewer
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_user_role != 'client_reviewer' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access can only be granted to client reviewers'
    );
  END IF;
  
  -- Insert or update the access record
  INSERT INTO rfp_access (
    rfp_id,
    user_id,
    status
  )
  VALUES (
    p_rfp_id,
    p_user_id,
    p_status
  )
  ON CONFLICT (rfp_id, user_id) 
  DO UPDATE SET
    status = p_status,
    updated_at = now()
  RETURNING id INTO v_access_id;
  
  -- If the status is approved, create a notification
  IF p_status = 'approved' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id
    )
    VALUES (
      p_user_id,
      'RFP Access Granted',
      'You have been granted access to review ' || (SELECT title FROM rfps WHERE id = p_rfp_id),
      'access_granted',
      p_rfp_id
    );
  ELSIF p_status = 'rejected' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id
    )
    VALUES (
      p_user_id,
      'RFP Access Denied',
      'Your request for access to ' || (SELECT title FROM rfps WHERE id = p_rfp_id) || ' has been denied.',
      'access_denied',
      p_rfp_id
    );
  END IF;
  
  -- Return success result
  v_result = jsonb_build_object(
    'success', true,
    'access_id', v_access_id,
    'rfp_id', p_rfp_id,
    'user_id', p_user_id,
    'status', p_status
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user has access to an RFP
CREATE OR REPLACE FUNCTION check_rfp_access(
  p_rfp_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_rfp_visibility text;
  v_access_status text;
  v_result jsonb;
BEGIN
  -- Use provided user ID or current user ID
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Get user role from profiles
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;
  
  -- Get RFP visibility
  SELECT visibility INTO v_rfp_visibility
  FROM rfps
  WHERE id = p_rfp_id;
  
  -- Admins always have access
  IF v_user_role = 'admin' THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'reason', 'admin',
      'rfp_id', p_rfp_id,
      'visibility', v_rfp_visibility
    );
  END IF;
  
  -- Public RFPs are accessible to everyone
  IF v_rfp_visibility = 'public' THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'reason', 'public',
      'rfp_id', p_rfp_id,
      'visibility', v_rfp_visibility
    );
  END IF;
  
  -- For client reviewers, check access table
  IF v_user_role = 'client_reviewer' THEN
    SELECT status INTO v_access_status
    FROM rfp_access
    WHERE rfp_id = p_rfp_id AND user_id = v_user_id;
    
    IF v_access_status = 'approved' THEN
      RETURN jsonb_build_object(
        'has_access', true,
        'reason', 'approved_access',
        'rfp_id', p_rfp_id,
        'visibility', v_rfp_visibility
      );
    ELSE
      RETURN jsonb_build_object(
        'has_access', false,
        'reason', COALESCE(v_access_status, 'no_access_record'),
        'rfp_id', p_rfp_id,
        'visibility', v_rfp_visibility
      );
    END IF;
  END IF;
  
  -- For bidders, access depends on specific rules
  -- (Implement your specific bidder access rules here)
  
  -- Default to no access
  RETURN jsonb_build_object(
    'has_access', false,
    'reason', 'default_no_access',
    'rfp_id', p_rfp_id,
    'visibility', v_rfp_visibility
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.feature.20250514172305',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added RFP access control',
    'details', 'Added access control functionality for client reviewers'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();