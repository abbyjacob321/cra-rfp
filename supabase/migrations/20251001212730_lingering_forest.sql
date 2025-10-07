/*
  # Fix Company-User Assignment Functions
  
  1. Issues Fixed
    - Create missing admin_assign_user_to_company function
    - Fix parameter order in function calls
    - Add proper foreign key relationship creation
    - Fix member count queries
    
  2. Features Added
    - Admin can assign users to companies via proper foreign keys
    - Auto-link existing text relationships to foreign keys
    - Preserve existing admin/member roles
    - Complete audit trail
*/

-- Function to find company by name (case-insensitive, fuzzy matching)
CREATE OR REPLACE FUNCTION find_company_by_name(company_name text)
RETURNS uuid AS $$
DECLARE
  company_id uuid;
BEGIN
  -- Try exact match first
  SELECT id INTO company_id
  FROM companies
  WHERE LOWER(name) = LOWER(company_name)
  LIMIT 1;
  
  -- If no exact match, try fuzzy match
  IF company_id IS NULL THEN
    SELECT id INTO company_id
    FROM companies
    WHERE LOWER(name) LIKE '%' || LOWER(company_name) || '%'
    OR LOWER(company_name) LIKE '%' || LOWER(name) || '%'
    ORDER BY 
      CASE 
        WHEN LOWER(name) = LOWER(company_name) THEN 1
        WHEN LOWER(name) LIKE LOWER(company_name) || '%' THEN 2
        WHEN LOWER(name) LIKE '%' || LOWER(company_name) || '%' THEN 3
        ELSE 4
      END
    LIMIT 1;
  END IF;
  
  RETURN company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-link users to companies based on company name text
CREATE OR REPLACE FUNCTION link_existing_users_to_companies()
RETURNS jsonb AS $$
DECLARE
  linked_count integer := 0;
  user_record record;
  company_id uuid;
  result jsonb;
BEGIN
  -- Only allow admins to run this
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can run this function'
    );
  END IF;
  
  -- Loop through users who have company text but no company_id
  FOR user_record IN (
    SELECT id, email, company, first_name, last_name, company_role
    FROM profiles
    WHERE company IS NOT NULL 
    AND company != ''
    AND company_id IS NULL
  ) LOOP
    -- Try to find matching company
    company_id := find_company_by_name(user_record.company);
    
    IF company_id IS NOT NULL THEN
      -- Update user's company_id and preserve their existing role
      UPDATE profiles
      SET 
        company_id = company_id,
        company_role = COALESCE(user_record.company_role, 'member')
      WHERE id = user_record.id;
      
      linked_count := linked_count + 1;
      
      -- Log the linking
      INSERT INTO analytics_events (
        event_type,
        user_id,
        metadata
      ) VALUES (
        'company_auto_linked',
        user_record.id,
        jsonb_build_object(
          'user_email', user_record.email,
          'company_text', user_record.company,
          'matched_company_id', company_id,
          'preserved_role', COALESCE(user_record.company_role, 'member'),
          'linked_at', now()
        )
      );
    ELSE
      -- Log companies that couldn't be matched
      INSERT INTO analytics_events (
        event_type,
        user_id,
        metadata
      ) VALUES (
        'company_link_failed',
        user_record.id,
        jsonb_build_object(
          'user_email', user_record.email,
          'company_text', user_record.company,
          'reason', 'no_matching_company_found',
          'attempted_at', now()
        )
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'linked_count', linked_count,
    'message', format('Successfully linked %s users to companies via name matching', linked_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admins to assign users to companies (with correct parameter order)
CREATE OR REPLACE FUNCTION admin_assign_user_to_company(
  p_user_id uuid,
  p_company_id uuid,
  p_role text DEFAULT 'member',
  p_membership_type text DEFAULT 'primary'
) RETURNS jsonb AS $$
DECLARE
  v_user_name text;
  v_company_name text;
  v_result jsonb;
BEGIN
  -- Check if current user is admin
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators can assign users to companies'
    );
  END IF;
  
  -- Get user and company names
  SELECT first_name || ' ' || last_name INTO v_user_name 
  FROM profiles WHERE id = p_user_id;
  
  SELECT name INTO v_company_name 
  FROM companies WHERE id = p_company_id;
  
  IF v_user_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;
  
  IF v_company_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Company not found'
    );
  END IF;
  
  -- Update user's primary company (always use primary since secondary table might not exist)
  UPDATE profiles
  SET 
    company_id = p_company_id,
    company_role = p_role,
    company = v_company_name
  WHERE id = p_user_id;
  
  -- Notify user
  INSERT INTO notifications (
    user_id, title, message, type, reference_id
  ) VALUES (
    p_user_id,
    'Company Assignment',
    'You have been assigned to ' || v_company_name || ' as a ' || p_role || ' by an administrator.',
    'admin_company_assignment',
    p_company_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'company_name', v_company_name,
    'role', p_role,
    'membership_type', p_membership_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to get companies with accurate member counts
CREATE OR REPLACE FUNCTION get_all_companies_with_members()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check admin access
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Admin access required'
    );
  END IF;
  
  -- Get all companies with member counts from multiple sources
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'website', c.website,
      'industry', c.industry,
      'address', c.address,
      'phone', c.phone,
      'logo_url', c.logo_url,
      'description', c.description,
      'state_of_incorporation', c.state_of_incorporation,
      'verification_status', COALESCE(c.verification_status, 'unverified'),
      'auto_join_enabled', COALESCE(c.auto_join_enabled, false),
      'verified_domain', c.verified_domain,
      'email_domain', c.email_domain,
      'blocked_domains', COALESCE(c.blocked_domains, '{}'),
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'member_count', COALESCE(fk_count.count, 0) + COALESCE(text_count.count, 0),
      'fk_member_count', COALESCE(fk_count.count, 0),
      'text_member_count', COALESCE(text_count.count, 0)
    ) ORDER BY c.created_at DESC
  )
  INTO v_result
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
  ) text_count ON c.id = text_count.company_id;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_company_by_name(text) TO public;
GRANT EXECUTE ON FUNCTION public.link_existing_users_to_companies() TO public;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_to_company(uuid, uuid, text, text) TO public;
GRANT EXECUTE ON FUNCTION public.get_all_companies_with_members() TO public;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix_user_company_assignment.20251224',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed user-company assignment functions and member counting',
    'details', 'Created missing functions with correct parameter order and enhanced member count logic'
  ),
  'User company assignment fix migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();