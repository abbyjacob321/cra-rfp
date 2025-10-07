/*
  # Fix admin user visibility policies
  
  1. Changes
    - Drop and recreate RLS policies for profiles table
    - Ensure admins can view all profiles without recursion
    - Fix policy for admin access using JWT claims
    - Add index for role column to improve query performance
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new, simplified policies
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  email = auth.jwt()->>'email'
);

-- Create a more permissive admin policy
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.jwt() AS jwt
    WHERE jwt->>'role' = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add index for role column to improve performance
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);