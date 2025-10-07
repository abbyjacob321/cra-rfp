/*
  # Fix UUID handling and add debugging functions
  
  1. Changes
    - Add trigger to validate UUIDs before insert/update
    - Add debugging functions to track UUID issues
    - Add function to validate RFP data before save
    - Add indexes to improve UUID lookup performance
*/

-- Create a function to validate UUIDs
CREATE OR REPLACE FUNCTION validate_uuid(id text)
RETURNS boolean AS $$
BEGIN
  RETURN id IS NULL OR id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
END;
$$ LANGUAGE plpgsql;

-- Create a function to debug RFP saves
CREATE OR REPLACE FUNCTION debug_rfp_save(
  rfp_data jsonb,
  OUT debug_info jsonb
) AS $$
DECLARE
  cleaned_data jsonb;
BEGIN
  -- Remove any invalid UUIDs
  cleaned_data = rfp_data - 'id' - 'client_id';
  
  -- Add debugging info
  debug_info = jsonb_build_object(
    'original_data', rfp_data,
    'cleaned_data', cleaned_data,
    'has_invalid_uuid', NOT (
      validate_uuid((rfp_data->>'id')) AND 
      validate_uuid((rfp_data->>'client_id'))
    ),
    'timestamp', now(),
    'valid_fields', (
      SELECT jsonb_agg(key)
      FROM jsonb_object_keys(rfp_data) key
      WHERE key NOT IN ('id', 'client_id')
    )
  );
  
  -- Log the debug info
  INSERT INTO analytics_events (
    event_type,
    metadata
  ) VALUES (
    'rfp_save_debug',
    debug_info
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to ensure valid UUIDs
CREATE OR REPLACE FUNCTION ensure_valid_uuid()
RETURNS trigger AS $$
BEGIN
  IF NOT validate_uuid(NEW.id::text) THEN
    -- Log the error
    INSERT INTO analytics_events (
      event_type,
      metadata
    ) VALUES (
      'invalid_uuid_attempt',
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'invalid_id', NEW.id,
        'timestamp', now()
      )
    );
    
    -- Let Supabase generate the UUID
    NEW.id = gen_random_uuid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to RFPs table
DROP TRIGGER IF EXISTS ensure_valid_rfp_uuid ON rfps;
CREATE TRIGGER ensure_valid_rfp_uuid
  BEFORE INSERT OR UPDATE ON rfps
  FOR EACH ROW
  EXECUTE FUNCTION ensure_valid_uuid();

-- Add trigger to RFP components table  
DROP TRIGGER IF EXISTS ensure_valid_component_uuid ON rfp_components;
CREATE TRIGGER ensure_valid_component_uuid
  BEFORE INSERT OR UPDATE ON rfp_components
  FOR EACH ROW
  EXECUTE FUNCTION ensure_valid_uuid();

-- Add indexes for UUID lookups
CREATE INDEX IF NOT EXISTS rfps_id_lookup_idx ON rfps USING hash (id);
CREATE INDEX IF NOT EXISTS rfp_components_id_lookup_idx ON rfp_components USING hash (id);

-- Function to clean RFP data before insert
CREATE OR REPLACE FUNCTION clean_rfp_data(
  input_data jsonb,
  OUT cleaned_data jsonb
) AS $$
BEGIN
  -- Remove any invalid or undefined values
  cleaned_data = input_data - 'id' - 'client_id' - 'created_at' - 'updated_at';
  
  -- Ensure required fields
  IF cleaned_data->>'title' IS NULL OR cleaned_data->>'title' = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  
  IF cleaned_data->>'client_name' IS NULL OR cleaned_data->>'client_name' = '' THEN
    RAISE EXCEPTION 'client_name is required';
  END IF;
  
  IF cleaned_data->>'description' IS NULL OR cleaned_data->>'description' = '' THEN
    RAISE EXCEPTION 'description is required';
  END IF;
  
  -- Set default values
  IF cleaned_data->>'visibility' IS NULL THEN
    cleaned_data = jsonb_set(cleaned_data, '{visibility}', '"public"');
  END IF;
  
  IF cleaned_data->>'status' IS NULL THEN
    cleaned_data = jsonb_set(cleaned_data, '{status}', '"draft"');
  END IF;
  
  -- Ensure dates are valid
  IF cleaned_data->>'issue_date' IS NULL THEN
    cleaned_data = jsonb_set(cleaned_data, '{issue_date}', to_jsonb(now()));
  END IF;
  
  IF cleaned_data->>'closing_date' IS NULL THEN
    cleaned_data = jsonb_set(cleaned_data, '{closing_date}', to_jsonb(now() + interval '30 days'));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Log the migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250408204512',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added UUID validation and debugging functions',
    'changes', 'Added triggers and functions to handle UUID generation and validation'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();