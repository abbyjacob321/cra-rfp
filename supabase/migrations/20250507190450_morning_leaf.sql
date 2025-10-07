/*
  # Fix Admin Access to All Users
  
  1. Changes
    - Update the RLS policies for user management
    - Fix admin access to view all users
    - Simplify admin policy to eliminate ambiguity
    - Ensure all profiles are visible to admin users
  
  2. Security
    - Maintain RLS protection for regular users
    - Ensure admin users have full visibility
    - Fix potential issues with policy evaluation
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a clear, direct policy for admin access
CREATE POLICY "Admin full access"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create an index to optimize the role check
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Add a function to explicitly check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Add grants to ensure the admin user can view all profiles
GRANT SELECT ON profiles TO authenticated;

-- Create a log entry for this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250508135425',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed admin access to all users',
    'details', 'Fixed RLS policies to ensure admins can view all users in User Management'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();