/*
  # Add NDA signing functionality
  
  1. Changes
    - Add signature fields to rfp_nda_access table
    - Add signature verification
    - Add audit trail for NDA signatures
*/

-- Add signature fields to rfp_nda_access
ALTER TABLE rfp_nda_access 
ADD COLUMN IF NOT EXISTS signature_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS full_name text NOT NULL,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS company text;

-- Create NDA audit trail table
CREATE TABLE IF NOT EXISTS nda_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nda_id uuid REFERENCES rfp_nda_access(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE nda_audit_trail ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for audit trail
CREATE POLICY "Admins can view audit trail"
ON nda_audit_trail
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to sign NDA
CREATE OR REPLACE FUNCTION sign_nda(
  p_rfp_id uuid,
  p_full_name text,
  p_title text,
  p_company text,
  p_signature_data jsonb
) RETURNS uuid AS $$
DECLARE
  v_nda_id uuid;
BEGIN
  -- Insert NDA signature record
  INSERT INTO rfp_nda_access (
    rfp_id,
    user_id,
    full_name,
    title,
    company,
    signature_data,
    ip_address,
    user_agent
  ) VALUES (
    p_rfp_id,
    auth.uid(),
    p_full_name,
    p_title,
    p_company,
    p_signature_data,
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  ) RETURNING id INTO v_nda_id;
  
  -- Create audit trail entry
  INSERT INTO nda_audit_trail (
    nda_id,
    action,
    metadata,
    created_by
  ) VALUES (
    v_nda_id,
    'signed',
    jsonb_build_object(
      'full_name', p_full_name,
      'title', p_title,
      'company', p_company,
      'ip_address', current_setting('request.headers')::json->>'x-forwarded-for',
      'user_agent', current_setting('request.headers')::json->>'user-agent',
      'timestamp', now()
    ),
    auth.uid()
  );
  
  RETURN v_nda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify NDA signature
CREATE OR REPLACE FUNCTION verify_nda_signature(
  p_nda_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'is_valid', true,
    'signed_by', full_name,
    'signed_at', signed_at,
    'company', company,
    'title', title,
    'verification_data', jsonb_build_object(
      'ip_address', ip_address,
      'user_agent', user_agent,
      'signature_data', signature_data
    )
  ) INTO v_result
  FROM rfp_nda_access
  WHERE id = p_nda_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;