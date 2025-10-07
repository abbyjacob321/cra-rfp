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

-- Create a direct, non-recursive admin policy using JWT instead of querying profiles table
-- This is key to preventing infinite recursion
CREATE POLICY "Admin full access"
ON profiles
FOR ALL
TO authenticated
USING (auth.jwt()->> 'role' = 'admin');

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

-- Admins can manage all RFPs using JWT check instead of profiles query
CREATE POLICY "Admins can manage all RFPs"
ON rfps
FOR ALL
TO public
USING (auth.jwt()->> 'role' = 'admin');

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

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250508204512',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Comprehensive fix for RLS policies',
    'details', 'Fixed admin access to users and RFPs with non-recursive JWT-based policies'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();