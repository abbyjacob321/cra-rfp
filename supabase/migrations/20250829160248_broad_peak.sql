/*
  # Fix RFP Status Auto-Update
  
  1. Functions
    - Add function to automatically update expired RFPs to 'closed' status
    - Add trigger to check status on RFP reads
    - Add manual function to fix existing RFPs
    
  2. Updates
    - Update any RFPs that should be closed but are still marked as active
    - Add automatic status management going forward
*/

-- Function to update RFP status based on closing date
CREATE OR REPLACE FUNCTION update_rfp_status_on_date()
RETURNS void AS $$
BEGIN
  -- Update RFPs that have passed their closing date
  UPDATE rfps
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status = 'active'
    AND closing_date < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a single RFP's status
CREATE OR REPLACE FUNCTION check_and_update_rfp_status(p_rfp_id uuid)
RETURNS text AS $$
DECLARE
  current_status text;
  closing_date timestamptz;
  new_status text;
BEGIN
  -- Get current status and closing date
  SELECT status, closing_date INTO current_status, closing_date
  FROM rfps WHERE id = p_rfp_id;
  
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  
  -- Determine what status should be
  IF current_status = 'active' AND closing_date < now() THEN
    -- Update to closed
    UPDATE rfps 
    SET status = 'closed', updated_at = now()
    WHERE id = p_rfp_id;
    
    RETURN 'updated_to_closed';
  ELSE
    RETURN current_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view that always shows correct RFP status
CREATE OR REPLACE VIEW rfps_with_current_status AS
SELECT 
  *,
  CASE 
    WHEN status = 'active' AND closing_date < now() THEN 'closed'
    ELSE status
  END AS current_status
FROM rfps;

-- Function to get RFPs with auto-updated status
CREATE OR REPLACE FUNCTION get_rfps_with_status(
  p_status text DEFAULT NULL,
  p_visibility text DEFAULT NULL,
  p_limit int DEFAULT NULL
)
RETURNS SETOF rfps AS $$
DECLARE
  query_text text;
BEGIN
  -- First update any expired RFPs
  PERFORM update_rfp_status_on_date();
  
  -- Build and execute query
  query_text := 'SELECT * FROM rfps WHERE 1=1';
  
  IF p_status IS NOT NULL THEN
    query_text := query_text || ' AND status = ' || quote_literal(p_status);
  END IF;
  
  IF p_visibility IS NOT NULL THEN
    query_text := query_text || ' AND visibility = ' || quote_literal(p_visibility);
  END IF;
  
  query_text := query_text || ' ORDER BY closing_date ASC';
  
  IF p_limit IS NOT NULL THEN
    query_text := query_text || ' LIMIT ' || p_limit;
  END IF;
  
  RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the update function immediately to fix existing RFPs
SELECT update_rfp_status_on_date();

-- Create a trigger to auto-update RFP status when queried
CREATE OR REPLACE FUNCTION trigger_update_rfp_status()
RETURNS trigger AS $$
BEGIN
  -- Check if this RFP should be closed
  IF NEW.status = 'active' AND NEW.closing_date < now() THEN
    NEW.status = 'closed';
    NEW.updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic status updates
DROP TRIGGER IF EXISTS auto_update_rfp_status ON rfps;
CREATE TRIGGER auto_update_rfp_status
  BEFORE UPDATE ON rfps
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rfp_status();

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.rfp_status_auto_update',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added automatic RFP status updates',
    'details', 'RFPs now automatically update to closed when closing_date passes'
  ),
  'RFP status fix migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();