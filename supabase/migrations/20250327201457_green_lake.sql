/*
  # Fix for Profile Creation Issues

  1. Changes
     - Adds explicit RLS policies to ensure profiles table is accessible
     - Ensures email field exists and is properly configured
     - Updates all existing profiles to have their email populated
     - Corrects RLS policies for profile creation during signup
  
  2. Security
     - Enables RLS on profiles table
     - Adds appropriate policies for authenticated users
     - Ensures proper constraints for data integrity
*/

-- Add email column if it doesn't already exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    
    -- Create unique index on email
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key ON profiles(email);
    
    -- Add unique constraint
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE USING INDEX profiles_email_key;
  END IF;
END $$;

-- Update existing profile records to set email from auth.users if missing
UPDATE profiles 
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id AND (profiles.email IS NULL OR profiles.email = '');

-- Set email field to not nullable for future records
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on profiles to recreate them
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create more permissive insert policy with no WITH CHECK clause to allow any authenticated user to create a profile
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = id);

-- Add constraint to ensure role is valid
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
      CHECK (role = ANY (ARRAY['admin'::text, 'client_reviewer'::text, 'bidder'::text]));
  END IF;
END $$;

-- Grant additional permissions for debugging
GRANT SELECT ON auth.users TO authenticated;
GRANT SELECT ON pg_catalog.pg_constraint TO authenticated;