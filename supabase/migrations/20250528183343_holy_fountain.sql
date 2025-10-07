/*
  # Fix admin visibility of all users
  
  1. Changes
     - Drop and recreate all profile policies to completely resolve the recursion issue
     - Create clear, simpler policies that don't cause recursion
     - Use multiple techniques to identify admins
     - Add function to sync admin role across auth and profiles tables
*/

-- Step 1: Drop all existing profile policies to start fresh
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Step 2: Create simple, non-recursive policies

-- Policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Policy for users to insert their own profile
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 3: Create a standalone policy for admins that doesn't cause recursion
-- This policy uses JWT claims directly rather than querying profiles recursively
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR
  (EXISTS ( 
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role') = 'admin'
  ))
);

-- Step 4: Create a function to ensure admin roles are synced between tables
CREATE OR REPLACE FUNCTION sync_admin_role()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if user is admin in profiles table
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id
    AND role = 'admin'
  ) THEN
    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
    WHERE id = v_user_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'synced', true,
      'source', 'profiles',
      'user_id', v_user_id,
      'timestamp', now()
    );
  ELSE
    -- Check if user is admin in auth.users metadata
    IF EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_user_id
      AND raw_app_meta_data->>'role' = 'admin'
    ) THEN
      -- Update profiles table
      UPDATE profiles
      SET role = 'admin'
      WHERE id = v_user_id;
      
      v_result := jsonb_build_object(
        'success', true,
        'synced', true,
        'source', 'auth.users',
        'user_id', v_user_id,
        'timestamp', now()
      );
    ELSE
      v_result := jsonb_build_object(
        'success', false,
        'synced', false,
        'message', 'User is not an admin in either table',
        'user_id', v_user_id,
        'timestamp', now()
      );
    END IF;
  END IF;
  
  -- Log the sync operation
  INSERT INTO analytics_events (
    event_type,
    user_id,
    metadata
  ) VALUES (
    'admin_role_sync',
    v_user_id,
    v_result
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_id_lookup_idx ON profiles USING hash(id);
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250528190142',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed admin user visibility',
    'details', 'Completely rebuilt profile policies to resolve recursion issues'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();