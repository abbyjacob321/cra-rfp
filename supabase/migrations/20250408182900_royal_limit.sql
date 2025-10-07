/*
  # Fix Admin Access Policies

  1. Changes
    - Drop and recreate admin policies with improved logic
    - Add additional indexes for performance
    - Ensure admins can view all profiles without recursion
    - Fix role-based access checks
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create a more permissive admin policy that avoids recursion
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Check JWT claims first
  (auth.jwt()->>'role' = 'admin')
  OR
  -- Fallback to database check
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  email = auth.jwt()->>'email'
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- Update existing admin users' JWT claims
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE id IN (
  SELECT id FROM profiles WHERE role = 'admin'
);