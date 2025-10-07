/*
  # Fix document access for public RFPs
  
  1. Changes
     - Drop and recreate RLS policies for documents table 
     - Add specific policies for anonymous/public users
     - Fix storage access policies to match document access rules
     - Add debug function to verify document visibility
     
  2. Security
     - Maintains NDA protection for sensitive documents
     - Allows public access to non-NDA documents in public RFPs
     - Ensures consistent access across database and storage
*/

-- First, drop existing policies that are causing issues
DROP POLICY IF EXISTS "Public access to non-NDA documents" ON public.documents;
DROP POLICY IF EXISTS "Users can access appropriate documents" ON public.documents;
DROP POLICY IF EXISTS "Public can access non-NDA files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can access appropriate files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;

-- Create explicit policies for public/anonymous access to documents
CREATE POLICY "Public access to non-NDA documents"
ON public.documents
FOR SELECT
TO anon
USING (
  (NOT requires_nda) AND 
  EXISTS (
    SELECT 1 FROM rfps
    WHERE rfps.id = documents.rfp_id
    AND rfps.visibility = 'public'
    AND rfps.status != 'draft'
  )
);

-- Allow authenticated users to access non-NDA documents and NDA documents they have access to
CREATE POLICY "Users can access appropriate documents" 
ON public.documents
FOR SELECT
TO authenticated
USING (
  -- Non-NDA documents in public RFPs
  ((NOT requires_nda) AND 
   EXISTS (
     SELECT 1 FROM rfps
     WHERE rfps.id = documents.rfp_id
     AND rfps.visibility = 'public'
   )
  )
  OR
  -- User has personally signed an NDA
  EXISTS (
    SELECT 1 FROM rfp_nda_access
    WHERE rfp_nda_access.rfp_id = documents.rfp_id
    AND rfp_nda_access.user_id = auth.uid()
    AND rfp_nda_access.status = 'signed'
  )
  OR
  -- User's company has signed an NDA
  EXISTS (
    SELECT 1 FROM company_ndas cn
    JOIN profiles p ON p.company_id = cn.company_id
    WHERE p.id = auth.uid()
    AND cn.rfp_id = documents.rfp_id
    AND cn.status = 'approved'
  )
);

-- Make sure admins can manage all documents
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

-- Fix storage access for anonymous/public access
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
    AND r.status != 'draft'
  )
);

-- Fix storage access for authenticated users
CREATE POLICY "Authenticated users can access appropriate files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rfp-documents' AND (
    -- File doesn't require NDA
    EXISTS (
      SELECT 1 FROM documents d
      JOIN rfps r ON d.rfp_id = r.id
      WHERE storage.objects.name = d.file_path
      AND NOT d.requires_nda
      AND r.visibility = 'public'
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

-- Add storage upload policy for admins
CREATE POLICY "Admins can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rfp-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create an enhanced debug function for document visibility issues
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
    'rfp_status', rfp.status,
    'public_accessible', (NOT doc.requires_nda AND rfp.visibility = 'public' AND rfp.status != 'draft'),
    'file_path', doc.file_path,
    'storage_policies', (
      SELECT json_agg(row_to_json(p)) 
      FROM pg_policies p 
      WHERE p.tablename = 'objects' AND p.schemaname = 'storage'
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to test if documents for an RFP are publicly accessible
CREATE OR REPLACE FUNCTION check_rfp_public_documents(p_rfp_id uuid)
RETURNS jsonb AS $$
DECLARE
  rfp_data record;
  public_docs jsonb;
  nda_docs jsonb;
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
  
  -- Get public documents
  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'requires_nda', d.requires_nda,
    'file_path', d.file_path,
    'public_accessible', (NOT d.requires_nda AND rfp_data.visibility = 'public' AND rfp_data.status != 'draft')
  ))
  INTO public_docs
  FROM documents d
  WHERE d.rfp_id = p_rfp_id AND NOT d.requires_nda;
  
  -- Get NDA documents
  SELECT jsonb_agg(jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'requires_nda', d.requires_nda,
    'file_path', d.file_path,
    'nda_required', true
  ))
  INTO nda_docs
  FROM documents d
  WHERE d.rfp_id = p_rfp_id AND d.requires_nda;
  
  -- Build result
  result := jsonb_build_object(
    'rfp_id', rfp_data.id,
    'rfp_title', rfp_data.title,
    'rfp_visibility', rfp_data.visibility,
    'rfp_status', rfp_data.status,
    'is_public', (rfp_data.visibility = 'public' AND rfp_data.status != 'draft'),
    'public_documents', COALESCE(public_docs, '[]'::jsonb),
    'nda_documents', COALESCE(nda_docs, '[]'::jsonb),
    'document_count', (SELECT count(*) FROM documents WHERE rfp_id = p_rfp_id),
    'public_document_count', (SELECT count(*) FROM documents WHERE rfp_id = p_rfp_id AND NOT requires_nda),
    'nda_document_count', (SELECT count(*) FROM documents WHERE rfp_id = p_rfp_id AND requires_nda)
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
    'action', 'Fixed document access control for public RFPs',
    'details', 'Improved RLS policies to ensure public access to non-NDA documents in public RFPs'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();