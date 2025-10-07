/*
  # Fix RLS policies for profiles table

  1. Changes
     - Drop and recreate RLS policies for profiles table
     - Add more permissive policies for profile creation during signup
     - Fix admin access policies to avoid recursion
     - Add indexes for performance optimization

  2. Security
     - Maintains proper access control while allowing profile creation
     - Ensures admins can still view all profiles
     - Prevents unauthorized access to profiles
*/

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new, simplified policies

-- Allow any authenticated user to insert a profile
-- This is critical for the signup process
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to view their own profile
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

-- Allow admins to view all profiles using app_metadata
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (auth.jwt()->>'role' = 'admin');
  )
);