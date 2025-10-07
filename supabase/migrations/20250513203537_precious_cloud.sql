/*
  # Add RFP Interest Registration System
  
  1. Changes
     - Create rfp_interest_registrations table
     - Add RLS policies for access control
     - Add functions to manage registrations
     - Add indexes for performance
     
  2. Purpose
     - Allow companies to register interest in RFPs
     - Track which companies are interested in which RFPs
     - Provide visibility to administrators
*/

-- Create table for RFP interest registrations
CREATE TABLE IF NOT EXISTS rfp_interest_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  registration_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(rfp_id, company_id)
);

-- Enable RLS
ALTER TABLE rfp_interest_registrations ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_rfp_id_idx 
  ON rfp_interest_registrations(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_company_id_idx 
  ON rfp_interest_registrations(company_id);
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_user_id_idx 
  ON rfp_interest_registrations(user_id);
  
-- Add RLS policies
CREATE POLICY "Users can view their company's registrations"
  ON rfp_interest_registrations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Users can register their company's interest"
  ON rfp_interest_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND company_id IS NOT NULL
    ) AND
    user_id = auth.uid()
  );

CREATE POLICY "Admins can view all registrations"
  ON rfp_interest_registrations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add function to register interest
CREATE OR REPLACE FUNCTION register_rfp_interest(
  p_rfp_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registration_id uuid;
  v_result jsonb;
BEGIN
  -- Check if user is associated with a company
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You must be associated with a company to register interest'
    );
  END IF;
  
  -- Insert registration record
  INSERT INTO rfp_interest_registrations (
    rfp_id,
    company_id,
    user_id,
    notes
  )
  VALUES (
    p_rfp_id,
    v_company_id,
    auth.uid(),
    p_notes
  )
  ON CONFLICT (rfp_id, company_id)
  DO NOTHING
  RETURNING id INTO v_registration_id;
  
  -- If conflict occurred and no new record was inserted
  IF v_registration_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Your company is already registered for this RFP',
      'rfp_id', p_rfp_id,
      'company_id', v_company_id,
      'is_duplicate', true
    );
  END IF;
  
  -- Notify administrators
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  )
  SELECT 
    profiles.id,
    'New RFP Interest Registration',
    (SELECT companies.name FROM companies WHERE id = v_company_id) || 
    ' has registered interest in ' ||
    (SELECT title FROM rfps WHERE id = p_rfp_id),
    'rfp_interest',
    p_rfp_id
  FROM profiles
  WHERE role = 'admin';
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Interest successfully registered',
    'rfp_id', p_rfp_id,
    'company_id', v_company_id,
    'registration_id', v_registration_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to check if a company is registered for an RFP
CREATE OR REPLACE FUNCTION check_rfp_interest_registration(
  p_rfp_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_is_registered boolean;
  v_registration_date timestamptz;
  v_registered_by text;
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_registered', false,
      'reason', 'no_company'
    );
  END IF;
  
  -- Check if registration exists
  SELECT 
    EXISTS(
      SELECT 1 
      FROM rfp_interest_registrations 
      WHERE rfp_id = p_rfp_id AND company_id = v_company_id
    ) INTO v_is_registered;
  
  IF v_is_registered THEN
    SELECT
      registration_date,
      (SELECT first_name || ' ' || last_name FROM profiles WHERE id = user_id)
    INTO
      v_registration_date,
      v_registered_by
    FROM rfp_interest_registrations
    WHERE rfp_id = p_rfp_id AND company_id = v_company_id;
  END IF;
  
  -- Return result
  RETURN jsonb_build_object(
    'is_registered', v_is_registered,
    'company_id', v_company_id,
    'registration_date', v_registration_date,
    'registered_by', v_registered_by
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;