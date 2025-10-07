/*
  # Add milestones to RFPs table
  
  1. Changes
    - Add milestones JSONB column to RFPs table
    - Add validation for milestone data
    - Add index for milestone dates
*/

-- Add milestones column to RFPs table
ALTER TABLE rfps ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '[]'::jsonb;

-- Create index for milestone dates using jsonb_path_ops
CREATE INDEX IF NOT EXISTS rfps_milestone_dates_idx ON rfps USING gin (milestones jsonb_path_ops);

-- Function to validate milestone data
CREATE OR REPLACE FUNCTION validate_milestone_data()
RETURNS trigger AS $$
BEGIN
  -- Ensure milestones is an array
  IF NOT jsonb_typeof(NEW.milestones) = 'array' THEN
    NEW.milestones := '[]'::jsonb;
  END IF;

  -- Validate each milestone
  FOR i IN 0..jsonb_array_length(NEW.milestones) - 1 LOOP
    IF NOT (
      NEW.milestones->i ? 'id' AND
      NEW.milestones->i ? 'title' AND
      NEW.milestones->i ? 'date'
    ) THEN
      RAISE EXCEPTION 'Invalid milestone data: missing required fields';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for milestone validation
CREATE TRIGGER validate_milestones
  BEFORE INSERT OR UPDATE ON rfps
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_data();

-- Log the migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.apply.20250408204512',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added milestones to RFPs',
    'changes', 'Added milestones column and validation'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();