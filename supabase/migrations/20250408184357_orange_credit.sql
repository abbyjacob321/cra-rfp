/*
  # Fix Admin Policies for User Management
  
  1. Changes
    - Simplify admin policies to ensure all users are visible
    - Remove potentially conflicting policies
    - Add explicit admin read access
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users to their own profile" ON profiles;

-- Create simplified admin policy
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.raw_app_meta_data->>'role' = 'admin'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  )
);

-- Create user self-view policy
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- Ensure admin role is properly set in both places
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE id IN (
  SELECT id FROM profiles WHERE role = 'admin'
);