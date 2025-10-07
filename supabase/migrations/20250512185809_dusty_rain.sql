-- Update create_company function to include state_of_incorporation parameter
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
BEGIN
  -- Create the company
  INSERT INTO companies (
    name,
    website,
    address,
    phone,
    industry,
    description,
    created_by,
    state_of_incorporation
  ) VALUES (
    p_name,
    p_website,
    p_address,
    p_phone,
    p_industry,
    p_description,
    auth.uid(),
    p_state_of_incorporation
  ) RETURNING id INTO v_company_id;
  
  -- Update user profile to set company_id and company_role
  UPDATE profiles
  SET 
    company_id = v_company_id,
    company_role = 'admin',
    company = p_name -- Also update the legacy company name field
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
  'migration.company.20250512214355',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Updated create_company function',
    'details', 'Added state_of_incorporation parameter to create_company function'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();