-- ==========================================
-- PART 1: FIX QUESTIONS TABLE RLS POLICIES
-- ==========================================

-- Ensure RLS is enabled on questions table
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Users can submit questions" ON questions;
DROP POLICY IF EXISTS "Users can view published questions" ON questions;
DROP POLICY IF EXISTS "Users can view their own questions" ON questions;
DROP POLICY IF EXISTS "Admins can manage all questions" ON questions;

-- Create a policy allowing users to submit questions
CREATE POLICY "Users can submit questions"
ON questions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policies for viewing questions
CREATE POLICY "Users can view published questions"
ON questions
FOR SELECT
TO authenticated
USING (status = 'published');

-- Users can view their own questions regardless of status
CREATE POLICY "Users can view their own questions"
ON questions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all questions
CREATE POLICY "Admins can manage all questions"
ON questions
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS questions_user_id_idx ON questions(user_id);
CREATE INDEX IF NOT EXISTS questions_rfp_id_idx ON questions(rfp_id);
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status);
CREATE INDEX IF NOT EXISTS questions_created_at_idx ON questions(created_at);

-- Log this migration
INSERT INTO platform_settings (key, value, description)
VALUES (
  'migration.fix.20250507192458',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Fixed Questions Table RLS',
    'details', 'Added insert policy for users to submit questions and view policies'
  ),
  'Migration fix log entry'
) ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();