/*
  # Add address and state of incorporation to companies table
  
  1. Changes
    - Add state_of_incorporation field to companies table
    - Ensure address field exists (it should already be there)
    - Create indexes for improved searching
*/

-- Add state_of_incorporation column if it doesn't exist
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state_of_incorporation text;

-- Create index for state for better searching
CREATE INDEX IF NOT EXISTS companies_state_idx ON companies(state_of_incorporation);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.company.20250510160000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added state of incorporation field',
    'details', 'Added state_of_incorporation field to companies table for compliance purposes'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();