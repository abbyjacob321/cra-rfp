/*
  # Fix company member count and RLS policies
  
  1. Changes
     - Add a function to fix company member count display
     - Ensure company creation and update operations work correctly
     - Add diagnostic functions to troubleshoot company data
     
  2. Security
     - Ensures proper access control
     - Maintains RLS protection
*/

-- Ensure the INSERT policy for companies exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' AND policyname = 'Authenticated users can create companies'
  ) THEN
    CREATE POLICY "Authenticated users can create companies"
    ON companies
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- Ensure the UPDATE policy for companies exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' AND policyname = 'Company admins can update their company'
  ) THEN
    CREATE POLICY "Company admins can update their company"
    ON companies
    FOR UPDATE
    TO authenticated
    USING (
      id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid() AND company_role = 'admin'
      )
    );
  END IF;
END $$;

-- Create a function to diagnose and fix company issues
CREATE OR REPLACE FUNCTION diagnose_company_issues(p_company_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  company_info record;
  member_count int;
  admin_count int;
BEGIN
  -- Get basic company info
  SELECT * INTO company_info FROM companies WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company not found',
      'company_id', p_company_id
    );
  END IF;
  
  -- Count company members
  SELECT COUNT(*) INTO member_count 
  FROM profiles 
  WHERE company_id = p_company_id;
  
  -- Count company admins
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE company_id = p_company_id 
  AND company_role = 'admin';
  
  -- Build diagnostic result
  result := jsonb_build_object(
    'company_id', p_company_id,
    'company_name', company_info.name,
    'company_created', company_info.created_at,
    'created_by', company_info.created_by,
    'creator_in_company', EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = company_info.created_by 
      AND company_id = p_company_id
    ),
    'member_count', member_count,
    'admin_count', admin_count,
    'members', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'name', p.first_name || ' ' || p.last_name,
        'company_role', p.company_role
      ))
      FROM profiles p
      WHERE p.company_id = p_company_id
    ),
    'pending_invitations', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'email', ci.email,
        'created_at', ci.created_at,
        'expires_at', ci.expires_at,
        'status', ci.status
      ))
      FROM company_invitations ci
      WHERE ci.company_id = p_company_id
      AND ci.status = 'pending'
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix company member relationships
CREATE OR REPLACE FUNCTION fix_company_creator_relationship(p_company_id uuid)
RETURNS jsonb AS $$
DECLARE
  creator_id uuid;
  creator_profile record;
  result jsonb;
BEGIN
  -- Get the creator ID from companies table
  SELECT created_by INTO creator_id 
  FROM companies 
  WHERE id = p_company_id;
  
  IF creator_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company has no creator specified',
      'company_id', p_company_id
    );
  END IF;
  
  -- Get creator profile
  SELECT * INTO creator_profile 
  FROM profiles 
  WHERE id = creator_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Creator profile not found',
      'company_id', p_company_id,
      'creator_id', creator_id
    );
  END IF;
  
  -- Update creator's profile to link to this company as admin if not already linked
  IF creator_profile.company_id IS NULL OR creator_profile.company_id != p_company_id THEN
    UPDATE profiles
    SET 
      company_id = p_company_id,
      company_role = 'admin',
      company = (SELECT name FROM companies WHERE id = p_company_id)
    WHERE id = creator_id;
    
    result := jsonb_build_object(
      'success', true,
      'message', 'Creator relationship fixed',
      'company_id', p_company_id,
      'creator_id', creator_id,
      'creator_name', creator_profile.first_name || ' ' || creator_profile.last_name,
      'action', 'linked_creator_to_company'
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'message', 'Creator already properly linked to company',
      'company_id', p_company_id,
      'creator_id', creator_id,
      'creator_name', creator_profile.first_name || ' ' || creator_profile.last_name,
      'action', 'no_action_needed'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;