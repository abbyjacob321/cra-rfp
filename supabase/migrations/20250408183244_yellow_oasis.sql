/*
  # Fix infinite recursion in profiles policies

  1. Changes
    - Drop existing problematic policies on profiles table
    - Create new simplified policies that avoid recursion
    - Maintain core functionality while preventing infinite loops

  2. Security
    - Maintain RLS enabled on profiles table
    - Recreate essential policies with proper checks
    - Ensure admin access is preserved
    - Allow users to view and manage their own profiles
*/

-- Drop existing policies to clean up
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create new simplified policies
CREATE POLICY "Enable read access for users to their own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Enable insert for authenticated users only"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY "Enable update for users based on id"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

-- Admin policies that avoid recursion
CREATE POLICY "Admin full access"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);