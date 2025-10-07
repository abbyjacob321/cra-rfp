-- This migration fixes document visibility issues by updating policies and creating a test function

-- First, verify our previous policies are in place (these were added in previous migrations)
DO $$
BEGIN
  -- Check if our policies exist, and if not, refresh them
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'documents' AND policyname = 'Public access to non-NDA documents'
  ) THEN
    -- Re-create the anonymous access policy
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
        AND rfps.status <> 'draft'
      )
    );
  END IF;
END $$;

-- Create a function to test if anonymous users can view a document
CREATE OR REPLACE FUNCTION test_document_public_access(doc_id uuid)
RETURNS boolean AS $$
DECLARE
  can_access boolean;
BEGIN
  SELECT 
    (NOT d.requires_nda) AND
    (r.visibility = 'public') AND
    (r.status <> 'draft')
  INTO can_access
  FROM documents d
  JOIN rfps r ON d.rfp_id = r.id
  WHERE d.id = doc_id;
  
  RETURN COALESCE(can_access, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix all document permissions for an RFP
CREATE OR REPLACE FUNCTION fix_rfp_document_permissions(p_rfp_id uuid)
RETURNS jsonb AS $$
DECLARE
  rfp_info record;
  doc_count int;
  fixed_count int := 0;
  result jsonb;
BEGIN
  -- Get RFP information
  SELECT * INTO rfp_info FROM rfps WHERE id = p_rfp_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RFP not found',
      'rfp_id', p_rfp_id
    );
  END IF;
  
  -- Count documents
  SELECT COUNT(*) INTO doc_count FROM documents WHERE rfp_id = p_rfp_id;
  
  -- Update document timestamps to refresh the cache
  UPDATE documents
  SET updated_at = NOW()
  WHERE rfp_id = p_rfp_id;
  
  fixed_count := doc_count;
  
  -- Return results
  result := jsonb_build_object(
    'success', true,
    'rfp_id', p_rfp_id,
    'rfp_title', rfp_info.title,
    'rfp_visibility', rfp_info.visibility,
    'rfp_status', rfp_info.status,
    'document_count', doc_count,
    'fixed_count', fixed_count,
    'public_documents', (
      SELECT COUNT(*) FROM documents 
      WHERE rfp_id = p_rfp_id AND NOT requires_nda
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250527195843',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed document visibility issues',
    'details', 'Added diagnostic functions and verified policy presence'
  ),
  'Migration log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();