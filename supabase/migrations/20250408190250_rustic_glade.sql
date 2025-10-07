/*
  # Add debugging functions for admin access

  1. Changes
    - Add debug_admin_access function to check admin status
    - Add verify_admin_status function to fix admin status
    - Add migration log entry
*/

-- Create debug function to check admin status
CREATE OR REPLACE FUNCTION debug_admin_access(check_user_id uuid)
RETURNS TABLE (
  check_name text,
  result boolean,
  details jsonb
) AS $$
BEGIN
  -- Check JWT claims
  RETURN QUERY
  SELECT 
    'jwt_check'::text,
    (auth.jwt() ->> 'role') = 'admin',
    jsonb_build_object(
      'jwt_role', auth.jwt() ->> 'role',
      'jwt_user_id', auth.jwt() ->> 'sub'
    );
    
  -- Check auth.users metadata
  RETURN QUERY
  SELECT 
    'metadata_check'::text,
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = check_user_id
      AND raw_app_meta_data ->> 'role' = 'admin'
    ),
    (SELECT raw_app_meta_data FROM auth.users WHERE id = check_user_id);
    
  -- Check profiles table
  RETURN QUERY
  SELECT 
    'profile_check'::text,
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = check_user_id
      AND role = 'admin'
    ),
    (SELECT to_jsonb(profiles.*) FROM profiles WHERE id = check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and fix admin status
CREATE OR REPLACE FUNCTION verify_admin_status(admin_email text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  WHERE email = admin_email
  AND (
    raw_app_meta_data ->> 'role' IS NULL
    OR raw_app_meta_data ->> 'role' != 'admin'
  );
  
  -- Get verification results
  SELECT jsonb_build_object(
    'email', admin_email,
    'auth_metadata', (SELECT raw_app_meta_data FROM auth.users WHERE email = admin_email),
    'profile_role', (SELECT role FROM profiles WHERE email = admin_email),
    'verified_at', now()
  ) INTO result;
  
  -- Log verification
  INSERT INTO analytics_events (
    event_type,
    user_id,
    metadata
  ) VALUES (
    'admin_verification',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.apply.20250408190532',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added debug functions for admin access',
    'changes', 'Added debug_admin_access and verify_admin_status functions'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();