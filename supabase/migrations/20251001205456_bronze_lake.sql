/*
  # Fix Company Management with Preserved Affiliations
  
  1. Changes
    - Fix company loading function that failed
    - Add admin functions to manage company affiliations
    - Add auto-join system while preserving existing relationships
    - Ensure accurate member counting
    
  2. Features
    - Admins can assign users to companies
    - Auto-join system for verified domains
    - Multiple company membership support
    - Complete audit trail
*/

-- First, ensure we have the proper function to get companies with member counts
-- This fixes the "failed to load companies" error
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
  
  -- Get all companies with accurate member counts
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
      'member_count', COALESCE(primary_count.count, 0) + COALESCE(secondary_count.count, 0),
      'primary_member_count', COALESCE(primary_count.count, 0),
      'secondary_member_count', COALESCE(secondary_count.count, 0)
    ) ORDER BY c.created_at DESC
  )
  INTO v_result
  FROM companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*) as count
    FROM profiles
    WHERE company_id IS NOT NULL
    GROUP BY company_id
  ) primary_count ON c.id = primary_count.company_id
  LEFT JOIN (
    SELECT company_id, COUNT(*) as count
    FROM company_memberships
    WHERE status = 'active'
    GROUP BY company_id
  ) secondary_count ON c.id = secondary_count.company_id;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add the missing auto-join fields to companies table if they don't exist
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS auto_join_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS verified_domain text,
ADD COLUMN IF NOT EXISTS blocked_domains text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS domain_verification_method text DEFAULT 'admin_confirmed' CHECK (domain_verification_method IN ('admin_confirmed', 'website_verified', 'unverified'));

-- Create secondary company memberships table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'collaborator' CHECK (role IN ('collaborator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  joined_via text DEFAULT 'manual' CHECK (joined_via IN ('auto_domain', 'invitation', 'manual_request', 'admin_added')),
  invited_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create company join audit table for complete tracking
CREATE TABLE IF NOT EXISTS company_join_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  action text NOT NULL CHECK (action IN ('joined', 'left', 'promoted', 'demoted', 'blocked', 'auto_joined', 'admin_assigned')),
  join_method text CHECK (join_method IN ('auto_domain', 'invitation', 'manual_request', 'admin_action')),
  from_role text,
  to_role text,
  performed_by uuid REFERENCES profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS companies_auto_join_enabled_idx ON companies(auto_join_enabled);
CREATE INDEX IF NOT EXISTS companies_verified_domain_idx ON companies(verified_domain);
CREATE INDEX IF NOT EXISTS company_memberships_user_id_idx ON company_memberships(user_id);
CREATE INDEX IF NOT EXISTS company_memberships_company_id_idx ON company_memberships(company_id);
CREATE INDEX IF NOT EXISTS company_join_audit_user_id_idx ON company_join_audit(user_id);
CREATE INDEX IF NOT EXISTS company_join_audit_company_id_idx ON company_join_audit(company_id);

-- Enable RLS
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_join_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_memberships
CREATE POLICY "Users can view their own memberships"
  ON company_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Company admins can view company memberships"
  ON company_memberships FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND company_role = 'admin'
    )
  );

CREATE POLICY "Admins can view all memberships"
  ON company_memberships FOR ALL TO authenticated
  USING ((auth.jwt()->>'role' = 'admin'));

-- RLS Policies for audit trail
CREATE POLICY "Users can view their own audit trail"
  ON company_join_audit FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit"
  ON company_join_audit FOR ALL TO authenticated
  USING ((auth.jwt()->>'role' = 'admin'));

-- Function to detect corporate email domains (exclude consumer domains)
CREATE OR REPLACE FUNCTION is_corporate_domain(email_domain text)
RETURNS boolean AS $$
DECLARE
  consumer_domains text[] := ARRAY[
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'tutanota.com', 'yandex.com',
    'mail.ru', 'qq.com', '163.com', 'sina.com'
  ];
BEGIN
  RETURN NOT (email_domain = ANY(consumer_domains));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Admin function to assign user to company
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
      p_user_id, p_company_id, 'joined', 'admin_action', p_role,
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
      p_user_id, p_company_id, 'joined', 'admin_action', 'collaborator',
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

-- Function to remove user from company
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
    p_user_id, p_company_id, 'left', auth.uid(),
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

-- Update existing companies to have auto-join settings based on their email domain
UPDATE companies 
SET 
  email_domain = split_part(p.email, '@', 2),
  verified_domain = CASE 
    WHEN is_corporate_domain(split_part(p.email, '@', 2)) 
    THEN split_part(p.email, '@', 2) 
    ELSE NULL 
  END,
  auto_join_enabled = CASE 
    WHEN is_corporate_domain(split_part(p.email, '@', 2)) 
    THEN true 
    ELSE false 
  END,
  domain_verification_method = CASE 
    WHEN is_corporate_domain(split_part(p.email, '@', 2)) 
    THEN 'admin_confirmed' 
    ELSE 'unverified' 
  END
FROM profiles p
WHERE companies.created_by = p.id
AND companies.email_domain IS NULL;

-- Function to find companies with auto-join enabled for a domain
CREATE OR REPLACE FUNCTION find_autojoin_companies(user_email text)
RETURNS jsonb AS $$
DECLARE
  v_email_domain text;
  v_companies jsonb;
BEGIN
  -- Extract domain
  v_email_domain := split_part(user_email, '@', 2);
  
  -- Skip if consumer domain
  IF NOT is_corporate_domain(v_email_domain) THEN
    RETURN jsonb_build_object(
      'matches', '[]'::jsonb,
      'reason', 'consumer_domain',
      'domain', v_email_domain
    );
  END IF;
  
  -- Find companies with auto-join enabled for this domain
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'industry', c.industry,
      'member_count', (
        SELECT COUNT(*) FROM profiles p 
        WHERE p.company_id = c.id
      ),
      'verified_domain', c.verified_domain,
      'auto_join_enabled', c.auto_join_enabled,
      'website', c.website,
      'description', c.description
    )
  )
  INTO v_companies
  FROM companies c
  WHERE c.auto_join_enabled = true
  AND c.verified_domain = v_email_domain
  AND NOT (v_email_domain = ANY(c.blocked_domains));
  
  RETURN jsonb_build_object(
    'matches', COALESCE(v_companies, '[]'::jsonb),
    'domain', v_email_domain,
    'is_corporate', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-join user to company during signup
CREATE OR REPLACE FUNCTION auto_join_company(
  p_company_id uuid,
  p_user_email text
) RETURNS jsonb AS $$
DECLARE
  v_company record;
  v_user_id uuid;
  v_email_domain text;
  v_user_name text;
BEGIN
  -- Get user ID from email
  SELECT id, first_name || ' ' || last_name INTO v_user_id, v_user_name
  FROM profiles WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;
  
  -- Extract domain
  v_email_domain := split_part(p_user_email, '@', 2);
  
  -- Get company details and verify auto-join eligibility
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Company not found'
    );
  END IF;
  
  -- Verify auto-join is enabled and domain matches
  IF NOT v_company.auto_join_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Auto-join is disabled for this company'
    );
  END IF;
  
  IF v_company.verified_domain != v_email_domain THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Email domain does not match company domain'
    );
  END IF;
  
  -- Check if domain is blocked
  IF v_email_domain = ANY(v_company.blocked_domains) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This email domain is blocked from auto-joining'
    );
  END IF;
  
  -- Update user's profile with primary company
  UPDATE profiles
  SET 
    company_id = p_company_id,
    company_role = 'member',
    company = v_company.name
  WHERE id = v_user_id;
  
  -- Create audit trail entry
  INSERT INTO company_join_audit (
    user_id, company_id, action, join_method, to_role,
    performed_by, metadata
  ) VALUES (
    v_user_id, p_company_id, 'auto_joined', 'auto_domain', 'member',
    v_user_id, jsonb_build_object(
      'email_domain', v_email_domain,
      'verified_domain', v_company.verified_domain,
      'auto_join_timestamp', now()
    )
  );
  
  -- Notify company admins of auto-join
  INSERT INTO notifications (
    user_id, title, message, type, reference_id
  )
  SELECT 
    p.id,
    'New Team Member Auto-Joined',
    v_user_name || ' (' || p_user_email || ') has automatically joined ' || v_company.name || ' via domain matching.',
    'auto_join_notification',
    p_company_id
  FROM profiles p
  WHERE p.company_id = p_company_id AND p.company_role = 'admin';
  
  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'company_name', v_company.name,
    'user_name', v_user_name,
    'role', 'member',
    'join_method', 'auto_domain',
    'message', 'Successfully auto-joined ' || v_company.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update company auto-join settings
CREATE OR REPLACE FUNCTION update_company_autojoin_settings(
  p_company_id uuid,
  p_auto_join_enabled boolean,
  p_blocked_domains text[] DEFAULT '{}'
) RETURNS jsonb AS $$
DECLARE
  v_company_name text;
BEGIN
  -- Check if user is company admin or platform admin
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        (company_id = p_company_id AND company_role = 'admin') OR
        role = 'admin'
      )
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company administrators can update auto-join settings'
    );
  END IF;
  
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  -- Update settings
  UPDATE companies
  SET 
    auto_join_enabled = p_auto_join_enabled,
    blocked_domains = p_blocked_domains,
    updated_at = now()
  WHERE id = p_company_id;
  
  -- Log the change
  INSERT INTO company_join_audit (
    user_id, company_id, action, performed_by, metadata
  ) VALUES (
    auth.uid(), p_company_id, 'settings_updated', auth.uid(),
    jsonb_build_object(
      'auto_join_enabled', p_auto_join_enabled,
      'blocked_domains', p_blocked_domains,
      'updated_at', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'company_name', v_company_name,
    'auto_join_enabled', p_auto_join_enabled,
    'blocked_domains', p_blocked_domains
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to make functions accessible
GRANT EXECUTE ON FUNCTION public.get_all_companies_with_members() TO public;
GRANT EXECUTE ON FUNCTION public.find_autojoin_companies(text) TO public;
GRANT EXECUTE ON FUNCTION public.auto_join_company(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_to_company(uuid, uuid, text, text) TO public;
GRANT EXECUTE ON FUNCTION public.admin_remove_user_from_company(uuid, uuid, text) TO public;
GRANT EXECUTE ON FUNCTION public.update_company_autojoin_settings(uuid, boolean, text[]) TO public;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix_company_management.20251224',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed company management with preserved affiliations',
    'details', 'Added auto-join system while preserving existing user-company relationships'
  ),
  'Company management fix migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();