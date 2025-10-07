/*
  # Add RFP-specific NDA tracking
  
  1. Changes
    - Add parent_folder to documents table for organization
    - Add rfp_nda_access table to track NDA status per RFP
    - Add indexes for performance optimization
    - Add RLS policies for secure access
*/

-- Add parent_folder to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_folder uuid REFERENCES documents(id);

-- Create RFP NDA access table
CREATE TABLE IF NOT EXISTS rfp_nda_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(rfp_id, user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS documents_parent_folder_idx ON documents(parent_folder);
CREATE INDEX IF NOT EXISTS rfp_nda_access_rfp_id_idx ON rfp_nda_access(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_user_id_idx ON rfp_nda_access(user_id);

-- Enable RLS
ALTER TABLE rfp_nda_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for NDA access
CREATE POLICY "Users can view their own NDA access"
ON rfp_nda_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all NDA access"
ON rfp_nda_access
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Update document access policies
CREATE POLICY "Users can access documents if they have signed NDA"
ON documents
FOR SELECT
TO authenticated
USING (
  NOT requires_nda 
  OR EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_nda_access.rfp_id = documents.rfp_id
    AND rfp_nda_access.user_id = auth.uid()
  )
);

-- Function to check if user has NDA access
CREATE OR REPLACE FUNCTION check_nda_access(p_rfp_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_id = p_rfp_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;