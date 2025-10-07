/*
  # Create storage bucket for document storage

  1. New Bucket
    - Create 'rfp-documents' bucket for storing RFP-related documents
    - Set security policy for document access
  
  2. Security Policies
    - Files are only publicly readable based on role and access rules
    - Only authenticated users with proper permissions can insert files
*/

-- Create new storage bucket for RFP documents
INSERT INTO storage.buckets (id, name)
VALUES ('rfp-documents', 'RFP Documents')
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the documents bucket

-- Allow users to read non-NDA files and files where they have signed an NDA
CREATE POLICY "Users can read files without NDA restrictions or if they've signed an NDA"
ON storage.objects FOR SELECT
TO authenticated
USING (
  -- Allow access if the file path doesn't require NDA
  NOT EXISTS (
    SELECT 1 FROM documents
    WHERE storage.objects.name = documents.file_path
    AND documents.requires_nda = true
  )
  OR
  -- Or if the user has signed the NDA
  EXISTS (
    SELECT 1 FROM documents
    JOIN ndas ON documents.rfp_id = ndas.rfp_id
    WHERE storage.objects.name = documents.file_path
    AND documents.requires_nda = true
    AND ndas.user_id = auth.uid()
    AND ndas.status = 'signed'
  )
);

-- Allow admins to insert files
CREATE POLICY "Admin users can upload objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow admins to update files
CREATE POLICY "Admin users can update objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Allow admins to delete files
CREATE POLICY "Admin users can delete objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);