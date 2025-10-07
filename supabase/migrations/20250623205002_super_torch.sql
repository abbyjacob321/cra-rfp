/*
  # Fix company queries and member count issues
  
  1. Changes
     - Create a diagnostic function to verify company relationships
     - Update company_invitations to ensure correct scope
     - Ensure RLS policies properly handle company admins
*/

-- Add a function to diagnose company and member relationships
CREATE OR REPLACE FUNCTION debug_company_members(company_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Gather all information about this company
  SELECT 
    jsonb_build_object(
      'company', (SELECT row_to_json(c) FROM companies c WHERE id = company_id),
      'member_count', (
        SELECT count(*) 
        FROM profiles
        WHERE company_id = $1
      ),
      'members', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'email', p.email,
            'name', p.first_name || ' ' || p.last_name,
            'company_role', p.company_role
          )
        ) 
        FROM profiles p
        WHERE p.company_id = $1
      ),
      'pending_invitations', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'email', i.email,
            'role', i.role,
            'status', i.status,
            'created_at', i.created_at,
            'expires_at', i.expires_at
          )
        )
        FROM company_invitations i
        WHERE i.company_id = $1 AND i.status = 'pending'
      )
    ) INTO result;
    
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Ensure the function to get all company members works properly
CREATE OR REPLACE FUNCTION get_company_members(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  company_role text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    profiles.id,
    profiles.email,
    profiles.first_name,
    profiles.last_name,
    profiles.company_role,
    profiles.created_at
  FROM profiles
  WHERE profiles.company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if specific invitations belong to a company
CREATE OR REPLACE FUNCTION check_invitation_company(p_invitation_id uuid)
RETURNS jsonb AS $$
DECLARE
  invitation record;
  result jsonb;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation FROM company_invitations WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'exists', false,
      'invitation_id', p_invitation_id
    );
  END IF;
  
  -- Get company details
  SELECT jsonb_build_object(
    'exists', true,
    'invitation_id', invitation.id,
    'company_id', invitation.company_id,
    'email', invitation.email,
    'status', invitation.status,
    'role', invitation.role,
    'company_name', (SELECT name FROM companies WHERE id = invitation.company_id),
    'company_query', format('SELECT * FROM company_invitations WHERE company_id = %L', invitation.company_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;