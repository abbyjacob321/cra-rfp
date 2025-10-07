/*
  # Fix RFP Component Visibility for Non-Admin Users
  
  1. Changes
     - Update RLS policies for rfp_components table
     - Ensure components are visible to all users for public RFPs
     - Add explicit policy for component visibility
     
  2. Security
     - Maintains admin-only management capabilities
     - Ensures proper public visibility of components
     - Preserves NDA and access controls
*/

-- Drop existing policies for rfp_components
DROP POLICY IF EXISTS "Admins can manage all components" ON rfp_components;
DROP POLICY IF EXISTS "Users can view public RFP components" ON rfp_components;

-- Create policy allowing admins to manage all components
CREATE POLICY "Admins can manage all components"
ON rfp_components
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
  OR
  (auth.jwt()->>'role' = 'admin')
);

-- Create policy allowing ALL users (including anonymous) to view components of public RFPs
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

-- Add policy for anonymous users to view public RFP components
CREATE POLICY "Anonymous users can view public RFP components"
ON rfp_components
FOR SELECT
TO anon
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
  'migration.fix.20250527204125',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed RFP Component Visibility',
    'details', 'Updated RLS policies to ensure components are visible to all users for public RFPs'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();