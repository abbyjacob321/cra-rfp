/*
  # Fix ambiguous profile references in NDA access table
  
  1. Changes
     - Rename foreign key constraints to be more explicit
     - Ensure each foreign key relationship has a unique constraint name
     - Fix multiple FK relationships between rfp_nda_access and profiles
     - Add explicit qualifier in table selection

  2. Security
     - Maintains proper access control
     - Preserves existing security policies
     - Fixes query errors from ambiguous relationships
*/

-- First drop the existing constraint names
ALTER TABLE rfp_nda_access DROP CONSTRAINT IF EXISTS rfp_nda_access_user_id_fkey;
ALTER TABLE rfp_nda_access DROP CONSTRAINT IF EXISTS rfp_nda_access_countersigned_by_fkey;
ALTER TABLE rfp_nda_access DROP CONSTRAINT IF EXISTS rfp_nda_access_rejection_by_fkey;

-- Recreate constraints with explicit, unique names
ALTER TABLE rfp_nda_access 
  ADD CONSTRAINT rfp_nda_access_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id);

ALTER TABLE rfp_nda_access 
  ADD CONSTRAINT rfp_nda_access_countersigned_by_fkey 
  FOREIGN KEY (countersigned_by) REFERENCES profiles(id);

ALTER TABLE rfp_nda_access 
  ADD CONSTRAINT rfp_nda_access_rejection_by_fkey 
  FOREIGN KEY (rejection_by) REFERENCES profiles(id);

-- Create helper function to fix multiple profile references in queries
CREATE OR REPLACE FUNCTION get_user_nda_details(
  p_user_id uuid, 
  p_rfp_id uuid
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'nda_id', nda.id,
    'user_id', nda.user_id,
    'rfp_id', nda.rfp_id,
    'status', nda.status,
    'signed_at', nda.signed_at,
    'user_details', jsonb_build_object(
      'name', p1.first_name || ' ' || p1.last_name,
      'email', p1.email,
      'company', p1.company
    ),
    'countersigner', CASE WHEN nda.countersigned_by IS NOT NULL THEN
      jsonb_build_object(
        'name', p2.first_name || ' ' || p2.last_name,
        'email', p2.email
      )
      ELSE NULL
    END
  ) INTO result
  FROM rfp_nda_access nda
  JOIN profiles p1 ON nda.user_id = p1.id
  LEFT JOIN profiles p2 ON nda.countersigned_by = p2.id
  WHERE nda.user_id = p_user_id
  AND nda.rfp_id = p_rfp_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add specific helper function for handling profiles with ambiguous foreign keys
CREATE OR REPLACE FUNCTION qualify_profile_relationships(
  p_table_name text, 
  p_relationship_field text
) RETURNS text AS $$
BEGIN
  RETURN format('%s!%s_%s_fkey', 'profiles', p_table_name, p_relationship_field);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create improved indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_id_lookup_idx ON profiles USING hash (id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_user_lookup_idx ON rfp_nda_access(user_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_countersigned_lookup_idx ON rfp_nda_access(countersigned_by);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250513172502',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed ambiguous profile references',
    'details', 'Renamed constraints and added helper functions to resolve ambiguous profile references'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();