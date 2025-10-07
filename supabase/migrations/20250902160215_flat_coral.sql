/*
  # Fix Homepage Display and Add Missing Columns
  
  1. Schema Updates
    - Add homepage display columns to RFPs table if they don't exist
    - Set default values for existing RFPs
    - Add indexes for performance
    
  2. Immediate Data Fix  
    - Update all existing RFPs to have display_on_homepage = true
    - Update all expired RFPs to closed status
    - Set appropriate defaults for new fields
*/

-- Add homepage display columns if they don't exist
ALTER TABLE rfps 
ADD COLUMN IF NOT EXISTS display_on_homepage boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS featured_until timestamptz,
ADD COLUMN IF NOT EXISTS featured_priority integer DEFAULT 0;

-- Create indexes for homepage queries
CREATE INDEX IF NOT EXISTS rfps_homepage_display_idx 
  ON rfps(display_on_homepage, featured_priority DESC, closing_date);

-- Update all existing RFPs to show on homepage by default
UPDATE rfps 
SET display_on_homepage = true
WHERE display_on_homepage IS NULL;

-- Force update ALL expired RFPs to closed status immediately
UPDATE rfps
SET 
  status = 'closed',
  updated_at = now()
WHERE 
  status IN ('active', 'draft')
  AND closing_date < now()
  AND closing_date IS NOT NULL;

-- Create simple function to update expired RFPs if it doesn't exist
CREATE OR REPLACE FUNCTION update_expired_rfps_simple()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE rfps
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status IN ('active', 'draft')
    AND closing_date < now()
    AND closing_date IS NOT NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.homepage_fix.20250106144500',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed homepage display and added missing columns',
    'details', 'Added homepage display controls and fixed RFP status issues'
  ),
  'Homepage fix migration'
) ON CONFLICT (key) DO NOTHING;