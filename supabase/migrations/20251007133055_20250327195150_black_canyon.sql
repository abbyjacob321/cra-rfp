/*
  # Fix user profile creation

  1. Changes
    - Ensure email column exists in profiles table
    - Make sure existing users have email set
    - Update RLS policies to allow profile creation during signup
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

-- Drop existing insert policy if it exists (to recreate it)
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Create more permissive insert policy
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

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