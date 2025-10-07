/*
  # Add company join request functionality
  
  1. Changes
     - Add company join requests table
     - Add functions to request, approve, and reject join requests
     - Add notification hooks for join request workflow
     - Add function to find similar companies by name
*/

-- Create table to track company join requests
CREATE TABLE IF NOT EXISTS company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message text,
  response_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Enable RLS
ALTER TABLE company_join_requests ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS company_join_requests_company_id_idx ON company_join_requests(company_id);
CREATE INDEX IF NOT EXISTS company_join_requests_user_id_idx ON company_join_requests(user_id);
CREATE INDEX IF NOT EXISTS company_join_requests_status_idx ON company_join_requests(status);

-- Add RLS policies
CREATE POLICY "Users can view their own join requests"
ON company_join_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Company admins can view join requests for their company"
ON company_join_requests
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles
    WHERE id = auth.uid() AND company_role = 'admin'
  )
);

CREATE POLICY "Users can create join requests"
ON company_join_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to request to join a company
CREATE OR REPLACE FUNCTION request_to_join_company(
  p_company_id uuid,
  p_message text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_request_id uuid;
  v_company_name text;
  v_result jsonb;
BEGIN
  -- Check if user already belongs to a company
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND company_id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already belong to a company. Please leave your current company first.'
    );
  END IF;
  
  -- Check if request already exists
  IF EXISTS (
    SELECT 1 FROM company_join_requests
    WHERE company_id = p_company_id AND user_id = auth.uid() AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You already have a pending request to join this company.'
    );
  END IF;
  
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  IF v_company_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Company not found.'
    );
  END IF;
  
  -- Create join request
  INSERT INTO company_join_requests (
    company_id,
    user_id,
    message,
    status
  ) VALUES (
    p_company_id,
    auth.uid(),
    p_message,
    'pending'
  ) RETURNING id INTO v_request_id;
  
  -- Send notifications to company admins
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT
    profiles.id,
    'Join Request',
    (SELECT first_name || ' ' || last_name FROM profiles WHERE id = auth.uid()) || 
    ' has requested to join ' || v_company_name,
    'join_request',
    v_request_id
  FROM profiles
  WHERE company_id = p_company_id AND company_role = 'admin';
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'message', 'Your request to join ' || v_company_name || ' has been submitted.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a join request
CREATE OR REPLACE FUNCTION approve_join_request(
  p_request_id uuid,
  p_response_message text DEFAULT NULL,
  p_role text DEFAULT 'member'
) RETURNS jsonb AS $$
DECLARE
  v_request record;
  v_company_name text;
  v_user_name text;
  v_user_email text;
  v_result jsonb;
BEGIN
  -- Check if user is a company admin for this request
  SELECT
    r.*,
    c.name as company_name,
    p.first_name || ' ' || p.last_name as user_name,
    p.email as user_email
  INTO v_request
  FROM company_join_requests r
  JOIN companies c ON r.company_id = c.id
  JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_request_id;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Request not found.'
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = v_request.company_id
    AND company_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company administrators can approve join requests.'
    );
  END IF;
  
  -- Check request status
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This request has already been ' || v_request.status || '.'
    );
  END IF;
  
  -- Update request status
  UPDATE company_join_requests
  SET
    status = 'approved',
    response_message = p_response_message,
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Update user's company association
  UPDATE profiles
  SET
    company_id = v_request.company_id,
    company_role = p_role,
    company = v_request.company_name
  WHERE id = v_request.user_id;
  
  -- Send notification to the user
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) VALUES (
    v_request.user_id,
    'Join Request Approved',
    'Your request to join ' || v_request.company_name || ' has been approved.',
    'join_request_approved',
    p_request_id
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'company_id', v_request.company_id,
    'user_id', v_request.user_id,
    'user_name', v_request.user_name,
    'user_email', v_request.user_email,
    'message', 'Join request approved. ' || v_request.user_name || ' has been added to your company.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a join request
CREATE OR REPLACE FUNCTION reject_join_request(
  p_request_id uuid,
  p_response_message text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_request record;
  v_result jsonb;
BEGIN
  -- Check if user is a company admin for this request
  SELECT
    r.*,
    c.name as company_name,
    p.first_name || ' ' || p.last_name as user_name
  INTO v_request
  FROM company_join_requests r
  JOIN companies c ON r.company_id = c.id
  JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_request_id;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Request not found.'
    );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = v_request.company_id
    AND company_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company administrators can reject join requests.'
    );
  END IF;
  
  -- Check request status
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This request has already been ' || v_request.status || '.'
    );
  END IF;
  
  -- Update request status
  UPDATE company_join_requests
  SET
    status = 'rejected',
    response_message = p_response_message,
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Send notification to the user
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) VALUES (
    v_request.user_id,
    'Join Request Rejected',
    'Your request to join ' || v_request.company_name || ' has been rejected.',
    'join_request_rejected',
    p_request_id
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'company_id', v_request.company_id,
    'user_id', v_request.user_id,
    'message', 'Join request rejected.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search for similar companies by name
CREATE OR REPLACE FUNCTION search_companies(
  p_query text,
  p_limit int DEFAULT 5
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'website', c.website,
      'industry', c.industry,
      'members', m.member_count
    )
  )
  INTO v_result
  FROM companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*) as member_count
    FROM profiles
    WHERE company_id IS NOT NULL
    GROUP BY company_id
  ) m ON c.id = m.company_id
  WHERE 
    c.name ILIKE '%' || p_query || '%'
    OR c.industry ILIKE '%' || p_query || '%'
  ORDER BY 
    CASE 
      WHEN c.name ILIKE p_query || '%' THEN 1
      WHEN c.name ILIKE '%' || p_query || '%' THEN 2
      ELSE 3
    END,
    m.member_count DESC NULLS LAST
  LIMIT p_limit;
  
  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a company
CREATE OR REPLACE FUNCTION leave_company() RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_is_last_admin boolean;
  v_result jsonb;
BEGIN
  -- Get user's current company
  SELECT 
    p.company_id, 
    c.name,
    (SELECT COUNT(*) = 1 FROM profiles 
     WHERE company_id = p.company_id 
     AND company_role = 'admin') AS is_last_admin
  INTO v_company_id, v_company_name, v_is_last_admin
  FROM profiles p
  JOIN companies c ON p.company_id = c.id
  WHERE p.id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You are not currently associated with any company.'
    );
  END IF;
  
  -- Check if user is the last admin
  IF v_is_last_admin AND (
    SELECT company_role FROM profiles WHERE id = auth.uid()
  ) = 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You are the last administrator of this company. Please transfer admin rights to another member or delete the company.'
    );
  END IF;
  
  -- Update user's profile
  UPDATE profiles
  SET
    company_id = NULL,
    company_role = NULL,
    company = NULL
  WHERE id = auth.uid();
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', v_company_name,
    'message', 'You have left ' || v_company_name || '.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;