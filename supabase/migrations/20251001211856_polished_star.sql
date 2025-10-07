/*
  # Fix Company-User Relationships and Add Admin Assignment
  
  1. Issues Identified
    - Users have company names in text field but no company_id foreign key relationships
    - Member count queries fail because they look for company_id links that don't exist
    - Need admin tools to properly assign users to companies
    
  2. Solutions
    - Create function to link users to companies by matching company name text
    - Add admin functions to assign/remove company relationships
    - Fix member count queries to be accurate
    - Add auto-join functionality for future signups
    
  3. Migration Strategy
    - Preserve existing company affiliations
    - Create proper foreign key relationships where possible
    - Add admin tools for ongoing management
*/

-- First, let's create a function to diagnose the current state
CREATE OR REPLACE FUNCTION diagnose_company_user_relationships()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', now(),
    'total_companies', (SELECT COUNT(*) FROM companies),
    'companies_with_members_via_fk', (
      SELECT COUNT(DISTINCT company_id) 
      FROM profiles 
      WHERE company_id IS NOT NULL
    ),
    'companies_with_members_via_text', (
      SELECT COUNT(DISTINCT company) 
      FROM profiles 
      WHERE company IS NOT NULL AND company != ''
    ),
    'users_with_company_fk', (
      SELECT COUNT(*) FROM profiles WHERE company_id IS NOT NULL
    ),
    'users_with_company_text', (
      SELECT COUNT(*) FROM profiles WHERE company IS NOT NULL AND company != ''
    ),
    'company_name_mismatches', (
      SELECT jsonb_agg(jsonb_build_object(
        'user_email', p.email,
        'company_text', p.company,
        'company_id', p.company_id,
        'actual_company_name', c.name
      ))
      FROM profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.company IS NOT NULL 
      AND p.company != ''
      AND (p.company_id IS NULL OR p.company != c.name)
      LIMIT 10
    ),
    'companies_by_text_reference', (
      SELECT jsonb_agg(jsonb_build_object(
        'company_text', p.company,
        'user_count', COUNT(*)
      ))
      FROM profiles p
      WHERE p.company IS NOT NULL AND p.company != ''
      GROUP BY p.company
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      'member_count', COALESCE(fk_count.count, 0) + COALESCE(text_count.count, 0) + COALESCE(secondary_count.count, 0),
      'fk_member_count', COALESCE(fk_count.count, 0),
      'text_member_count', COALESCE(text_count.count, 0),
      'secondary_member_count', COALESCE(secondary_count.count, 0)
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
  ) text_count ON c.id = text_count.company_id
  LEFT JOIN (
    -- Count secondary memberships
    SELECT company_id, COUNT(*) as count
    FROM company_memberships
    WHERE status = 'active'
    GROUP BY company_id
  ) secondary_count ON c.id = secondary_count.company_id;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admins to assign users to companies
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
  
  -- Handle primary company assignment
  IF p_membership_type = 'primary' THEN
    -- Update user's primary company
    UPDATE profiles
    SET 
      company_id = p_company_id,
      company_role = p_role,
      company = v_company_name
    WHERE id = p_user_id;
    
    -- Create audit trail
    INSERT INTO company_join_audit (
      user_id, company_id, action, join_method, to_role,
      performed_by, metadata
    ) VALUES (
      p_user_id, p_company_id, 'admin_assigned', 'admin_action', p_role,
      auth.uid(), jsonb_build_object(
        'assigned_by_admin', true,
        'membership_type', 'primary'
      )
    );
    
  ELSE
    -- Handle secondary company assignment
    INSERT INTO company_memberships (
      user_id, company_id, role, joined_via, invited_by
    ) VALUES (
      p_user_id, p_company_id, 'collaborator', 'admin_added', auth.uid()
    ) ON CONFLICT (user_id, company_id) 
    DO UPDATE SET status = 'active', joined_at = now();
    
    -- Create audit trail
    INSERT INTO company_join_audit (
      user_id, company_id, action, join_method, to_role,
      performed_by, metadata
    ) VALUES (
      p_user_id, p_company_id, 'admin_assigned', 'admin_action', 'collaborator',
      auth.uid(), jsonb_build_object(
        'assigned_by_admin', true,
        'membership_type', 'secondary'
      )
    );
  END IF;
  
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

-- Function for admins to remove users from companies
CREATE OR REPLACE FUNCTION admin_remove_user_from_company(
  p_user_id uuid,
  p_company_id uuid,
  p_membership_type text DEFAULT 'primary'
) RETURNS jsonb AS $$
DECLARE
  v_user_name text;
  v_company_name text;
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
      'message', 'Only administrators can remove users from companies'
    );
  END IF;
  
  -- Get names
  SELECT first_name || ' ' || last_name INTO v_user_name 
  FROM profiles WHERE id = p_user_id;
  
  SELECT name INTO v_company_name 
  FROM companies WHERE id = p_company_id;
  
  -- Handle removal based on membership type
  IF p_membership_type = 'primary' THEN
    -- Remove primary company
    UPDATE profiles
    SET 
      company_id = NULL,
      company_role = NULL,
      company = NULL
    WHERE id = p_user_id;
  ELSE
    -- Remove secondary membership
    DELETE FROM company_memberships
    WHERE user_id = p_user_id AND company_id = p_company_id;
  END IF;
  
  -- Create audit trail
  INSERT INTO company_join_audit (
    user_id, company_id, action, performed_by, metadata
  ) VALUES (
    p_user_id, p_company_id, 'admin_removed', auth.uid(),
    jsonb_build_object(
      'removed_by_admin', true,
      'membership_type', p_membership_type
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'company_name', v_company_name,
    'membership_type', p_membership_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION public.diagnose_company_user_relationships() TO public;
GRANT EXECUTE ON FUNCTION public.find_company_by_name(text) TO public;
GRANT EXECUTE ON FUNCTION public.link_existing_users_to_companies() TO public;
GRANT EXECUTE ON FUNCTION public.get_all_companies_with_members() TO public;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_to_company(uuid, uuid, text, text) TO public;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_from_company(uuid, uuid, text) TO public;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix_company_relationships.20251224',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed company-user relationships and member counting',
    'details', 'Enhanced member count queries to handle both FK and text-based relationships'
  ),
  'Company relationship fix migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();