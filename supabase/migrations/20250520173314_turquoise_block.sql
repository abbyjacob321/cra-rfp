/*
  # Fix document access control for public RFPs
  
  1. Changes
     - Update RLS policies to allow public access to documents that don't require NDAs
     - Fix storage policies to align with document access rules
     - Add policy for unauthenticated users to view public documents
     - Ensure documents in public RFPs are visible to all users
     
  2. Security
     - Maintains protection for NDA-required documents
     - Only exposes documents that should be public
     - Preserves admin access to all documents
*/

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can access documents if they have signed NDA" ON documents;
DROP POLICY IF EXISTS "Allow document access based on NDA status" ON storage.objects;

-- Create a policy to allow anonymous access to non-NDA documents in public RFPs
CREATE POLICY "Public access to non-NDA documents"
ON documents
FOR SELECT
TO anon
USING (
  NOT requires_nda AND EXISTS (
    SELECT 1 FROM rfps
    WHERE rfps.id = documents.rfp_id
    AND rfps.visibility = 'public'
  )
);

-- Create a policy for authenticated users to access documents
CREATE POLICY "Users can access appropriate documents"
ON documents
FOR SELECT
TO authenticated
USING (
  -- Document doesn't require NDA
  (NOT requires_nda)
  OR 
  -- User has personally signed an NDA
  EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_nda_access.rfp_id = documents.rfp_id
    AND rfp_nda_access.user_id = auth.uid()
  )
  OR
  -- User's company has an approved NDA
  EXISTS (
    SELECT 1 FROM company_ndas cn
    JOIN profiles p ON p.company_id = cn.company_id
    WHERE p.id = auth.uid()
    AND cn.rfp_id = documents.rfp_id
    AND cn.status = 'approved'
  )
);

-- Fix storage access for anonymous users (public access)
CREATE POLICY "Public can access non-NDA files"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM documents d
    JOIN rfps r ON d.rfp_id = r.id
    WHERE storage.objects.name = d.file_path
    AND NOT d.requires_nda
    AND r.visibility = 'public'
  )
);

-- Update storage policy for authenticated users
CREATE POLICY "Authenticated users can access appropriate files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND (
    -- File doesn't require NDA
    EXISTS (
      SELECT 1 FROM documents d
      WHERE storage.objects.name = d.file_path
      AND NOT d.requires_nda
    )
    OR
    -- User has access to this document via NDA
    EXISTS (
      SELECT 1 FROM documents d
      JOIN rfp_nda_access nda ON d.rfp_id = nda.rfp_id
      WHERE storage.objects.name = d.file_path
      AND d.requires_nda = true
      AND nda.user_id = auth.uid()
    )
    OR
    -- User has access via company NDA
    EXISTS (
      SELECT 1 FROM documents d
      JOIN company_ndas cn ON d.rfp_id = cn.rfp_id
      JOIN profiles p ON cn.company_id = p.company_id
      WHERE storage.objects.name = d.file_path
      AND p.id = auth.uid()
      AND cn.status = 'approved'
    )
    OR
    -- User is admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

-- Create a function to check document visibility for troubleshooting
CREATE OR REPLACE FUNCTION debug_document_visibility(document_id uuid) 
RETURNS jsonb AS $$
DECLARE
  doc record;
  rfp record;
  result jsonb;
BEGIN
  -- Get document info
  SELECT * INTO doc FROM documents WHERE id = document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Document not found',
      'document_id', document_id
    );
  END IF;
  
  -- Get RFP info
  SELECT * INTO rfp FROM rfps WHERE id = doc.rfp_id;
  
  -- Build result
  result := jsonb_build_object(
    'document_id', doc.id,
    'document_title', doc.title,
    'requires_nda', doc.requires_nda,
    'rfp_id', doc.rfp_id,
    'rfp_title', rfp.title,
    'rfp_visibility', rfp.visibility,
    'public_accessible', NOT doc.requires_nda AND rfp.visibility = 'public',
    'file_path', doc.file_path
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250527173424',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed document access control',
    'details', 'Updated RLS policies to allow proper public access to non-NDA documents'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();