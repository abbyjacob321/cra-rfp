/*
  # Fix RLS policies for profiles table

  1. Changes
     - Remove any policies that could cause recursion
     - Apply straightforward policies for profiles table
     - Fix potential permission issues for profile creation during signup

  2. Security
     - Ensures proper access control while avoiding recursive policy checks
     - Makes profile creation more reliable during the signup process
*/

-- Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new, simplified policies that won't cause recursion

-- Allow any authenticated user to insert their own profile
-- This is critical for the signup process
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to see their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow admins to see all profiles using JWT data instead of recursive checks
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.jwt()
    WHERE auth.jwt()->>'role' = 'admin'
  )
);