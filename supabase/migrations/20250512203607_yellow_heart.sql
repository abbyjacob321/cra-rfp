/*
  # Fix Ambiguous Profile References in rfp_nda_access table
  
  1. Changes
     - Add explicit alias names to foreign key constraints
     - Fix query performance for accessing profile information
     - Improve admin visibility of all database records
*/

-- Ensure all profiles-related foreign keys have unique constraint names
DO $$
BEGIN
  -- First, let's check if the issue is with duplicate constraints
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfp_nda_access_user_id_fkey'
  ) THEN
    -- Create new constraints with explicit and unique names if needed
    ALTER TABLE rfp_nda_access DROP CONSTRAINT IF EXISTS rfp_nda_access_countersigned_by_fkey;
    ALTER TABLE rfp_nda_access ADD CONSTRAINT rfp_nda_access_countersigned_by_fkey 
      FOREIGN KEY (countersigned_by) REFERENCES profiles(id);
      
    ALTER TABLE rfp_nda_access DROP CONSTRAINT IF EXISTS rfp_nda_access_rejection_by_fkey;
    ALTER TABLE rfp_nda_access ADD CONSTRAINT rfp_nda_access_rejection_by_fkey 
      FOREIGN KEY (rejection_by) REFERENCES profiles(id);
  END IF;
END $$;

-- Create view-safe function to check various NDA related access
CREATE OR REPLACE FUNCTION get_nda_relations(
  p_nda_id uuid
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'nda_id', nda.id,
    'rfp_id', nda.rfp_id,
    'user_id', nda.user_id,
    'signer', json_build_object(
      'id', user_profile.id,
      'email', user_profile.email,
      'name', user_profile.first_name || ' ' || user_profile.last_name
    ),
    'countersigner', CASE WHEN nda.countersigned_by IS NOT NULL THEN
      json_build_object(
        'id', counter_profile.id,
        'email', counter_profile.email,
        'name', counter_profile.first_name || ' ' || counter_profile.last_name
      )
      ELSE NULL
    END,
    'rejecter', CASE WHEN nda.rejection_by IS NOT NULL THEN
      json_build_object(
        'id', reject_profile.id,
        'email', reject_profile.email,
        'name', reject_profile.first_name || ' ' || reject_profile.last_name
      )
      ELSE NULL
    END,
    'status', nda.status
  ) INTO result
  FROM rfp_nda_access nda
  LEFT JOIN profiles user_profile ON nda.user_id = user_profile.id
  LEFT JOIN profiles counter_profile ON nda.countersigned_by = counter_profile.id
  LEFT JOIN profiles reject_profile ON nda.rejection_by = reject_profile.id
  WHERE nda.id = p_nda_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes to improve profile lookup performance
CREATE INDEX IF NOT EXISTS profiles_email_unique_idx ON profiles(email);

-- Ensure admin can access all records through a helper function
CREATE OR REPLACE FUNCTION admin_view_all()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;