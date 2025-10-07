/*
  # Fix update_expired_rfps_simple function return type
  
  1. Function Update
    - Change return type from integer to jsonb for PostgREST compatibility
    - Return JSON object with updated_count field
    - Ensures function can be called via Supabase RPC without parameters
*/

-- Fix the function to return jsonb instead of integer for PostgREST compatibility
CREATE OR REPLACE FUNCTION update_expired_rfps_simple()
RETURNS jsonb AS $$
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
  
  RETURN jsonb_build_object('updated_count', updated_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;