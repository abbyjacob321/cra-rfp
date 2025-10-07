/*
  # Fix RLS policy for RFPs table
  
  1. Changes
     - Drop and recreate RLS policies for rfps table
     - Fix admin access to create and modify RFPs
     - Add multiple ways to verify admin status
     - Ensure insert and update permissions work correctly
  
  2. Security
     - Maintains proper access control
     - Ensures admins can create new RFPs
     - Keeps public view access for non-authenticated users
*/

-- Ensure RLS is enabled on rfps table
ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policies on RFPs table
DROP POLICY IF EXISTS "Everyone can view public RFPs" ON rfps;
DROP POLICY IF EXISTS "Users can view confidential RFPs they have access to" ON rfps;
DROP POLICY IF EXISTS "Admins can manage all RFPs" ON rfps;

-- Create simplified RFP policies
-- PUBLIC ACCESS: Everyone can view public RFPs
CREATE POLICY "Everyone can view public RFPs"
ON rfps
FOR SELECT
TO public
USING (visibility = 'public');

-- CONFIDENTIAL ACCESS: Users with approved access can view confidential RFPs
CREATE POLICY "Users can view confidential RFPs they have access to"
ON rfps
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM rfp_access
    WHERE rfp_access.rfp_id = rfps.id
    AND rfp_access.user_id = auth.uid()
    AND rfp_access.status = 'approved'
  )
);

-- ADMIN ACCESS: Multi-way verification for admin status to ensure it works
-- This provides several alternative methods to verify admin status, making it more robust
CREATE POLICY "Admins can manage all RFPs"
ON rfps
FOR ALL
TO public
USING (
  -- Method 1: Check JWT claim
  (auth.jwt()->>'role' = 'admin')
  OR
  -- Method 2: Check profiles table
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add a specific INSERT policy for admins to ensure this works
CREATE POLICY "Admins can insert RFPs" 
ON rfps
FOR INSERT
TO authenticated
WITH CHECK (
  -- Method 1: Check JWT claim
  (auth.jwt()->>'role' = 'admin')
  OR
  -- Method 2: Check profiles table  
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create a function to debug RFP permission issues
CREATE OR REPLACE FUNCTION debug_rfp_permissions()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', now(),
    'user_id', auth.uid(),
    'is_admin_jwt', auth.jwt()->>'role' = 'admin',
    'is_admin_profile', EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ),
    'jwt_payload', auth.jwt()
  ) INTO result;
  
  -- Log the debug access
  INSERT INTO analytics_events(
    event_type,
    user_id,
    metadata
  ) VALUES (
    'debug_rfp_permissions',
    auth.uid(),
    result
  );
  
  RETURN result;
END;
$$;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250508140012',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed RFP RLS policies',
    'details', 'Created multi-method admin access verification for RFP insert/update operations'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();