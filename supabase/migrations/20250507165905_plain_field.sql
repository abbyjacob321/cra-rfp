-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  address text,
  phone text,
  logo_url text,
  industry text,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Add company_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_role text CHECK (company_role IN ('admin', 'member', 'pending'));

-- First make sure status column exists in rfp_nda_access table
-- This was missing in the original migration and causing the error
ALTER TABLE rfp_nda_access ADD COLUMN IF NOT EXISTS status text DEFAULT 'signed' CHECK (status IN ('signed', 'approved', 'rejected'));

-- Create company_ndas table for NDAs signed at the company level
CREATE TABLE IF NOT EXISTS company_ndas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  signed_by uuid NOT NULL REFERENCES profiles(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  title text,
  signature_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'signed' CHECK (status IN ('signed', 'approved', 'rejected')),
  countersigned_by uuid REFERENCES profiles(id),
  countersigned_at timestamptz,
  countersigner_name text,
  countersigner_title text,
  countersignature_data jsonb DEFAULT '{}'::jsonb,
  rejection_reason text,
  rejection_date timestamptz,
  rejected_by uuid REFERENCES profiles(id),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, rfp_id)
);

-- Create company_members table for tracking pending invitations
CREATE TABLE IF NOT EXISTS company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  inviter_id uuid NOT NULL REFERENCES profiles(id),
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'rejected')),
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Create company_access table for tracking which companies have access to which RFPs
CREATE TABLE IF NOT EXISTS company_rfp_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES profiles(id),
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, rfp_id)
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ndas ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_rfp_access ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(name);
CREATE INDEX IF NOT EXISTS company_ndas_company_id_idx ON company_ndas(company_id);
CREATE INDEX IF NOT EXISTS company_ndas_rfp_id_idx ON company_ndas(rfp_id);
CREATE INDEX IF NOT EXISTS company_ndas_status_idx ON company_ndas(status);
CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON profiles(company_id);
CREATE INDEX IF NOT EXISTS profiles_company_role_idx ON profiles(company_role);

-- RLS Policies for companies
CREATE POLICY "Users can view companies they belong to"
ON companies
FOR SELECT
TO authenticated
USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL)
  OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Company admins can update their company"
ON companies
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_role = 'admin')
);

-- RLS Policies for company_ndas
CREATE POLICY "Users can view NDAs for their company"
ON company_ndas
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL)
  OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Policy for company admins to sign NDAs
CREATE POLICY "Company admins can sign NDAs"
ON company_ndas
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_role = 'admin')
);

-- RLS Policies for company_invitations
CREATE POLICY "Company admins can view and manage invitations"
ON company_invitations
FOR ALL
TO authenticated
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_role = 'admin')
);

-- RLS Policies for company_rfp_access
CREATE POLICY "Users can view access records for their company"
ON company_rfp_access
FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL)
  OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Function to create a company and set creator as admin
CREATE OR REPLACE FUNCTION create_company(
  p_name text,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_description text DEFAULT NULL
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
    created_by
  ) VALUES (
    p_name,
    p_website,
    p_address,
    p_phone,
    p_industry,
    p_description,
    auth.uid()
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

-- Function to invite a user to a company
CREATE OR REPLACE FUNCTION invite_to_company(
  p_company_id uuid,
  p_email text,
  p_role text DEFAULT 'member'
) RETURNS jsonb AS $$
DECLARE
  v_invitation_id uuid;
  v_token text;
  v_expires_at timestamptz;
  v_company_name text;
  v_result jsonb;
BEGIN
  -- Check if user is a company admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND company_id = p_company_id 
    AND company_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only company admins can invite users'
    );
  END IF;
  
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  -- Generate invitation token
  v_token = encode(gen_random_bytes(24), 'hex');
  v_expires_at = now() + interval '7 days';
  
  -- Create invitation
  INSERT INTO company_invitations (
    company_id,
    email,
    inviter_id,
    role,
    token,
    expires_at
  ) VALUES (
    p_company_id,
    p_email,
    auth.uid(),
    p_role,
    v_token,
    v_expires_at
  ) ON CONFLICT (company_id, email)
  DO UPDATE SET
    role = p_role,
    token = v_token,
    expires_at = v_expires_at,
    status = 'pending'
  RETURNING id INTO v_invitation_id;
  
  -- Create a notification email
  -- In production, you would send an email here
  
  -- Return success result
  SELECT jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'company_name', v_company_name,
    'email', p_email,
    'token', v_token,
    'expires_at', v_expires_at,
    'role', p_role,
    'message', format('Invitation sent to %s for %s', p_email, v_company_name)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a company invitation
CREATE OR REPLACE FUNCTION accept_company_invitation(
  p_token text
) RETURNS jsonb AS $$
DECLARE
  v_invitation record;
  v_result jsonb;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation FROM company_invitations 
  WHERE token = p_token 
  AND status = 'pending'
  AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Invalid or expired invitation'
    );
  END IF;
  
  -- Check if email matches current user
  IF v_invitation.email != auth.jwt()->>'email' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This invitation was sent to a different email address'
    );
  END IF;
  
  -- Update user's profile
  UPDATE profiles
  SET 
    company_id = v_invitation.company_id,
    company_role = v_invitation.role,
    company = (SELECT name FROM companies WHERE id = v_invitation.company_id)
  WHERE id = auth.uid();
  
  -- Update invitation status
  UPDATE company_invitations
  SET status = 'accepted'
  WHERE id = v_invitation.id;
  
  -- Get company name
  SELECT jsonb_build_object(
    'success', true,
    'company_id', v_invitation.company_id,
    'company_name', (SELECT name FROM companies WHERE id = v_invitation.company_id),
    'role', v_invitation.role,
    'message', format('You have joined %s as a %s', 
      (SELECT name FROM companies WHERE id = v_invitation.company_id),
      v_invitation.role
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sign an NDA on behalf of a company
CREATE OR REPLACE FUNCTION sign_company_nda(
  p_company_id uuid,
  p_rfp_id uuid,
  p_full_name text,
  p_title text,
  p_signature_data jsonb
) RETURNS jsonb AS $$
DECLARE
  v_nda_id uuid;
  v_result jsonb;
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
      'message', 'Only company admins can sign NDAs on behalf of the company'
    );
  END IF;
  
  -- Get company name
  SELECT name INTO v_company_name FROM companies WHERE id = p_company_id;
  
  -- Insert or update the NDA
  INSERT INTO company_ndas (
    company_id,
    rfp_id,
    signed_by,
    full_name,
    title,
    signature_data,
    status,
    ip_address,
    user_agent
  ) VALUES (
    p_company_id,
    p_rfp_id,
    auth.uid(),
    p_full_name,
    p_title,
    p_signature_data,
    'signed',
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  ) 
  ON CONFLICT (company_id, rfp_id) 
  DO UPDATE SET
    signed_by = auth.uid(),
    full_name = p_full_name,
    title = p_title,
    signature_data = p_signature_data,
    status = 'signed',
    signed_at = now(),
    ip_address = current_setting('request.headers', true)::json->>'x-forwarded-for',
    user_agent = current_setting('request.headers', true)::json->>'user-agent'
  RETURNING id INTO v_nda_id;
  
  -- Notify admins of new company NDA signature
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT
    profiles.id,
    'New Company NDA Signature',
    format('A new NDA has been signed for "%s" by %s on behalf of %s', 
      (SELECT title FROM rfps WHERE id = p_rfp_id),
      p_full_name,
      v_company_name
    ),
    'nda_signed',
    p_rfp_id
  FROM profiles
  WHERE profiles.role = 'admin';
  
  -- Return result
  SELECT jsonb_build_object(
    'success', true,
    'nda_id', v_nda_id,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'rfp_id', p_rfp_id,
    'rfp_title', (SELECT title FROM rfps WHERE id = p_rfp_id),
    'message', format('NDA signed successfully on behalf of %s', v_company_name)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to countersign a company NDA
CREATE OR REPLACE FUNCTION countersign_company_nda(
  p_nda_id uuid,
  p_countersigner_name text,
  p_countersigner_title text,
  p_countersignature_data jsonb
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_company_id uuid;
  v_rfp_id uuid;
  v_company_name text;
  v_rfp_title text;
BEGIN
  -- Check if user is authorized
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'client_reviewer')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only admins and client reviewers can countersign NDAs'
    );
  END IF;
  
  -- Update the NDA
  UPDATE company_ndas
  SET 
    status = 'approved',
    countersigned_by = auth.uid(),
    countersigned_at = now(),
    countersigner_name = p_countersigner_name,
    countersigner_title = p_countersigner_title,
    countersignature_data = p_countersignature_data
  WHERE id = p_nda_id
  AND status = 'signed'
  RETURNING 
    company_id, 
    rfp_id,
    to_jsonb(company_ndas.*) INTO v_company_id, v_rfp_id, v_result;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'NDA not found or not in signable state'
    );
  END IF;
  
  -- Get company and RFP names
  SELECT name INTO v_company_name FROM companies WHERE id = v_company_id;
  SELECT title INTO v_rfp_title FROM rfps WHERE id = v_rfp_id;
  
  -- Create notifications for company members
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT 
    profiles.id,
    'Company NDA Approved',
    format('The NDA for "%s" signed on behalf of %s has been approved', 
      v_rfp_title,
      v_company_name
    ),
    'nda_approved',
    v_rfp_id
  FROM profiles
  WHERE profiles.company_id = v_company_id;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'nda_id', p_nda_id,
    'company_id', v_company_id,
    'company_name', v_company_name,
    'rfp_id', v_rfp_id,
    'rfp_title', v_rfp_title,
    'message', format('NDA for %s successfully countersigned', v_company_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to an RFP via company NDA
CREATE OR REPLACE FUNCTION check_company_nda_access(
  p_rfp_id uuid
) RETURNS boolean AS $$
DECLARE
  v_company_id uuid;
  v_has_access boolean;
BEGIN
  -- Get user's company_id
  SELECT company_id INTO v_company_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if company has an approved NDA for this RFP
  SELECT EXISTS (
    SELECT 1
    FROM company_ndas
    WHERE company_id = v_company_id
    AND rfp_id = p_rfp_id
    AND status = 'approved'
  ) INTO v_has_access;
  
  RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update document access policy to consider company NDAs
DROP POLICY IF EXISTS "Users can access documents if they have signed NDA" ON documents;

CREATE POLICY "Users can access documents if they have signed NDA"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Document doesn't require NDA
  NOT requires_nda 
  OR
  -- User has personally signed an NDA
  EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_nda_access.rfp_id = documents.rfp_id
    AND rfp_nda_access.user_id = auth.uid()
  )
  OR
  -- User's company has an approved NDA
  check_company_nda_access(documents.rfp_id)
);