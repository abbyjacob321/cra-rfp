/*
  # Fix search_companies function GROUP BY error
  
  1. Changes
     - Update the search_companies function to include c.name in the GROUP BY clause
     - This fixes the error: "column c.name must appear in the GROUP BY clause or be used in an aggregate function"
     
  2. Impact
     - Resolves error in the join company flow when searching for companies
*/

CREATE OR REPLACE FUNCTION public.search_companies(search_term text)
RETURNS TABLE(
  id uuid,
  name text,
  website text,
  industry text,
  logo_url text,
  member_count bigint
) 
LANGUAGE sql
AS $$
  SELECT 
    c.id,
    c.name,
    c.website,
    c.industry,
    c.logo_url,
    COUNT(p.id) AS member_count
  FROM 
    companies c
  LEFT JOIN 
    profiles p ON c.id = p.company_id
  WHERE 
    c.name ILIKE '%' || search_term || '%'
  GROUP BY 
    c.id, c.name, c.website, c.industry, c.logo_url
  ORDER BY 
    c.name ASC
  LIMIT 10;
$$;