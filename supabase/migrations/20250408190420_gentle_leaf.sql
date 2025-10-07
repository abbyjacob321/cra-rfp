/*
  # Enhanced debugging functions for admin access

  1. Changes
    - Add enhanced debug function with more detailed checks
    - Add function to sync admin status across all locations
    - Add function to list all admin users
*/

-- Enhanced debug function with more checks
CREATE OR REPLACE FUNCTION debug_admin_access_enhanced(check_user_id uuid)
RETURNS TABLE (
  check_name text,
  result boolean,
  details jsonb
) AS $$
DECLARE
  user_email text;
BEGIN
  -- Get user email for cross-referencing
  SELECT email INTO user_email FROM auth.users WHERE id = check_user_id;

  -- Check JWT claims with more detail
  RETURN QUERY
  SELECT 
    'jwt_check'::text,
    (auth.jwt() ->> 'role') = 'admin',
    jsonb_build_object(
      'jwt_role', auth.jwt() ->> 'role',
      'jwt_user_id', auth.jwt() ->> 'sub',
      'jwt_email', auth.jwt() ->> 'email',
      'all_claims', auth.jwt()
    );
    
  -- Check auth.users metadata with more detail
  RETURN QUERY
  SELECT 
    'metadata_check'::text,
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = check_user_id
      AND raw_app_meta_data ->> 'role' = 'admin'
    ),
    jsonb_build_object(
      'user_id', id,
      'email', email,
      'raw_meta_data', raw_app_meta_data,
      'raw_user_meta_data', raw_user_meta_data
    ) FROM auth.users WHERE id = check_user_id;
    
  -- Check profiles table with more detail
  RETURN QUERY
  SELECT 
    'profile_check'::text,
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = check_user_id
      AND role = 'admin'
    ),
    jsonb_build_object(
      'profile_exists', EXISTS (SELECT 1 FROM profiles WHERE id = check_user_id),
      'profile_data', (SELECT to_jsonb(profiles.*) FROM profiles WHERE id = check_user_id),
      'email_match', EXISTS (SELECT 1 FROM profiles WHERE email = user_email)
    );

  -- Check policy evaluation
  RETURN QUERY
  SELECT 
    'policy_check'::text,
    EXISTS (
      SELECT 1 FROM profiles
      WHERE role = 'admin'
      AND (
        id = check_user_id
        OR email = user_email
      )
    ),
    jsonb_build_object(
      'can_view_all', EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_app_meta_data ->> 'role' = 'admin'
      ),
      'current_user', auth.uid(),
      'target_user', check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync admin status across all locations
CREATE OR REPLACE FUNCTION sync_admin_status(admin_email text)
RETURNS jsonb AS $$
DECLARE
  user_id uuid;
  result jsonb;
BEGIN
  -- Get user ID
  SELECT id INTO user_id FROM auth.users WHERE email = admin_email;
  
  IF user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'email', admin_email
    );
  END IF;

  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  WHERE id = user_id;
  
  -- Update profile
  UPDATE profiles
  SET role = 'admin'
  WHERE id = user_id OR email = admin_email;
  
  -- Get verification results
  SELECT jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'email', admin_email,
    'auth_metadata', (SELECT raw_app_meta_data FROM auth.users WHERE id = user_id),
    'profile_role', (SELECT role FROM profiles WHERE id = user_id),
    'synced_at', now()
  ) INTO result;
  
  -- Log sync operation
  INSERT INTO analytics_events (
    event_type,
    user_id,
    metadata
  ) VALUES (
    'admin_sync',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list all admin users
CREATE OR REPLACE FUNCTION list_admin_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  jwt_admin boolean,
  metadata_admin boolean,
  profile_admin boolean,
  details jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    (auth.jwt() ->> 'role') = 'admin' AND auth.jwt() ->> 'sub' = u.id::text,
    (u.raw_app_meta_data ->> 'role') = 'admin',
    p.role = 'admin',
    jsonb_build_object(
      'auth_metadata', u.raw_app_meta_data,
      'profile_data', to_jsonb(p.*)
    )
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE 
    (u.raw_app_meta_data ->> 'role') = 'admin'
    OR p.role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.debug.20250408191532',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added enhanced debugging functions',
    'changes', 'Added enhanced debug functions and admin sync capabilities'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();