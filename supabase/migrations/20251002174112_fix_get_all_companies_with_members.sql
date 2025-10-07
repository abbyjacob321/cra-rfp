/*
  # Fix get_all_companies_with_members Function
  
  1. Issue Fixed
    - Function returns jsonb instead of a table/record set
    - Frontend expects a table result, not a jsonb object
    
  2. Changes
    - Replace get_all_companies_with_members to return SETOF record
    - Return proper table structure compatible with Supabase client queries
*/

-- Drop the old function
DROP FUNCTION IF EXISTS get_all_companies_with_members();

-- Create new function that returns a table
CREATE OR REPLACE FUNCTION get_all_companies_with_members()
RETURNS TABLE (
  id uuid,
  name text,
  website text,
  industry text,
  address text,
  phone text,
  logo_url text,
  description text,
  state_of_incorporation text,
  verification_status text,
  auto_join_enabled boolean,
  verified_domain text,
  email_domain text,
  blocked_domains text[],
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  member_count bigint,
  primary_member_count bigint,
  secondary_member_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.website,
    c.industry,
    c.address,
    c.phone,
    c.logo_url,
    c.description,
    c.state_of_incorporation,
    COALESCE(c.verification_status, 'unverified')::text,
    COALESCE(c.auto_join_enabled, false),
    c.verified_domain,
    c.email_domain,
    COALESCE(c.blocked_domains, ARRAY[]::text[]),
    c.created_at,
    c.updated_at,
    c.created_by,
    (COALESCE(fk_count.count, 0) + COALESCE(text_count.count, 0))::bigint as member_count,
    COALESCE(fk_count.count, 0)::bigint as primary_member_count,
    0::bigint as secondary_member_count
  FROM companies c
  LEFT JOIN (
    -- Count members linked by foreign key
    SELECT company_id, COUNT(*) as count
    FROM profiles
    WHERE company_id IS NOT NULL
    GROUP BY company_id
  ) fk_count ON c.id = fk_count.company_id
  LEFT JOIN (
    -- Count members linked by text field only (case-insensitive matching)
    SELECT 
      c2.id as company_id,
      COUNT(*) as count
    FROM profiles p
    JOIN companies c2 ON (
      LOWER(p.company) = LOWER(c2.name) OR
      LOWER(c2.name) LIKE '%' || LOWER(p.company) || '%' OR
      LOWER(p.company) LIKE '%' || LOWER(c2.name) || '%'
    )
    WHERE p.company IS NOT NULL 
    AND p.company != ''
    AND p.company_id IS NULL  -- Only count those not already linked by FK
    GROUP BY c2.id
  ) text_count ON c.id = text_count.company_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_all_companies_with_members() TO public;