/*
  # Fix RLS policies for rfp_components table
  
  1. Changes
     - Add explicit RLS policies for the rfp_components table
     - Allow admin users to manage all components
     - Ensure components are properly secured with RLS
  
  2. Security
     - Maintains proper access control
     - Allows admin users to add/edit/delete components
     - Prevents unauthorized access to components
*/

-- Ensure RLS is enabled on rfp_components table
ALTER TABLE rfp_components ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage all components" ON rfp_components;
DROP POLICY IF EXISTS "Users can view public RFP components" ON rfp_components;

-- Create policy allowing admins to manage all components
CREATE POLICY "Admins can manage all components"
ON rfp_components
FOR ALL
TO authenticated
USING (
  -- Check if user is admin through profiles table
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
  OR
  -- Alternative check using JWT claim
  (auth.jwt()->>'role' = 'admin')
);

-- Create policy allowing users to view components for public RFPs
CREATE POLICY "Users can view public RFP components"
ON rfp_components
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rfps
    WHERE rfps.id = rfp_components.rfp_id
    AND rfps.visibility = 'public'
  )
);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250524173218',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed RLS policies for rfp_components table',
    'details', 'Added policies allowing admins to manage components and users to view public components'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();