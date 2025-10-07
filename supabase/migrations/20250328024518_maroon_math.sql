/*
  # Add indexes to optimize profile insertions

  1. Changes
     - Add index to profiles(id) 
     - Add index to profiles(email)
     - Ensure both columns have proper constraints

  This migration adds indexes to improve performance during profile creation
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

-- Make insert policy more permissive for profile creation
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Create a simpler insert policy without checking email
CREATE POLICY "Users can insert their own profile during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);