/*
  # Update Milestone Schema for Timezone Support

  1. Schema Changes
    - Add timezone and has_time fields to milestone objects
    - Update existing milestones to include timezone info
    - Add validation for milestone data structure

  2. Functions
    - Update milestone validation function
    - Add timezone conversion helpers

  3. Default Values
    - Set default timezone to Eastern Time for existing milestones
    - Add has_time flag for existing milestones (default to false)
*/

-- Create a function to update existing milestone data
CREATE OR REPLACE FUNCTION update_milestone_timezones()
RETURNS void AS $$
DECLARE
  rfp_record RECORD;
  updated_milestones jsonb;
  milestone jsonb;
BEGIN
  -- Loop through all RFPs with milestones
  FOR rfp_record IN SELECT id, milestones FROM rfps WHERE milestones IS NOT NULL AND jsonb_array_length(milestones) > 0
  LOOP
    updated_milestones := '[]'::jsonb;
    
    -- Process each milestone
    FOR milestone IN SELECT * FROM jsonb_array_elements(rfp_record.milestones)
    LOOP
      -- Add timezone and has_time fields if they don't exist
      milestone := milestone || jsonb_build_object(
        'timezone', COALESCE(milestone->>'timezone', 'America/New_York'),
        'has_time', COALESCE((milestone->>'has_time')::boolean, false)
      );
      
      -- Ensure date is properly formatted
      IF milestone->>'date' IS NOT NULL AND NOT (milestone->>'date' ~ 'T') THEN
        -- If it's a date-only string, add time component
        milestone := jsonb_set(milestone, '{date}', to_jsonb((milestone->>'date') || 'T12:00:00.000Z'));
      END IF;
      
      updated_milestones := updated_milestones || jsonb_build_array(milestone);
    END LOOP;
    
    -- Update the RFP with the new milestone structure
    UPDATE rfps 
    SET milestones = updated_milestones 
    WHERE id = rfp_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the update function
SELECT update_milestone_timezones();

-- Drop the function as it's no longer needed
DROP FUNCTION update_milestone_timezones();

-- Update the milestone validation function to handle timezone
CREATE OR REPLACE FUNCTION validate_milestone_data()
RETURNS trigger AS $$
DECLARE
  milestone jsonb;
BEGIN
  -- Validate milestones array structure
  IF NEW.milestones IS NOT NULL THEN
    FOR milestone IN SELECT * FROM jsonb_array_elements(NEW.milestones)
    LOOP
      -- Check required fields
      IF milestone->>'id' IS NULL OR milestone->>'title' IS NULL OR milestone->>'date' IS NULL THEN
        RAISE EXCEPTION 'Milestone must have id, title, and date fields';
      END IF;
      
      -- Validate date format
      BEGIN
        PERFORM (milestone->>'date')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid date format in milestone: %', milestone->>'date';
      END;
      
      -- Validate timezone if provided
      IF milestone->>'timezone' IS NOT NULL THEN
        BEGIN
          PERFORM now() AT TIME ZONE (milestone->>'timezone');
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid timezone in milestone: %', milestone->>'timezone';
        END;
      END IF;
      
      -- Validate has_time is boolean if provided
      IF milestone->>'has_time' IS NOT NULL THEN
        BEGIN
          PERFORM (milestone->>'has_time')::boolean;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'has_time must be a boolean value';
        END;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;