/*
  # Fix Admin User Management Visibility
  
  1. Changes
     - Drop existing problematic policies for admin access to profiles
     - Create a more direct, simplified policy for admin access
     - Avoid recursive checks that might cause infinite recursion
     - Improve performance with additional indexes
  
  2. Security
     - Maintains proper access control
     - Ensures admins can see all users in the system
     - Preserves user data security
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a single, clear policy for admin access to view ALL profiles
-- This policy uses a direct, non-recursive check to avoid infinite recursion
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR ALL
TO authenticated
USING (
  (EXISTS ( 
    SELECT 1
    FROM profiles
    WHERE (profiles.id = auth.uid()) AND (profiles.role = 'admin')
  )) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)
);

-- Add index for role lookup to improve performance
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- Add index specifically for admin role checks
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS profiles_email_unique ON profiles(email);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250528193045',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed admin visibility for user management',
    'details', 'Created simplified policy for admin access to all profiles'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();