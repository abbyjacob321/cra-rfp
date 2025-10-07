/*
  # Fix admin authentication issues
  
  1. Changes
    - Fix user metadata to ensure consistent admin role
    - Update policies to check both locations for admin role
    - Add function to properly set admin status
*/

-- Function to properly set admin status
CREATE OR REPLACE FUNCTION set_admin_status(admin_email text)
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
  SET 
    raw_app_meta_data = jsonb_build_object(
      'role', 'admin',
      'provider', COALESCE(raw_app_meta_data->>'provider', 'email'),
      'providers', COALESCE(raw_app_meta_data->'providers', '["email"]'::jsonb)
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', 'admin',
      'email', email,
      'sub', id::text,
      'email_verified', true,
      'phone_verified', false,
      'first_name', (SELECT first_name FROM profiles WHERE id = user_id),
      'last_name', (SELECT last_name FROM profiles WHERE id = user_id),
      'company', (SELECT company FROM profiles WHERE id = user_id)
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
    'user_metadata', (SELECT raw_user_meta_data FROM auth.users WHERE id = user_id),
    'profile_role', (SELECT role FROM profiles WHERE id = user_id),
    'synced_at', now()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies that check both metadata locations
CREATE POLICY "Admin full access"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.raw_app_meta_data->>'role' = 'admin'
      OR auth.users.raw_user_meta_data->>'role' = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  )
);

-- Basic user policies
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix existing admin users
DO $$
DECLARE
  admin_user RECORD;
BEGIN
  FOR admin_user IN (
    SELECT email FROM profiles WHERE role = 'admin'
  ) LOOP
    PERFORM set_admin_status(admin_user.email);
  END LOOP;
END $$;