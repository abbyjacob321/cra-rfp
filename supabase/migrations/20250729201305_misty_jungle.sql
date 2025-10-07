/*
  # Add Proposal Submission System
  
  1. Changes
    - Add submission method fields to RFPs table
    - Add proposal submissions tracking table
    - Add ShareFile integration fields
    - Add submission audit trail
  
  2. Features
    - Support both ShareFile API and instruction-based submissions
    - Track submission status and timestamps
    - Handle late submissions
    - Audit trail for all submission activities
*/

-- Add submission method fields to RFPs table
ALTER TABLE rfps 
ADD COLUMN IF NOT EXISTS submission_method text DEFAULT 'instructions' CHECK (submission_method IN ('sharefile', 'instructions')),
ADD COLUMN IF NOT EXISTS submission_instructions text,
ADD COLUMN IF NOT EXISTS sharefile_folder_id text,
ADD COLUMN IF NOT EXISTS allow_late_submissions boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sharefile_settings jsonb DEFAULT '{}'::jsonb;

-- Create proposal submissions table
CREATE TABLE IF NOT EXISTS proposal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  company_id uuid REFERENCES companies(id),
  submission_method text NOT NULL CHECK (submission_method IN ('sharefile', 'manual')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_late_submission boolean DEFAULT false,
  sharefile_folder_id text,
  file_count integer DEFAULT 0,
  total_file_size bigint DEFAULT 0,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rfp_id, user_id, company_id)
);

-- Create submission files table for tracking individual files
CREATE TABLE IF NOT EXISTS submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES proposal_submissions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  sharefile_file_id text,
  upload_status text DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
  uploaded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create submission audit trail
CREATE TABLE IF NOT EXISTS submission_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES proposal_submissions(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES profiles(id),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE proposal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_audit_trail ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS proposal_submissions_rfp_id_idx ON proposal_submissions(rfp_id);
CREATE INDEX IF NOT EXISTS proposal_submissions_user_id_idx ON proposal_submissions(user_id);
CREATE INDEX IF NOT EXISTS proposal_submissions_company_id_idx ON proposal_submissions(company_id);
CREATE INDEX IF NOT EXISTS proposal_submissions_status_idx ON proposal_submissions(status);
CREATE INDEX IF NOT EXISTS submission_files_submission_id_idx ON submission_files(submission_id);
CREATE INDEX IF NOT EXISTS submission_audit_trail_submission_id_idx ON submission_audit_trail(submission_id);

-- RLS Policies for proposal_submissions
CREATE POLICY "Users can view their own submissions"
ON proposal_submissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  (company_id IS NOT NULL AND company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )) OR
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can create submissions"
ON proposal_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  (company_id IS NULL OR company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ))
);

CREATE POLICY "Admins can manage all submissions"
ON proposal_submissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for submission_files
CREATE POLICY "Users can view their submission files"
ON submission_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM proposal_submissions ps
    WHERE ps.id = submission_files.submission_id
    AND (ps.user_id = auth.uid() OR 
         (ps.company_id IS NOT NULL AND ps.company_id IN (
           SELECT company_id FROM profiles WHERE id = auth.uid()
         )) OR
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
);

CREATE POLICY "Users can manage their submission files"
ON submission_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM proposal_submissions ps
    WHERE ps.id = submission_files.submission_id
    AND (ps.user_id = auth.uid() OR 
         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
);

-- RLS Policies for submission_audit_trail
CREATE POLICY "Admins can view audit trail"
ON submission_audit_trail
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to check if submissions are still allowed
CREATE OR REPLACE FUNCTION can_submit_proposal(p_rfp_id uuid)
RETURNS jsonb AS $$
DECLARE
  rfp_record record;
  is_late boolean;
  can_submit boolean;
BEGIN
  -- Get RFP details
  SELECT * INTO rfp_record FROM rfps WHERE id = p_rfp_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_submit', false,
      'reason', 'RFP not found'
    );
  END IF;
  
  -- Check if RFP is active
  IF rfp_record.status != 'active' THEN
    RETURN jsonb_build_object(
      'can_submit', false,
      'reason', 'RFP is not active'
    );
  END IF;
  
  -- Check if past deadline
  is_late := now() > rfp_record.closing_date;
  
  -- Can submit if not late, or if late submissions are allowed
  can_submit := NOT is_late OR rfp_record.allow_late_submissions;
  
  RETURN jsonb_build_object(
    'can_submit', can_submit,
    'is_late', is_late,
    'allow_late', rfp_record.allow_late_submissions,
    'closing_date', rfp_record.closing_date,
    'submission_method', rfp_record.submission_method
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.submission_system.20250130120000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Added proposal submission system',
    'details', 'Added submission method toggle, ShareFile integration, and submission tracking'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();