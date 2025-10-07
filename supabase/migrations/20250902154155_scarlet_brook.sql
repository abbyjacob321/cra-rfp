/*
  # Add Homepage Display Control for RFPs
  
  1. New Fields
    - Add `display_on_homepage` boolean field to RFPs table
    - Add `featured_until` date field for time-limited featuring
    - Add `featured_priority` integer for ordering on homepage
    
  2. Retroactive Status Fix
    - Force update ALL expired RFPs to closed status
    - Add more robust status update function
    - Add logging to track what gets updated
    
  3. Admin Control
    - Admins can now control which RFPs appear on homepage
    - Independent of active/closed status
    - Can feature closed RFPs for informational purposes
*/

-- Add homepage display control fields to RFPs table
ALTER TABLE rfps 
ADD COLUMN IF NOT EXISTS display_on_homepage boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS featured_until timestamptz,
ADD COLUMN IF NOT EXISTS featured_priority integer DEFAULT 0;

-- Create index for homepage queries
CREATE INDEX IF NOT EXISTS rfps_homepage_display_idx ON rfps(display_on_homepage, featured_priority DESC, closing_date);

-- Create a more aggressive function to fix ALL historical RFPs
CREATE OR REPLACE FUNCTION force_update_all_expired_rfps()
RETURNS jsonb AS $$
DECLARE
  updated_count integer;
  all_expired jsonb;
BEGIN
  -- Get ALL RFPs that should be closed but aren't
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'title', title,
      'client_name', client_name,
      'status', status,
      'closing_date', closing_date,
      'months_overdue', EXTRACT(MONTHS FROM (now() - closing_date)),
      'created_at', created_at
    )
  ) INTO all_expired
  FROM rfps
  WHERE status IN ('active', 'draft') 
  AND closing_date < now()
  AND closing_date IS NOT NULL;

  -- Force update ALL expired RFPs to closed - be very aggressive
  UPDATE rfps
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status IN ('active', 'draft')
    AND closing_date < now()
    AND closing_date IS NOT NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log the aggressive fix
  INSERT INTO analytics_events (
    event_type,
    metadata
  ) VALUES (
    'force_rfp_status_update',
    jsonb_build_object(
      'updated_count', updated_count,
      'all_expired_rfps', all_expired,
      'fix_timestamp', now(),
      'fix_method', 'force_update_aggressive'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'all_expired_rfps', all_expired,
    'message', format('FORCE UPDATED %s expired RFPs to closed status', updated_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get homepage RFPs with admin control
CREATE OR REPLACE FUNCTION get_homepage_rfps(p_limit int DEFAULT 6)
RETURNS SETOF rfps AS $$
BEGIN
  -- First update any expired RFPs
  PERFORM force_update_all_expired_rfps();
  
  -- Return RFPs based on admin homepage display settings
  RETURN QUERY
  SELECT *
  FROM rfps
  WHERE 
    display_on_homepage = true
    AND (featured_until IS NULL OR featured_until > now())
    AND visibility = 'public'
  ORDER BY 
    featured_priority DESC,
    CASE 
      WHEN status = 'active' THEN 1
      WHEN status = 'closed' THEN 2
      ELSE 3
    END,
    closing_date ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle homepage display for an RFP
CREATE OR REPLACE FUNCTION toggle_homepage_display(
  p_rfp_id uuid,
  p_display_on_homepage boolean,
  p_featured_until timestamptz DEFAULT NULL,
  p_featured_priority integer DEFAULT 0
) RETURNS jsonb AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can control homepage display'
    );
  END IF;
  
  -- Update the RFP
  UPDATE rfps
  SET 
    display_on_homepage = p_display_on_homepage,
    featured_until = p_featured_until,
    featured_priority = p_featured_priority,
    updated_at = now()
  WHERE id = p_rfp_id;
  
  -- Log the change
  INSERT INTO analytics_events (
    event_type,
    user_id,
    rfp_id,
    metadata
  ) VALUES (
    'homepage_display_updated',
    auth.uid(),
    p_rfp_id,
    jsonb_build_object(
      'display_on_homepage', p_display_on_homepage,
      'featured_until', p_featured_until,
      'featured_priority', p_featured_priority,
      'updated_by', (SELECT first_name || ' ' || last_name FROM profiles WHERE id = auth.uid())
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'rfp_id', p_rfp_id,
    'display_on_homepage', p_display_on_homepage,
    'message', 'Homepage display settings updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Immediately run the force update to fix all historical RFPs
SELECT force_update_all_expired_rfps();

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.homepage_display.20250106144000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added homepage display control and fixed retroactive RFP status',
    'details', 'Admins can now control which RFPs appear on homepage regardless of status'
  ),
  'Homepage display control migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();