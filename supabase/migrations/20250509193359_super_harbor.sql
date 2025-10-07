-- Create a function for debugging company and invitation problems
CREATE OR REPLACE FUNCTION debug_company_management(user_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  result jsonb;
BEGIN
  -- If no user_id provided, use the current user
  v_user_id := COALESCE(user_id, auth.uid());
  
  -- Get user's company information
  SELECT jsonb_build_object(
    'timestamp', now(),
    'auth_uid', auth.uid(),
    'user_id', v_user_id,
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = v_user_id),
    'company_info', CASE 
      WHEN EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND company_id IS NOT NULL) THEN
        (SELECT row_to_json(c) FROM companies c 
         WHERE c.id = (SELECT company_id FROM profiles WHERE id = v_user_id))
      ELSE NULL
    END,
    'company_members', (
      SELECT jsonb_agg(row_to_json(p))
      FROM profiles p 
      WHERE p.company_id = (SELECT company_id FROM profiles WHERE id = v_user_id)
    ),
    'company_invitations', (
      SELECT jsonb_agg(row_to_json(ci))
      FROM company_invitations ci
      WHERE ci.company_id = (SELECT company_id FROM profiles WHERE id = v_user_id)
    ),
    'join_requests', (
      SELECT jsonb_agg(row_to_json(jr))
      FROM company_join_requests jr
      WHERE jr.company_id = (SELECT company_id FROM profiles WHERE id = v_user_id)
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the invite_to_company function to ensure it works properly
CREATE OR REPLACE FUNCTION invite_to_company(
  p_company_id uuid,
  p_email text,
  p_role text DEFAULT 'member'
) RETURNS jsonb AS $$
DECLARE
  v_invitation_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_company_name text;
  v_result jsonb;
  v_inviter_name text;
BEGIN
  -- Get inviter's name
  SELECT first_name || ' ' || last_name INTO v_inviter_name
  FROM profiles
  WHERE id = auth.uid();

  -- Check if user is a company admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id = p_company_id 
    AND company_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company admins can invite users'
    );
  END IF;
  
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  -- Generate invitation token
  v_token = encode(gen_random_bytes(24), 'hex');
  v_expires_at = now() + interval '7 days';
  
  -- Create invitation
  INSERT INTO company_invitations (
    company_id,
    email,
    inviter_id,
    role,
    token,
    expires_at
  ) VALUES (
    p_company_id,
    p_email,
    auth.uid(),
    p_role,
    v_token,
    v_expires_at
  ) ON CONFLICT (company_id, email)
  DO UPDATE SET
    role = p_role,
    token = v_token,
    expires_at = v_expires_at,
    status = 'pending'
  RETURNING id INTO v_invitation_id;
  
  -- Create a notification for email
  -- This simulates sending an email for development purposes
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT
    profiles.id,
    'Company Invitation',
    format('You have been invited to join %s by %s', v_company_name, v_inviter_name),
    'company_invitation',
    v_invitation_id
  FROM profiles
  WHERE email = p_email;
  
  -- Return success result
  SELECT jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'company_name', v_company_name,
    'email', p_email,
    'token', v_token,
    'expires_at', v_expires_at,
    'role', p_role,
    'message', format('Invitation sent to %s for %s', p_email, v_company_name)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to fetch company invitations
CREATE OR REPLACE FUNCTION get_company_invitations(
  p_company_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is a company admin for this company
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id = p_company_id 
    AND company_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company admins can view invitations'
    );
  END IF;
  
  -- Get all invitations for this company
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ci.id,
      'email', ci.email,
      'role', ci.role,
      'status', ci.status,
      'created_at', ci.created_at,
      'expires_at', ci.expires_at,
      'inviter', (
        SELECT jsonb_build_object(
          'id', p.id,
          'name', p.first_name || ' ' || p.last_name
        )
        FROM profiles p
        WHERE p.id = ci.inviter_id
      )
    )
  )
  INTO v_result
  FROM company_invitations ci
  WHERE ci.company_id = p_company_id
  AND ci.status != 'expired';
  
  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'invitations', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to register all pending invitations in the system
CREATE OR REPLACE FUNCTION register_all_invitations()
RETURNS jsonb AS $$
DECLARE
  v_total_found int;
  v_total_registered int := 0;
  v_invitation record;
BEGIN
  -- This function is for admins only
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can run this function'
    );
  END IF;
  
  -- Get count of all pending invitations
  SELECT COUNT(*) INTO v_total_found
  FROM company_invitations
  WHERE status = 'pending';
  
  -- Process each invitation to ensure it has a notification
  FOR v_invitation IN (
    SELECT 
      ci.id,
      ci.email,
      ci.company_id,
      c.name as company_name,
      p.first_name || ' ' || p.last_name as inviter_name,
      ci.inviter_id
    FROM company_invitations ci
    JOIN companies c ON ci.company_id = c.id
    JOIN profiles p ON ci.inviter_id = p.id
    WHERE ci.status = 'pending'
  ) LOOP
    -- Check if there's a user with this email
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id
    )
    SELECT 
      profiles.id,
      'Company Invitation',
      format('You have been invited to join %s by %s', v_invitation.company_name, v_invitation.inviter_name),
      'company_invitation',
      v_invitation.id
    FROM profiles
    WHERE email = v_invitation.email
    AND NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE reference_id = v_invitation.id
      AND user_id = profiles.id
    );
    
    v_total_registered := v_total_registered + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_found', v_total_found,
    'total_registered', v_total_registered
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250510170219',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed company invitation function',
    'details', 'Fixed company invitation function to properly handle invitations and added debug tools'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();