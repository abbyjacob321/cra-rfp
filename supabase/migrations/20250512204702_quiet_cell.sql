-- Fix ambiguous foreign key references in rfp_nda_access table
-- This migration addresses the error: "Could not embed because more than one relationship was found for 'rfp_nda_access' and 'profiles'"

-- First, add explicit alias names for each foreign key to profiles table
ALTER TABLE rfp_nda_access 
  DROP CONSTRAINT IF EXISTS rfp_nda_access_user_id_fkey;

ALTER TABLE rfp_nda_access 
  ADD CONSTRAINT rfp_nda_access_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Make sure rfp_id constraint is properly defined
ALTER TABLE rfp_nda_access 
  DROP CONSTRAINT IF EXISTS rfp_nda_access_rfp_id_fkey;

ALTER TABLE rfp_nda_access 
  ADD CONSTRAINT rfp_nda_access_rfp_id_fkey 
  FOREIGN KEY (rfp_id) REFERENCES rfps(id) ON DELETE CASCADE;

-- Create helper function to fix ambiguous joins with profiles table
CREATE OR REPLACE FUNCTION get_nda_with_profiles(p_rfp_id uuid) 
RETURNS TABLE (
  id uuid,
  rfp_id uuid,
  user_id uuid,
  status text,
  signed_at timestamptz,
  full_name text,
  user_email text,
  user_first_name text,
  user_last_name text,
  user_company text,
  countersigned_by uuid,
  countersigned_at timestamptz,
  countersigner_name text,
  countersigner_email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nda.id,
    nda.rfp_id,
    nda.user_id,
    nda.status,
    nda.signed_at,
    nda.full_name,
    user_profile.email AS user_email,
    user_profile.first_name AS user_first_name,
    user_profile.last_name AS user_last_name,
    user_profile.company AS user_company,
    nda.countersigned_by,
    nda.countersigned_at,
    nda.countersigner_name,
    counter_profile.email AS countersigner_email
  FROM rfp_nda_access AS nda
  JOIN profiles AS user_profile ON nda.user_id = user_profile.id
  LEFT JOIN profiles AS counter_profile ON nda.countersigned_by = counter_profile.id
  WHERE nda.rfp_id = p_rfp_id
  ORDER BY nda.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create indexes to improve performance
CREATE INDEX IF NOT EXISTS rfp_nda_access_user_lookup_idx ON rfp_nda_access(user_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_rfp_id_user_id_key ON rfp_nda_access(rfp_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles(email);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250513172502',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed ambiguous profile references',
    'details', 'Resolved ambiguous foreign key references for profiles table in rfp_nda_access'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();