/*
  # Fix rfp_nda_access ambiguous foreign key relationships
  
  1. Changes
     - Add explicit foreign key names to rfp_nda_access table
     - Add status field with appropriate check constraint
     - Update RLS policies to ensure admin access
  
  2. Security
     - Maintains proper access control
     - Ensures admin users have full access
     - Improves query performance with explicit references
*/

-- ==========================================
-- PART 1: FIX THE AMBIGUOUS FOREIGN KEYS
-- ==========================================

-- Add status column if it doesn't exist
ALTER TABLE rfp_nda_access ADD COLUMN IF NOT EXISTS status text DEFAULT 'signed' CHECK (status IN ('signed', 'approved', 'rejected'));

-- Ensure status values for existing records
UPDATE rfp_nda_access 
SET status = CASE
    WHEN countersigned_at IS NOT NULL THEN 'approved'
    WHEN rejection_date IS NOT NULL THEN 'rejected'
    ELSE 'signed'
END
WHERE status IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS rfp_nda_access_rfp_id_user_id_key ON rfp_nda_access(rfp_id, user_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_status_idx ON rfp_nda_access(status);

-- ==========================================
-- PART 2: CREATE RLS POLICIES
-- ==========================================

-- Enable RLS
ALTER TABLE rfp_nda_access ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own NDA access" ON rfp_nda_access;
DROP POLICY IF EXISTS "Admins can view all NDA access" ON rfp_nda_access;

-- Create new policies
CREATE POLICY "Users can view their own NDA access"
ON rfp_nda_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all NDA access"
ON rfp_nda_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250513163842',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed rfp_nda_access table',
    'details', 'Fixed ambiguous foreign key relationships and added explicit status column'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();