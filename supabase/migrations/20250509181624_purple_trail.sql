/*
  # Fix Admin User Management Visibility
  
  1. Changes
     - Drop and recreate RLS policy for admin access to profiles
     - Add multiple methods for checking admin status
     - Ensure admins can view all profiles
     - Add index for optimized performance
  
  2. Security
     - Maintains proper access control
     - Provides multiple fallback methods for admin verification
     - Keeps user data secure from non-admin users
*/

-- Drop existing admin policy that might be causing issues
DROP POLICY IF EXISTS "Admin full access" ON profiles;

-- Create a more robust admin policy that uses multiple methods to check admin status
CREATE POLICY "Admin full access"
ON profiles
FOR ALL
TO authenticated
USING (
  -- Method 1: Check JWT claim
  (auth.jwt()->>'role' = 'admin')
  OR
  -- Method 2: Check user's meta data
  (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR
  -- Method 3: Check profiles table (fallback)
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_id_lookup_idx ON profiles USING hash (id);

-- Add role-specific index for admin checks
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250509181542',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed Admin Visibility for User Management',
    'details', 'Created more robust RLS policy with multiple admin check methods'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();