/*
  # Add missing company management functions
  
  1. Functions
    - Get all companies with accurate member counts
    - Enhanced company search with multiple membership support
    - Company member details with primary/secondary distinction
*/

-- Function to get all companies with accurate member counts
CREATE OR REPLACE FUNCTION get_all_companies_with_members()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check admin access
  IF NOT (auth.jwt()->>'role' = 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Admin access required'
    );
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'website', c.website,
      'industry', c.industry,
      'address', c.address,
      'phone', c.phone,
      'state_of_incorporation', c.state_of_incorporation,
      'verification_status', c.verification_status,
      'auto_join_enabled', c.auto_join_enabled,
      'verified_domain', c.verified_domain,
      'blocked_domains', c.blocked_domains,
      'created_at', c.created_at,
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

-- Function to get company auto-join audit trail
CREATE OR REPLACE FUNCTION get_company_autojoin_audit(p_company_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check access (company admin or platform admin)
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
      'message', 'Access denied'
    );
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', cja.id,
      'action', cja.action,
      'join_method', cja.join_method,
      'user_name', p.first_name || ' ' || p.last_name,
      'user_email', p.email,
      'from_role', cja.from_role,
      'to_role', cja.to_role,
      'performed_by_name', CASE 
        WHEN performer.id IS NOT NULL THEN 
          performer.first_name || ' ' || performer.last_name 
        ELSE 'System' 
      END,
      'metadata', cja.metadata,
      'created_at', cja.created_at
    ) ORDER BY cja.created_at DESC
  )
  INTO v_result
  FROM company_join_audit cja
  JOIN profiles p ON cja.user_id = p.id
  LEFT JOIN profiles performer ON cja.performed_by = performer.id
  WHERE cja.company_id = p_company_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'audit_trail', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle user signup with auto-join check
CREATE OR REPLACE FUNCTION signup_with_autojoin_check(
  p_user_id uuid,
  p_email text
) RETURNS jsonb AS $$
DECLARE
  v_matches jsonb;
  v_auto_joined boolean := false;
  v_company_id uuid;
BEGIN
  -- Find auto-join opportunities
  SELECT find_autojoin_companies(p_email) INTO v_matches;
  
  -- If exactly one match, auto-join immediately
  IF jsonb_array_length(v_matches->'matches') = 1 THEN
    v_company_id := (v_matches->'matches'->0->>'id')::uuid;
    
    -- Auto-join the user
    PERFORM auto_join_company(v_company_id, p_email);
    v_auto_joined := true;
  END IF;
  
  RETURN jsonb_build_object(
    'auto_join_matches', v_matches,
    'auto_joined', v_auto_joined,
    'company_id', v_company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;