/*
  # Fix infinite recursion in profiles RLS policy
  
  1. Changes
     - Drop the problematic policy that's causing recursion
     - Create a new policy that uses auth.jwt() instead of querying the profiles table
     - This avoids the circular reference that was causing infinite recursion
     
  2. Security
     - Maintains proper access control for admin users
     - Ensures admins can still view all profiles
     - Uses the JWT claim for authorization instead of querying the profiles table
*/

-- First, drop the problematic policy that's causing recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a new policy that achieves the same goal without causing recursion
-- This policy uses the auth.jwt() function to check the role claim
CREATE POLICY "Admins can view all profiles" 
ON profiles
FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin');

-- Add an index to improve performance for role lookups
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250528182945',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed infinite recursion in profiles RLS policy',
    'details', 'Created new admin policy using auth.jwt() instead of recursive profiles query'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();