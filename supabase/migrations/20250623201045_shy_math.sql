/*
  # Add INSERT policy for companies table

  1. Security Changes
    - Add INSERT policy for companies table to allow authenticated users to create companies
    - Ensures the created_by field matches the authenticated user's ID

  This fixes the RLS policy violation when creating new companies.
*/

-- Add INSERT policy for companies table
CREATE POLICY "Authenticated users can create companies"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());