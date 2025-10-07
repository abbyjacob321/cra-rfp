/*
  # Fix search_companies function
  
  1. Changes
     - Replace the function with a fixed version that properly includes all fields in GROUP BY
     - Add parameter name that matches what the frontend is expecting
*/

-- Drop the existing function with potential mismatched parameters
DROP FUNCTION IF EXISTS public.search_companies(text);
DROP FUNCTION IF EXISTS public.search_companies(text, int);

-- Create a new function with proper GROUP BY clause and parameter name
CREATE OR REPLACE FUNCTION search_companies(
  search_term text,
  p_limit int DEFAULT 10
) 
RETURNS TABLE (
  id uuid, 
  name text, 
  website text, 
  industry text, 
  member_count bigint
) AS $$
BEGIN
  RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.website,
      c.industry,
      COUNT(p.id) AS member_count
    FROM 
      companies c
    LEFT JOIN 
      profiles p ON c.id = p.company_id
    WHERE 
      c.name ILIKE '%' || search_term || '%'
      OR c.industry ILIKE '%' || search_term || '%'
    GROUP BY 
      c.id, c.name, c.website, c.industry
    ORDER BY 
      CASE 
        WHEN c.name ILIKE search_term || '%' THEN 1
        WHEN c.name ILIKE '%' || search_term || '%' THEN 2
        ELSE 3
      END,
      c.name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250513145621',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed search_companies function',
    'details', 'Fixed GROUP BY clause and parameter names in search_companies function'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();