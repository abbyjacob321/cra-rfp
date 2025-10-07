/*
  # Fix document visibility for bidders and public users
  
  1. Changes
     - Completely redesign RLS policies for documents
     - Fix storage bucket access policies
     - Explicitly separate RLS policies for clearer debugging
     - Add diagnostic functions to help troubleshoot document access issues
  
  2. Security
     - Maintain proper security for NDA-protected documents
     - Allow appropriate public access for non-NDA documents
     - Ensure proper access to files in storage buckets
*/

-- First, drop all existing RLS policies for documents and storage to start fresh
DROP POLICY IF EXISTS "Public access to non-NDA documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view public RFP documents" ON public.documents;
DROP POLICY IF EXISTS "Users can access documents with individual NDA" ON public.documents;
DROP POLICY IF EXISTS "Users can access documents with company NDA" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Public can access non-NDA files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can access public files" ON storage.objects;
DROP POLICY IF EXISTS "Users can access files with individual NDA" ON storage.objects;
DROP POLICY IF EXISTS "Users can access files with company NDA" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage storage files" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can upload objects" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can update objects" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can delete objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can access documents if they have signed NDA" ON public.documents;
DROP POLICY IF EXISTS "Allow document access based on NDA status" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can upload objects" ON storage.objects;

-- DOCUMENT TABLE POLICIES

-- 1. Anonymous access to public documents in active/closed RFPs
-- IMPORTANT: We include both active and closed RFPs, but exclude draft ones
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

-- 2. Authenticated users' access - expanded with specific policies
-- NOTE: We create multiple specific policies instead of one complex one
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

-- 3. Admin access - can manage all documents
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

-- STORAGE BUCKET POLICIES

-- 1. Anonymous access to files that don't require NDA
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

-- 2. Authenticated user access to public files
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

-- 3. Access for users who have signed individual NDAs
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

-- 4. Access for users whose company has an approved NDA
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

-- 5. Admin access to storage files (all operations)
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

-- DEBUGGING FUNCTIONS

-- Function to check document visibility in detail
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
    'public_access_eligible', (
      -- Check if this document should be publicly accessible
      NOT doc.requires_nda AND 
      rfp.visibility = 'public' AND 
      rfp.status <> 'draft'
    ),
    'storage_file_exists', EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'rfp-documents' 
      AND name = doc.file_path
    ),
    'created_at', doc.created_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check all documents in an RFP for access issues
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
      ),
      'file_exists', EXISTS (
        SELECT 1 FROM storage.objects
        WHERE bucket_id = 'rfp-documents' 
        AND name = d.file_path
      ),
      'created_at', d.created_at
    )
    ORDER BY d.created_at DESC
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
    'is_active_or_closed', (rfp_data.status <> 'draft'),
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
    'action', 'Fixed document access control issues',
    'details', 'Complete overhaul of document access policies for public and authenticated users'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();