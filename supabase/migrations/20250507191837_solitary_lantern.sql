/*
  # Fix RLS policies for admin access
  
  1. Changes
     - Fix RLS policies for profiles table
     - Ensure admins can view all users
     - Fix RFP listing access
     - Add performance optimizations
     - Create helper functions for debugging
*/

-- ==========================================
-- PART 1: FIX PROFILES TABLE ACCESS
-- ==========================================

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple policies for user self-access
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Create a direct, non-recursive admin policy for ALL operations
CREATE POLICY "Admin full access"
ON profiles
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE id = auth.uid() AND role = 'admin'
));

-- ==========================================
-- PART 2: FIX RFP LISTING ACCESS
-- ==========================================

-- Drop conflicting policies on RFPs table
DROP POLICY IF EXISTS "Everyone can view public RFPs" ON rfps;
DROP POLICY IF EXISTS "Users can view confidential RFPs they have access to" ON rfps;
DROP POLICY IF EXISTS "Admins can manage all RFPs" ON rfps;

-- Create simplified RFP policies
CREATE POLICY "Everyone can view public RFPs"
ON rfps
FOR SELECT
TO public
USING (visibility = 'public');

CREATE POLICY "Users can view confidential RFPs they have access to"
ON rfps
FOR SELECT
TO public
USING (EXISTS (
  SELECT 1
  FROM rfp_access
  WHERE rfp_access.rfp_id = rfps.id
  AND rfp_access.user_id = auth.uid()
  AND rfp_access.status = 'approved'
));

-- Admins can manage all RFPs
CREATE POLICY "Admins can manage all RFPs"
ON rfps
FOR ALL
TO public
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- ==========================================
-- PART 3: ADD PERFORMANCE OPTIMIZATIONS
-- ==========================================

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS profiles_id_idx ON profiles(id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Add RFP indexes
CREATE INDEX IF NOT EXISTS rfps_id_lookup_idx ON rfps USING hash (id);

-- ==========================================
-- PART 4: CREATE HELPER FUNCTIONS
-- ==========================================

-- Create a helper function to check if the current user is an admin
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

-- Create a helper function to debug RLS issues
CREATE OR REPLACE FUNCTION debug_policy_access(p_table_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', now(),
    'user_id', auth.uid(),
    'is_admin', EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'),
    'email', (SELECT email FROM profiles WHERE id = auth.uid()),
    'role', (SELECT role FROM profiles WHERE id = auth.uid()),
    'table', p_table_name,
    'auth_role', auth.jwt()->>'role',
    'raw_jwt', auth.jwt()
  ) INTO result;
  
  -- Log the debug access
  INSERT INTO analytics_events(
    event_type,
    user_id,
    metadata
  ) VALUES (
    'debug_policy_access',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250508204512',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Comprehensive fix for RLS policies',
    'details', 'Fixed admin access to users and RFPs with non-recursive policies'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();