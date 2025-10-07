/*
  # Improve Company Registration Workflow
  
  1. New Fields
    - Add verification fields to companies table
    - Add email domain tracking for suggestions
    - Add company metadata for better search
    
  2. Functions
    - Enhanced search with fuzzy matching
    - Email domain suggestion functionality
    - Company verification workflow
*/

-- Add verification and enhancement fields to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS verification_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS verification_completed_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verification_notes text,
ADD COLUMN IF NOT EXISTS email_domain text,
ADD COLUMN IF NOT EXISTS company_size text CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
ADD COLUMN IF NOT EXISTS founded_year integer,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS verified_badge boolean DEFAULT false;

-- Create index for email domain suggestions
CREATE INDEX IF NOT EXISTS companies_email_domain_idx ON companies(email_domain);
CREATE INDEX IF NOT EXISTS companies_verification_status_idx ON companies(verification_status);

-- Enhanced search function with fuzzy matching and domain suggestions
CREATE OR REPLACE FUNCTION enhanced_search_companies(
  search_term text,
  user_email text DEFAULT NULL,
  p_limit int DEFAULT 10
) 
RETURNS TABLE (
  id uuid, 
  name text, 
  website text, 
  industry text, 
  member_count bigint,
  verified_badge boolean,
  suggested_reason text,
  relevance_score int
) AS $$
DECLARE
  email_domain text;
BEGIN
  -- Extract domain from user email if provided
  IF user_email IS NOT NULL THEN
    email_domain := split_part(user_email, '@', 2);
  END IF;
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.website,
    c.industry,
    COUNT(p.id) AS member_count,
    c.verified_badge,
    CASE 
      WHEN email_domain IS NOT NULL AND c.email_domain = email_domain THEN 'Matches your email domain'
      WHEN c.name ILIKE search_term || '%' THEN 'Exact name match'
      WHEN c.industry ILIKE '%' || search_term || '%' THEN 'Industry match'
      ELSE 'Name contains search term'
    END AS suggested_reason,
    CASE 
      WHEN email_domain IS NOT NULL AND c.email_domain = email_domain THEN 1
      WHEN c.name ILIKE search_term || '%' THEN 2
      WHEN c.name ILIKE '%' || search_term || '%' THEN 3
      WHEN c.industry ILIKE '%' || search_term || '%' THEN 4
      ELSE 5
    END AS relevance_score
  FROM 
    companies c
  LEFT JOIN 
    profiles p ON c.id = p.company_id
  WHERE 
    c.name ILIKE '%' || search_term || '%'
    OR c.industry ILIKE '%' || search_term || '%'
    OR (email_domain IS NOT NULL AND c.email_domain = email_domain)
  GROUP BY 
    c.id, c.name, c.website, c.industry, c.verified_badge, c.email_domain
  ORDER BY 
    relevance_score ASC,
    member_count DESC,
    c.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get email domain suggestions
CREATE OR REPLACE FUNCTION get_email_domain_suggestions(
  user_email text,
  p_limit int DEFAULT 3
)
RETURNS jsonb AS $$
DECLARE
  email_domain text;
  suggestions jsonb;
BEGIN
  -- Extract domain from user email
  email_domain := split_part(user_email, '@', 2);
  
  -- Skip common email providers
  IF email_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com') THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Find companies with matching email domain
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'website', c.website,
      'industry', c.industry,
      'member_count', COALESCE(member_counts.count, 0),
      'verified_badge', c.verified_badge,
      'suggested_reason', 'Matches your email domain (' || email_domain || ')'
    )
  )
  INTO suggestions
  FROM companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*) as count
    FROM profiles
    WHERE company_id IS NOT NULL
    GROUP BY company_id
  ) member_counts ON c.id = member_counts.company_id
  WHERE c.email_domain = email_domain
  ORDER BY member_counts.count DESC NULLS LAST, c.verified_badge DESC
  LIMIT p_limit;
  
  RETURN COALESCE(suggestions, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request company verification
CREATE OR REPLACE FUNCTION request_company_verification(
  p_company_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
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
      'message', 'Only company administrators can request verification'
    );
  END IF;
  
  -- Update company to request verification
  UPDATE companies
  SET 
    verification_status = 'pending',
    verification_requested_at = now()
  WHERE id = p_company_id
  AND verification_status = 'unverified';
  
  -- Notify platform administrators
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT 
    profiles.id,
    'Company Verification Request',
    'Company "' || (SELECT name FROM companies WHERE id = p_company_id) || '" has requested verification',
    'company_verification_request',
    p_company_id
  FROM profiles
  WHERE role = 'admin';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification request submitted successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the create_company function to extract email domain
CREATE OR REPLACE FUNCTION create_company(
  p_name text,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_state_of_incorporation text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
  v_email_domain text;
  v_user_email text;
BEGIN
  -- Get user's email to extract domain
  SELECT email INTO v_user_email FROM profiles WHERE id = auth.uid();
  
  IF v_user_email IS NOT NULL THEN
    v_email_domain := split_part(v_user_email, '@', 2);
  END IF;
  
  -- Create the company
  INSERT INTO companies (
    name,
    website,
    address,
    phone,
    industry,
    description,
    created_by,
    state_of_incorporation,
    email_domain
  ) VALUES (
    p_name,
    p_website,
    p_address,
    p_phone,
    p_industry,
    p_description,
    auth.uid(),
    p_state_of_incorporation,
    v_email_domain
  ) RETURNING id INTO v_company_id;
  
  -- Update user profile to set company_id and company_role
  UPDATE profiles
  SET 
    company_id = v_company_id,
    company_role = 'admin',
    company = p_name
  WHERE id = auth.uid();
  
  -- Return success result
  SELECT jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', p_name,
    'role', 'admin',
    'message', 'Company created successfully and you have been set as the admin.'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.enhance.20250623211000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Enhanced company registration workflow',
    'details', 'Added verification system, enhanced search, and email domain suggestions'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();