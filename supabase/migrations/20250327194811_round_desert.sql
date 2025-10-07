/*
  # Add email field to profiles table

  1. Changes
    - Add email column to profiles table to enable lookup by email address
    - Add UNIQUE constraint on email column
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
WHERE profiles.id = auth.users.id AND profiles.email IS NULL;

-- Set email field to not nullable for future records
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;