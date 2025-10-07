/*
  # RFP Invitation System

  1. New Tables
    - `rfp_invitations`
      - `id` (uuid, primary key)
      - `rfp_id` (uuid, foreign key to rfps)
      - `invited_by` (uuid, foreign key to profiles - admin who sent invitation)
      - `recipient_email` (text)
      - `recipient_user_id` (uuid, nullable - if inviting existing user)
      - `recipient_company_id` (uuid, nullable - if inviting existing company)
      - `invitation_type` ('user' | 'company' | 'email')
      - `status` ('pending' | 'accepted' | 'declined' | 'expired')
      - `message` (text, optional message from admin)
      - `token` (text, unique invitation token)
      - `expires_at` (timestamptz)
      - `accepted_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `rfp_invitations` table
    - Add policies for admins to manage invitations
    - Add policies for recipients to view their invitations

  3. Functions
    - Function to send RFP invitations
    - Function to accept RFP invitations
    - Function to check invitation status
*/

-- Create rfp_invitations table
CREATE TABLE IF NOT EXISTS rfp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES profiles(id),
  recipient_email text NOT NULL,
  recipient_user_id uuid REFERENCES profiles(id),
  recipient_company_id uuid REFERENCES companies(id),
  invitation_type text NOT NULL CHECK (invitation_type IN ('user', 'company', 'email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS rfp_invitations_rfp_id_idx ON rfp_invitations(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_invitations_recipient_email_idx ON rfp_invitations(recipient_email);
CREATE INDEX IF NOT EXISTS rfp_invitations_status_idx ON rfp_invitations(status);
CREATE INDEX IF NOT EXISTS rfp_invitations_token_idx ON rfp_invitations(token);
CREATE INDEX IF NOT EXISTS rfp_invitations_expires_at_idx ON rfp_invitations(expires_at);

-- Enable RLS
ALTER TABLE rfp_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all RFP invitations"
  ON rfp_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view invitations sent to them"
  ON rfp_invitations
  FOR SELECT
  TO authenticated
  USING (
    recipient_email = (
      SELECT email FROM profiles 
      WHERE profiles.id = auth.uid()
    ) OR
    recipient_user_id = auth.uid()
  );

-- Function to send RFP invitation
CREATE OR REPLACE FUNCTION send_rfp_invitation(
  p_rfp_id uuid,
  p_recipient_email text,
  p_invitation_type text DEFAULT 'email',
  p_recipient_user_id uuid DEFAULT NULL,
  p_recipient_company_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id uuid;
  v_token text;
  v_rfp_title text;
  v_client_name text;
  v_admin_name text;
  v_result json;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can send RFP invitations';
  END IF;
  
  -- Get RFP details
  SELECT title, client_name INTO v_rfp_title, v_client_name
  FROM rfps WHERE id = p_rfp_id;
  
  IF v_rfp_title IS NULL THEN
    RAISE EXCEPTION 'RFP not found';
  END IF;
  
  -- Get admin name
  SELECT first_name || ' ' || last_name INTO v_admin_name
  FROM profiles WHERE id = auth.uid();
  
  -- Check for existing invitation
  IF EXISTS (
    SELECT 1 FROM rfp_invitations 
    WHERE rfp_id = p_rfp_id 
    AND recipient_email = p_recipient_email 
    AND status = 'pending'
    AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists for this email and RFP';
  END IF;
  
  -- Create invitation
  INSERT INTO rfp_invitations (
    rfp_id,
    invited_by,
    recipient_email,
    recipient_user_id,
    recipient_company_id,
    invitation_type,
    message
  ) VALUES (
    p_rfp_id,
    auth.uid(),
    p_recipient_email,
    p_recipient_user_id,
    p_recipient_company_id,
    p_invitation_type,
    p_message
  )
  RETURNING id, token INTO v_invitation_id, v_token;
  
  -- Create notification for existing users
  IF p_recipient_user_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id
    ) VALUES (
      p_recipient_user_id,
      'RFP Invitation Received',
      'You have been invited to participate in RFP: ' || v_rfp_title,
      'rfp_invitation',
      p_rfp_id
    );
  END IF;
  
  -- Return result for email sending
  v_result := json_build_object(
    'invitation_id', v_invitation_id,
    'token', v_token,
    'rfp_title', v_rfp_title,
    'client_name', v_client_name,
    'admin_name', v_admin_name,
    'recipient_email', p_recipient_email,
    'invitation_link', 'https://app.example.com/rfp-invitation?token=' || v_token
  );
  
  RETURN v_result;
END;
$$;

-- Function to accept RFP invitation
CREATE OR REPLACE FUNCTION accept_rfp_invitation(
  p_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation rfp_invitations%ROWTYPE;
  v_user_email text;
  v_result json;
BEGIN
  -- Get current user email
  SELECT email INTO v_user_email
  FROM profiles WHERE id = auth.uid();
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get invitation
  SELECT * INTO v_invitation
  FROM rfp_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > now();
  
  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Verify email matches
  IF v_invitation.recipient_email != v_user_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;
  
  -- Mark invitation as accepted
  UPDATE rfp_invitations
  SET 
    status = 'accepted',
    accepted_at = now(),
    recipient_user_id = auth.uid()
  WHERE id = v_invitation.id;
  
  -- Auto-approve company registration if user has company
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL) THEN
    INSERT INTO rfp_interest_registrations (
      rfp_id,
      company_id,
      user_id,
      status
    )
    SELECT 
      v_invitation.rfp_id,
      p.company_id,
      auth.uid(),
      'approved'
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
    ON CONFLICT (rfp_id, company_id) 
    DO UPDATE SET status = 'approved';
  END IF;
  
  -- Create success notification
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) VALUES (
    auth.uid(),
    'RFP Invitation Accepted',
    'You have successfully accepted the invitation to participate in this RFP',
    'rfp_invitation_accepted',
    v_invitation.rfp_id
  );
  
  v_result := json_build_object(
    'success', true,
    'rfp_id', v_invitation.rfp_id,
    'message', 'Invitation accepted successfully'
  );
  
  RETURN v_result;
END;
$$;

-- Function to get RFP invitation details
CREATE OR REPLACE FUNCTION get_rfp_invitation_details(
  p_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'invitation_id', ri.id,
    'rfp_id', ri.rfp_id,
    'rfp_title', r.title,
    'client_name', r.client_name,
    'recipient_email', ri.recipient_email,
    'message', ri.message,
    'status', ri.status,
    'expires_at', ri.expires_at,
    'created_at', ri.created_at,
    'invited_by_name', p.first_name || ' ' || p.last_name
  ) INTO v_result
  FROM rfp_invitations ri
  JOIN rfps r ON r.id = ri.rfp_id
  JOIN profiles p ON p.id = ri.invited_by
  WHERE ri.token = p_token;
  
  RETURN v_result;
END;
$$;