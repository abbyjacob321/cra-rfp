/*
  # Retroactive RFP Status Fix
  
  This migration ensures ALL expired RFPs are updated to 'closed' status,
  both retroactively (historical data) and prospectively (going forward).
  
  1. Immediate Fix
    - Update all RFPs with closing_date < now() to 'closed' status
    - Add comprehensive logging to track what gets updated
    
  2. Robust Functions
    - Create reliable function to update expired RFPs
    - Add function that gets called automatically
    - Ensure it works for historical data from June and earlier
  
  3. Verification
    - Add function to verify all RFPs have correct status
    - Add logging to track status changes
*/

-- Function to immediately update all expired RFPs (retroactive fix)
CREATE OR REPLACE FUNCTION fix_all_expired_rfps_now()
RETURNS jsonb AS $$
DECLARE
  updated_count integer;
  affected_rfps jsonb;
  oldest_expired_date date;
  newest_expired_date date;
BEGIN
  -- Get info about RFPs that should be closed but aren't
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'client_name', client_name,
        'status', status,
        'closing_date', closing_date,
        'days_overdue', EXTRACT(DAYS FROM (now() - closing_date))
      )
    ),
    MIN(closing_date::date),
    MAX(closing_date::date)
  INTO 
    affected_rfps,
    oldest_expired_date,
    newest_expired_date
  FROM rfps
  WHERE status = 'active' 
  AND closing_date < now();

  -- Update ALL expired RFPs to closed status
  UPDATE rfps
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status = 'active'
    AND closing_date < now();
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log the retroactive fix
  INSERT INTO analytics_events (
    event_type,
    metadata
  ) VALUES (
    'retroactive_rfp_status_fix',
    jsonb_build_object(
      'updated_count', updated_count,
      'affected_rfps', affected_rfps,
      'oldest_expired', oldest_expired_date,
      'newest_expired', newest_expired_date,
      'fix_timestamp', now(),
      'fix_type', 'retroactive_bulk_update'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'affected_rfps', affected_rfps,
    'oldest_expired_date', oldest_expired_date,
    'newest_expired_date', newest_expired_date,
    'message', format('Updated %s expired RFPs to closed status', updated_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify RFP status correctness
CREATE OR REPLACE FUNCTION verify_rfp_status_accuracy()
RETURNS jsonb AS $$
DECLARE
  total_rfps integer;
  active_rfps integer;
  closed_rfps integer;
  incorrectly_active integer;
  verification_result jsonb;
BEGIN
  -- Count all RFPs
  SELECT COUNT(*) INTO total_rfps FROM rfps;
  
  -- Count by status
  SELECT COUNT(*) INTO active_rfps FROM rfps WHERE status = 'active';
  SELECT COUNT(*) INTO closed_rfps FROM rfps WHERE status = 'closed';
  
  -- Count RFPs that should be closed but aren't
  SELECT COUNT(*) INTO incorrectly_active 
  FROM rfps 
  WHERE status = 'active' AND closing_date < now();
  
  -- Build verification result
  verification_result := jsonb_build_object(
    'total_rfps', total_rfps,
    'active_rfps', active_rfps,
    'closed_rfps', closed_rfps,
    'incorrectly_active', incorrectly_active,
    'accuracy_percentage', CASE 
      WHEN total_rfps > 0 THEN 
        ROUND(((total_rfps - incorrectly_active)::decimal / total_rfps) * 100, 2)
      ELSE 100 
    END,
    'is_accurate', (incorrectly_active = 0),
    'verification_timestamp', now(),
    'incorrectly_active_rfps', CASE 
      WHEN incorrectly_active > 0 THEN
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'title', title,
            'closing_date', closing_date,
            'days_overdue', EXTRACT(DAYS FROM (now() - closing_date))
          )
        ) FROM rfps WHERE status = 'active' AND closing_date < now())
      ELSE NULL
    END
  );
  
  -- Log verification
  INSERT INTO analytics_events (
    event_type,
    metadata
  ) VALUES (
    'rfp_status_verification',
    verification_result
  );
  
  RETURN verification_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function that ensures all RFPs have correct status
CREATE OR REPLACE FUNCTION ensure_all_rfp_status_correct()
RETURNS void AS $$
DECLARE
  verification_before jsonb;
  fix_result jsonb;
  verification_after jsonb;
BEGIN
  -- Verify status before fix
  SELECT verify_rfp_status_accuracy() INTO verification_before;
  
  -- Apply retroactive fix if needed
  IF (verification_before->>'incorrectly_active')::integer > 0 THEN
    SELECT fix_all_expired_rfps_now() INTO fix_result;
  END IF;
  
  -- Verify status after fix
  SELECT verify_rfp_status_accuracy() INTO verification_after;
  
  -- Log the complete operation
  INSERT INTO analytics_events (
    event_type,
    metadata
  ) VALUES (
    'complete_rfp_status_check',
    jsonb_build_object(
      'before', verification_before,
      'fix_applied', (verification_before->>'incorrectly_active')::integer > 0,
      'fix_result', fix_result,
      'after', verification_after,
      'operation_timestamp', now()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simpler, more reliable function for the frontend to call
CREATE OR REPLACE FUNCTION update_expired_rfps_simple()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Simple, direct update of all expired RFPs
  UPDATE rfps
  SET 
    status = 'closed',
    updated_at = now()
  WHERE 
    status IN ('active', 'draft')  -- Also catch any draft RFPs that are expired
    AND closing_date < now()
    AND closing_date IS NOT NULL;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log if any updates were made
  IF updated_count > 0 THEN
    INSERT INTO analytics_events (
      event_type,
      metadata
    ) VALUES (
      'expired_rfps_updated',
      jsonb_build_object(
        'count', updated_count,
        'timestamp', now(),
        'method', 'simple_update'
      )
    );
  END IF;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Immediately run the retroactive fix for all historical data
SELECT fix_all_expired_rfps_now();

-- Verify the fix worked
SELECT verify_rfp_status_accuracy();

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.retroactive_rfp_fix.20250106143000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Retroactive fix for all expired RFPs',
    'details', 'Updated all historical RFPs with past closing dates to closed status',
    'covers_period', 'All RFPs from platform inception through current date'
  ),
  'Retroactive RFP status fix migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();