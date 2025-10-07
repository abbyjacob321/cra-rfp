/*
  # Fix RLS Policy Recursion

  1. Changes
     - Remove debugging grants that were added for troubleshooting
     - Fix the "Admins can view all profiles" policy to prevent infinite recursion
     - Make the insert policy more secure by ensuring email matches JWT

  2. Security
     - Ensures the insert policy validates that the email matches the JWT claim
     - Maintains proper RLS protection for profile data
     - Fixes the infinite recursion issue in the admin policy
*/

-- Revoke debugging permissions that are no longer needed
REVOKE SELECT ON auth.users FROM authenticated;
REVOKE SELECT ON pg_catalog.pg_constraint FROM authenticated;

-- Drop and recreate the admin view policy to fix the infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a new admin policy that doesn't cause recursion
-- By separating the admin check and the self-view check into two policies
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Drop and recreate the insert policy to be more secure
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Create a more secure insert policy that ensures email matches JWT
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id 
  AND email = auth.jwt()->>('email')
);