/*
  # Fix Signup Timeout Issue

  1. Security
     - Refines RLS policies for profile creation to ensure proper permissions without recursion
     - Creates indexes on critical columns to improve database performance
     - Ensures email column is properly configured with unique constraints

  This migration consolidates previous attempts to fix signup timeout issues 
  and provides a more comprehensive solution.
*/

-- Add indexes if they don't exist
DO $$ 
BEGIN
  -- Check if index on id exists (it should already as it's a primary key)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'profiles_pkey'
  ) THEN
    ALTER TABLE profiles ADD PRIMARY KEY (id);
  END IF;

  -- Check if index on email exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'profiles_email_idx'
  ) THEN
    CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
  END IF;

  -- Make sure email has unique constraint if it doesn't already
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_email_unique'
  ) THEN
    -- Only add the constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_constraint 
      WHERE conrelid = 'profiles'::regclass 
      AND contype = 'u' 
      AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'profiles'::regclass AND attname = 'email')
      ]
    ) THEN
      ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
    END IF;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to recreate them with improved logic
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Create policy for profile insertion during signup
-- This is intentionally simple to minimize potential issues
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

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

-- Allow admins to view all profiles using JWT data instead of recursive checks
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.jwt() jwt
    WHERE (jwt->>'role') = 'admin'
  )
);