/*
  # Fix RLS policies for documents table
  
  1. Changes
     - Add/Update RLS policies for documents table
     - Ensure admins can create and manage documents
     - Fix issue with NDA access checks
     
  2. Security
     - Maintains proper access control while allowing admin operations
     - Ensures admins can insert, update, and delete documents
     - Fixes document access for users with company NDAs
*/

-- Ensure RLS is enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can access documents if they have signed NDA" ON documents;

-- Create policies for document access
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
  check_company_nda_access(rfp_id)
);

-- Create policy for admin document management
CREATE POLICY "Admins can manage all documents"
ON documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create a standalone function to check document access
CREATE OR REPLACE FUNCTION check_document_access(p_document_id uuid)
RETURNS boolean AS $$
DECLARE
  v_requires_nda boolean;
  v_rfp_id uuid;
  v_user_has_access boolean;
BEGIN
  -- Get document info
  SELECT 
    requires_nda,
    rfp_id,
    (
      NOT requires_nda 
      OR EXISTS (
        SELECT 1 FROM rfp_nda_access
        WHERE rfp_nda_access.rfp_id = documents.rfp_id
        AND rfp_nda_access.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM company_ndas
        JOIN profiles ON profiles.company_id = company_ndas.company_id
        WHERE profiles.id = auth.uid()
        AND company_ndas.rfp_id = documents.rfp_id
        AND company_ndas.status = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    ) AS user_has_access
  INTO 
    v_requires_nda,
    v_rfp_id,
    v_user_has_access
  FROM documents
  WHERE id = p_document_id;

  RETURN v_user_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy for storage access based on document access function
DROP POLICY IF EXISTS "Users can read files without NDA restrictions or if they've signed an NDA" ON storage.objects;

CREATE POLICY "Allow document access based on NDA status"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND (
    -- Allow if file doesn't require NDA
    NOT EXISTS (
      SELECT 1 FROM documents
      WHERE storage.objects.name = documents.file_path
      AND documents.requires_nda = true
    )
    OR
    -- Allow if user has access to this document
    EXISTS (
      SELECT 1 FROM documents
      WHERE storage.objects.name = documents.file_path
      AND check_document_access(documents.id)
    )
    OR
    -- Allow admins full access
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

-- Make sure admins can insert into storage
DROP POLICY IF EXISTS "Admin users can upload objects" ON storage.objects;

CREATE POLICY "Admin users can upload objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Make sure admins can update storage objects
DROP POLICY IF EXISTS "Admin users can update objects" ON storage.objects;

CREATE POLICY "Admin users can update objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Make sure admins can delete storage objects
DROP POLICY IF EXISTS "Admin users can delete objects" ON storage.objects;

CREATE POLICY "Admin users can delete objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add index for documents requires_nda column to improve query performance
CREATE INDEX IF NOT EXISTS documents_requires_nda_idx ON documents(requires_nda);