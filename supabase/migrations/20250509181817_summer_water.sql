/*
  # Fix infinite recursion in RLS policies

  1. Changes
    - Drop all policies on profiles table to start fresh
    - Create new non-recursive policies
    - Use direct JWT checks instead of querying profiles table recursively
    - Add performance improvements for admin role checks
  
  2. Security
    - Maintain secure access control
    - Allow proper profile creation and user management
    - Prevent unauthorized access to profiles
*/

-- Drop all existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies that don't cause recursion
-- 1. Self-access policy - users can view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Self-update policy - users can update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 3. Self-insert policy - users can create their own profile
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. Admin policy - uses JWT claims directly to avoid recursion
-- This leverages the app_metadata in the JWT token instead of querying the profiles table
CREATE POLICY "Admin full access"
ON profiles
FOR ALL
TO authenticated
USING (
  -- Check JWT claims directly
  auth.jwt()->>'role' = 'admin'
  OR
  -- Check auth.users meta data directly
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);
CREATE INDEX IF NOT EXISTS profiles_id_lookup_idx ON profiles USING hash (id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250509183712',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed infinite recursion in RLS policies',
    'details', 'Created new non-recursive policies using JWT claims'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();