/*
  # Hybrid Company Management System
  
  1. New Features
    - Auto-join based on email domain verification
    - Multiple company memberships (primary + secondary)
    - Admin controls for auto-join settings
    - Complete audit trail for all company joins
    
  2. Schema Updates
    - Add auto-join fields to companies table
    - Create secondary company memberships table
    - Fix member count queries
    - Add audit and tracking fields
    
  3. Migration Strategy
    - Preserve existing companies
    - Reset company relationships for clean slate
    - Add new auto-join functionality
*/

-- Add auto-join and domain management fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS auto_join_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS verified_domain text,
ADD COLUMN IF NOT EXISTS blocked_domains text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS domain_verification_method text DEFAULT 'admin_confirmed' CHECK (domain_verification_method IN ('admin_confirmed', 'website_verified', 'unverified'));

-- Create secondary company memberships table
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
  action text NOT NULL CHECK (action IN ('joined', 'left', 'promoted', 'demoted', 'blocked', 'auto_joined')),
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
  USING (auth.jwt()->>'role' = 'admin');

-- RLS Policies for audit trail
CREATE POLICY "Users can view their own audit trail"
  ON company_join_audit FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit"
  ON company_join_audit FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin');

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

-- Enhanced create_company function with auto-join setup
CREATE OR REPLACE FUNCTION create_company_with_autojoin(
  p_name text,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_state_of_incorporation text DEFAULT NULL,
  p_auto_join_enabled boolean DEFAULT true,
  p_blocked_domains text[] DEFAULT '{}'
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_user_email text;
  v_email_domain text;
  v_is_corporate boolean;
BEGIN
  -- Get user's email to extract domain
  SELECT email INTO v_user_email FROM profiles WHERE id = auth.uid();
  
  IF v_user_email IS NOT NULL THEN
    v_email_domain := split_part(v_user_email, '@', 2);
    v_is_corporate := is_corporate_domain(v_email_domain);
  END IF;
  
  -- Create the company
  INSERT INTO companies (
    name, website, address, phone, industry, description,
    created_by, state_of_incorporation, email_domain,
    auto_join_enabled, verified_domain, blocked_domains,
    domain_verification_method
  ) VALUES (
    p_name, p_website, p_address, p_phone, p_industry, p_description,
    auth.uid(), p_state_of_incorporation, v_email_domain,
    p_auto_join_enabled AND v_is_corporate, -- Only enable for corporate domains
    CASE WHEN v_is_corporate THEN v_email_domain ELSE NULL END,
    p_blocked_domains,
    CASE WHEN v_is_corporate THEN 'admin_confirmed' ELSE 'unverified' END
  ) RETURNING id INTO v_company_id;
  
  -- Update user profile to set company_id and company_role
  UPDATE profiles
  SET 
    company_id = v_company_id,
    company_role = 'admin',
    company = p_name
  WHERE id = auth.uid();
  
  -- Create audit trail entry
  INSERT INTO company_join_audit (
    user_id, company_id, action, join_method, to_role,
    performed_by, metadata
  ) VALUES (
    auth.uid(), v_company_id, 'joined', 'admin_action', 'admin',
    auth.uid(), jsonb_build_object(
      'company_created', true,
      'auto_join_enabled', p_auto_join_enabled,
      'verified_domain', v_email_domain,
      'is_corporate_domain', v_is_corporate
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', p_name,
    'role', 'admin',
    'auto_join_enabled', p_auto_join_enabled AND v_is_corporate,
    'verified_domain', CASE WHEN v_is_corporate THEN v_email_domain ELSE NULL END,
    'message', 'Company created successfully. You are now the company administrator.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find companies with auto-join enabled for a specific domain
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

-- Function to add secondary company membership
CREATE OR REPLACE FUNCTION add_secondary_company_membership(
  p_user_id uuid,
  p_company_id uuid,
  p_invited_by uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_name text;
  v_user_name text;
BEGIN
  -- Check authorization (admin or company admin)
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND company_id = p_company_id
      AND company_role = 'admin'
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only administrators or company admins can add secondary memberships'
    );
  END IF;
  
  -- Get names for notifications
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  SELECT first_name || ' ' || last_name INTO v_user_name FROM profiles WHERE id = p_user_id;
  
  -- Insert secondary membership
  INSERT INTO company_memberships (
    user_id, company_id, role, invited_by, joined_via
  ) VALUES (
    p_user_id, p_company_id, 'collaborator', 
    COALESCE(p_invited_by, auth.uid()),
    CASE WHEN p_invited_by IS NOT NULL THEN 'invitation' ELSE 'admin_added' END
  ) ON CONFLICT (user_id, company_id) 
  DO UPDATE SET 
    status = 'active',
    joined_at = now();
  
  -- Create audit trail
  INSERT INTO company_join_audit (
    user_id, company_id, action, join_method, to_role,
    performed_by, metadata
  ) VALUES (
    p_user_id, p_company_id, 'joined', 'admin_action', 'collaborator',
    auth.uid(), jsonb_build_object(
      'membership_type', 'secondary',
      'invited_by', p_invited_by
    )
  );
  
  -- Notify user
  INSERT INTO notifications (
    user_id, title, message, type, reference_id
  ) VALUES (
    p_user_id,
    'Added as Collaborator',
    'You have been added as a collaborator to ' || v_company_name,
    'collaborator_added',
    p_company_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'company_name', v_company_name,
    'role', 'collaborator'
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
  -- Check if user is company admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = p_company_id
    AND company_role = 'admin'
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

-- Function to get comprehensive company member information
CREATE OR REPLACE FUNCTION get_company_members_with_details(p_company_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check access permissions
  IF NOT (
    (auth.jwt()->>'role' = 'admin') OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (company_id = p_company_id OR company_role = 'admin')
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Access denied'
    );
  END IF;
  
  -- Get primary members
  WITH primary_members AS (
    SELECT 
      p.id, p.email, p.first_name, p.last_name,
      p.company_role, p.created_at, 'primary' as membership_type,
      cja.join_method, cja.created_at as joined_at
    FROM profiles p
    LEFT JOIN company_join_audit cja ON (
      cja.user_id = p.id 
      AND cja.company_id = p_company_id 
      AND cja.action = 'joined'
    )
    WHERE p.company_id = p_company_id
  ),
  secondary_members AS (
    SELECT 
      p.id, p.email, p.first_name, p.last_name,
      cm.role as company_role, cm.created_at, 'secondary' as membership_type,
      cm.joined_via as join_method, cm.joined_at
    FROM company_memberships cm
    JOIN profiles p ON cm.user_id = p.id
    WHERE cm.company_id = p_company_id AND cm.status = 'active'
  ),
  all_members AS (
    SELECT * FROM primary_members
    UNION ALL
    SELECT * FROM secondary_members
  )
  SELECT jsonb_build_object(
    'company_id', p_company_id,
    'total_members', COUNT(*),
    'primary_members', COUNT(*) FILTER (WHERE membership_type = 'primary'),
    'secondary_members', COUNT(*) FILTER (WHERE membership_type = 'secondary'),
    'members', jsonb_agg(
      jsonb_build_object(
        'id', id,
        'email', email,
        'name', first_name || ' ' || last_name,
        'company_role', company_role,
        'membership_type', membership_type,
        'join_method', join_method,
        'joined_at', joined_at
      ) ORDER BY 
        CASE WHEN membership_type = 'primary' THEN 1 ELSE 2 END,
        CASE WHEN company_role = 'admin' THEN 1 ELSE 2 END,
        first_name
    )
  ) INTO v_result
  FROM all_members;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'company_id', p_company_id,
    'total_members', 0,
    'primary_members', 0,
    'secondary_members', 0,
    'members', '[]'::jsonb
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up existing company relationships (migration helper)
CREATE OR REPLACE FUNCTION reset_company_relationships()
RETURNS jsonb AS $$
DECLARE
  v_affected_users integer;
  v_companies_count integer;
BEGIN
  -- Only allow admins to run this
  IF NOT (auth.jwt()->>'role' = 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only platform administrators can reset company relationships'
    );
  END IF;
  
  -- Count what we're about to change
  SELECT COUNT(*) INTO v_affected_users FROM profiles WHERE company_id IS NOT NULL;
  SELECT COUNT(*) INTO v_companies_count FROM companies;
  
  -- Clear all company relationships from profiles
  UPDATE profiles 
  SET 
    company_id = NULL,
    company_role = NULL
  WHERE company_id IS NOT NULL;
  
  -- Clear secondary memberships
  DELETE FROM company_memberships;
  
  -- Clear join requests
  DELETE FROM company_join_requests;
  
  -- Clear invitations
  DELETE FROM company_invitations;
  
  -- Log the reset
  INSERT INTO company_join_audit (
    user_id, company_id, action, performed_by, metadata
  ) VALUES (
    auth.uid(), NULL, 'system_reset', auth.uid(),
    jsonb_build_object(
      'affected_users', v_affected_users,
      'companies_preserved', v_companies_count,
      'reset_timestamp', now(),
      'reset_reason', 'migration_to_hybrid_system'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_users', v_affected_users,
    'companies_preserved', v_companies_count,
    'message', 'Company relationships reset successfully. Companies preserved.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the reset (since you approved clearing relationships)
SELECT reset_company_relationships();

-- Update email_domain for existing companies based on creator's email
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

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.hybrid_company_system.20250106160000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Implemented hybrid company management system',
    'details', 'Added auto-join, multiple memberships, domain verification, and audit trail'
  ),
  'Hybrid company system migration'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();