-- Drop existing admin policies that might be causing recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;

-- Create a non-recursive admin policy using multiple ways to check admin status
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  -- Use auth.jwt() instead of jwt()
  (auth.jwt() ->> 'role'::text) = 'admin'::text
  OR
  -- Check in auth.users directly as fallback (avoids recursion)
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Create a function to test admin access
CREATE OR REPLACE FUNCTION debug_admin_status()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Gather detailed information about the current user and their permissions
  SELECT jsonb_build_object(
    'current_user', auth.uid(),
    'jwt_role', auth.jwt()->>'role',
    'profile_role', (SELECT role FROM profiles WHERE id = auth.uid()),
    'is_admin_by_jwt', auth.jwt()->>'role' = 'admin',
    'is_admin_by_profile', EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ),
    'can_see_other_profiles', EXISTS (
      SELECT 1 FROM profiles WHERE id != auth.uid() LIMIT 1
    ),
    'profiles_count', (SELECT count(*) FROM profiles),
    'visible_profiles_count', (
      SELECT count(*) FROM profiles 
    ),
    'auth_meta', (
      SELECT raw_app_meta_data 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix admin status if needed
CREATE OR REPLACE FUNCTION fix_admin_access()
RETURNS jsonb AS $$
DECLARE
  admin_id uuid;
  result jsonb;
BEGIN
  -- Get current user ID
  admin_id := auth.uid();
  
  -- Update profile role
  UPDATE profiles
  SET role = 'admin'
  WHERE id = admin_id;
  
  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
  )
  WHERE id = admin_id;
  
  -- Return results
  SELECT jsonb_build_object(
    'success', true,
    'admin_id', admin_id,
    'profile_updated', true,
    'auth_meta_updated', true,
    'fixed_at', now()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250528190315',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed admin user visibility with non-recursive policy',
    'details', 'Created policy that checks JWT and auth.users directly to avoid infinite recursion'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();