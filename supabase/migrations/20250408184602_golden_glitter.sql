/*
  # Fix Policy Conflicts and Restore Stable State
  
  1. Changes
    - Drop all existing policies to avoid conflicts
    - Recreate necessary policies with consistent naming
    - Maintain admin access functionality
    - Ensure proper user self-access
*/

-- First, drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users to their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Now recreate the policies with consistent naming
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

-- Create admin policy using JWT to avoid recursion
CREATE POLICY "Admin full access"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Ensure admin role is properly set in auth.users
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE id IN (
  SELECT id FROM profiles WHERE role = 'admin'
);

-- Log the migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250408184542',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed policy conflicts and restored stable state',
    'changes', 'Recreated policies with consistent naming and proper admin access'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();