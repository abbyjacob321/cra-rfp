/*
  # Fix Document Access Control for Public RFPs
  
  1. Changes
     - Drop existing problematic policies
     - Create clear policies for each access scenario
     - Fix storage bucket access to match database access
     - Add debugging helpers for troubleshooting
     
  2. Key Fixes
     - Public anonymous users can now see non-NDA documents in public RFPs
     - Storage bucket policies aligned with database policies
     - Better separation of concerns in policies
*/

-- First, drop all existing problematic policies to start fresh
DROP POLICY IF EXISTS "Public access to non-NDA documents" ON public.documents;
DROP POLICY IF EXISTS "Users can access appropriate documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Public can access non-NDA files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can access appropriate files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can access documents if they have signed NDA" ON documents;
DROP POLICY IF EXISTS "Allow document access based on NDA status" ON storage.objects;

-- IMPORTANT: Create separate policies for each access pattern to avoid OR condition complexity

-- 1. Anonymous/Public Access to Documents
-- Public users can view non-NDA documents in public, active/closed RFPs
CREATE POLICY "Public access to non-NDA documents"
ON public.documents
FOR SELECT
TO anon
USING (
  -- Document doesn't require NDA
  (NOT requires_nda) AND 
  -- RFP is public and not in draft status
  EXISTS (
    SELECT 1 FROM rfps
    WHERE rfps.id = documents.rfp_id
    AND rfps.visibility = 'public'
    AND rfps.status <> 'draft'
  )
);

-- 2. Authenticated Users' Document Access Policies
-- Policy A: Access to non-NDA documents in public RFPs
CREATE POLICY "Users can view public RFP documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  -- Document doesn't require NDA
  (NOT requires_nda) AND 
  -- RFP is public
  EXISTS (
    SELECT 1 FROM rfps
    WHERE rfps.id = documents.rfp_id
    AND rfps.visibility = 'public'
  )
);

-- Policy B: Access to documents with individual NDA
CREATE POLICY "Users can access documents with individual NDA"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_nda_access.rfp_id = documents.rfp_id
    AND rfp_nda_access.user_id = auth.uid()
    AND rfp_nda_access.status IN ('signed', 'approved')
  )
);

-- Policy C: Access to documents with company NDA
CREATE POLICY "Users can access documents with company NDA"
ON public.documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_ndas cn
    JOIN profiles p ON p.company_id = cn.company_id
    WHERE p.id = auth.uid()
    AND cn.rfp_id = documents.rfp_id
    AND cn.status = 'approved'
  )
);

-- 3. Admin Access Policy
CREATE POLICY "Admins can manage all documents"
ON public.documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 4. Storage Bucket Policies

-- Policy A: Public access to non-NDA files
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
    AND r.status <> 'draft'
  )
);

-- Policy B: Authenticated user access to files
CREATE POLICY "Authenticated users can access public files"
ON storage.objects
FOR SELECT
TO authenticated
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

-- Policy C: NDA signed files access
CREATE POLICY "Users can access files with individual NDA"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM documents d
    JOIN rfp_nda_access nda ON d.rfp_id = nda.rfp_id
    WHERE storage.objects.name = d.file_path
    AND nda.user_id = auth.uid()
    AND nda.status IN ('signed', 'approved')
  )
);

-- Policy D: Company NDA files access
CREATE POLICY "Users can access files with company NDA"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM documents d
    JOIN company_ndas cn ON d.rfp_id = cn.rfp_id
    JOIN profiles p ON cn.company_id = p.company_id
    WHERE storage.objects.name = d.file_path
    AND p.id = auth.uid()
    AND cn.status = 'approved'
  )
);

-- Policy E: Admin access to files
CREATE POLICY "Admins can manage storage files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 5. Debugging Functions

-- Enhanced debug function with additional visibility checks
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
  
  -- Build detailed result
  result := jsonb_build_object(
    'document_id', doc.id,
    'document_title', doc.title,
    'document_path', doc.file_path,
    'requires_nda', doc.requires_nda,
    'rfp_id', doc.rfp_id,
    'rfp_title', rfp.title,
    'rfp_visibility', rfp.visibility,
    'rfp_status', rfp.status,
    'public_access_check', (
      NOT doc.requires_nda AND 
      rfp.visibility = 'public' AND 
      rfp.status <> 'draft'
    ),
    'anon_can_view', (
      NOT doc.requires_nda AND 
      rfp.visibility = 'public' AND 
      rfp.status <> 'draft'
    ),
    'public_storage_check', EXISTS (
      SELECT 1 FROM documents d
      JOIN rfps r ON d.rfp_id = r.id
      WHERE d.id = document_id
      AND NOT d.requires_nda
      AND r.visibility = 'public'
      AND r.status <> 'draft'
    ),
    'storage_file_exists', EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'rfp-documents' 
      AND name = doc.file_path
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check all documents in an RFP
CREATE OR REPLACE FUNCTION check_rfp_documents_access(p_rfp_id uuid)
RETURNS jsonb AS $$
DECLARE
  rfp_data record;
  all_docs jsonb;
  result jsonb;
BEGIN
  -- Get RFP info
  SELECT * INTO rfp_data FROM rfps WHERE id = p_rfp_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'RFP not found',
      'rfp_id', p_rfp_id
    );
  END IF;
  
  -- Get all documents with access info
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'requires_nda', d.requires_nda,
      'file_path', d.file_path,
      'public_accessible', (
        NOT d.requires_nda AND 
        rfp_data.visibility = 'public' AND 
        rfp_data.status <> 'draft'
      )
    )
  )
  INTO all_docs
  FROM documents d
  WHERE d.rfp_id = p_rfp_id;
  
  -- Build result
  result := jsonb_build_object(
    'rfp_id', rfp_data.id,
    'rfp_title', rfp_data.title,
    'rfp_visibility', rfp_data.visibility,
    'rfp_status', rfp_data.status,
    'is_public_rfp', (rfp_data.visibility = 'public'),
    'is_active_rfp', (rfp_data.status <> 'draft'),
    'should_show_public_docs', (rfp_data.visibility = 'public' AND rfp_data.status <> 'draft'),
    'total_documents', (SELECT count(*) FROM documents WHERE rfp_id = p_rfp_id),
    'public_documents_count', (
      SELECT count(*) FROM documents 
      WHERE rfp_id = p_rfp_id AND NOT requires_nda
    ),
    'nda_documents_count', (
      SELECT count(*) FROM documents 
      WHERE rfp_id = p_rfp_id AND requires_nda
    ),
    'documents', COALESCE(all_docs, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250527183424',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed document access control for all user types',
    'details', 'Created comprehensive set of RLS policies for document access in public and private RFPs'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();