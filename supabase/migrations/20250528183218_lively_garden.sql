/*
  # Add diagnostic tools for admin user visibility
  
  1. Changes
     - Add diagnostic functions to check admin status
     - Add function to verify profile visibility
     - Add function to fix admin role issues
     - Log detailed debug information for troubleshooting
*/

-- Create a function to verify admin status and permissions
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
      WHERE id = auth.uid() OR auth.jwt()->>'role' = 'admin'
    ),
    'all_visible_profiles', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'email', email, 'role', role)) 
      FROM profiles 
      LIMIT 10
    ),
    'auth_meta', (
      SELECT raw_app_meta_data 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  ) INTO result;
  
  -- Log this diagnostic run
  INSERT INTO analytics_events (
    event_type,
    user_id,
    metadata
  ) VALUES (
    'admin_diagnostic',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix admin status
CREATE OR REPLACE FUNCTION fix_admin_access(p_admin_email text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  target_email text;
  admin_id uuid;
  result jsonb;
BEGIN
  -- Determine which email to fix - current user or specified
  target_email := COALESCE(
    p_admin_email, 
    (SELECT email FROM profiles WHERE id = auth.uid())
  );
  
  -- Get the user ID
  SELECT id INTO admin_id FROM auth.users WHERE email = target_email;
  
  IF admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found: ' || target_email
    );
  END IF;
  
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
  
  -- Attempt to fix the RLS policies as well
  BEGIN
    -- Drop and recreate the policies that might be causing issues
    DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
    
    -- Create a new policy that doesn't cause recursion
    CREATE POLICY "Admins can view all profiles"
    ON profiles
    FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'role') = 'admin');
    
  EXCEPTION WHEN OTHERS THEN
    -- If we can't modify the policies, just log it
    result := jsonb_build_object(
      'policy_update_failed', true,
      'error', SQLERRM
    );
  END;
  
  -- Return detailed results
  SELECT jsonb_build_object(
    'success', true,
    'admin_email', target_email,
    'admin_id', admin_id,
    'profile_updated', true,
    'auth_meta_updated', true,
    'fixed_at', now(),
    'policy_info', COALESCE(result, '{}'::jsonb)
  ) INTO result;
  
  -- Log this fix operation
  INSERT INTO analytics_events (
    event_type,
    user_id,
    metadata
  ) VALUES (
    'admin_access_fix',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to count users by role
CREATE OR REPLACE FUNCTION count_users_by_role()
RETURNS TABLE (
  role text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.role, COUNT(*) 
  FROM profiles p
  GROUP BY p.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to list all users regardless of RLS
CREATE OR REPLACE FUNCTION list_all_users_for_admin()
RETURNS SETOF profiles AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN QUERY SELECT * FROM profiles;
  ELSE
    RAISE EXCEPTION 'Only administrators can use this function';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;