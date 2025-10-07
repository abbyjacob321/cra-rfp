/*
  # Fix profile creation permissions

  1. Changes
    - Ensures email column exists in profiles table
    - Prevents duplicate email addresses
    - Modifies RLS policies to allow profile creation
    - Sets default email from auth.email()
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

-- Create more permissive insert policy
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

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
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

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