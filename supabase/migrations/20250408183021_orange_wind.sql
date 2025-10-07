/*
  # Fix permission denied errors and improve RLS policies
  
  1. Changes
    - Drop and recreate RLS policies with improved logic
    - Grant necessary permissions to authenticated users
    - Ensure admin users have proper access
    - Add additional indexes for performance
*/

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Create a more permissive admin policy
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Check JWT claims first
  (auth.jwt()->>'role' = 'admin')
  OR
  -- Fallback to database check if JWT claim is missing
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.raw_app_meta_data->>'role' = 'admin'
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
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

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR 
  email = auth.jwt()->>'email'
);

-- Allow profile creation during signup
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add necessary indexes
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);

-- Grant necessary permissions to authenticated users
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

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

-- Ensure email column exists and is properly configured
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;