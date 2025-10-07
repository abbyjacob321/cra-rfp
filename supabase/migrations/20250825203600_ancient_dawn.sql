/*
  # Consolidated Schema Migration for CRA RFP Platform
  
  This migration creates all necessary tables, functions, and policies for the platform
  after an unpause or fresh setup.
  
  1. Core Tables
    - profiles: User profiles and authentication
    - companies: Company management
    - rfps: Request for Proposals
    - rfp_components: RFP content sections
    - documents: File storage and management
    - questions: Q&A system
    - notifications: User notifications
    - analytics_events: Platform analytics
    - platform_settings: Configuration
    
  2. Access Control Tables
    - rfp_access: RFP access permissions
    - rfp_nda_access: NDA tracking
    - company_ndas: Company-level NDAs
    - company_invitations: Team invitations
    - company_join_requests: Join requests
    - rfp_interest_registrations: Company interest in RFPs
    - saved_rfps: User bookmarks
    
  3. Advanced Features
    - rfp_invitations: Direct RFP invitations
    - proposal_submissions: Proposal tracking
    - submission_files: File submission tracking
    
  4. Security
    - Row Level Security enabled on all tables
    - Comprehensive access policies
    - Admin management functions
*/

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- CORE USER MANAGEMENT TABLES
-- =====================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  company text,
  role text NOT NULL DEFAULT 'bidder' CHECK (role IN ('admin', 'client_reviewer', 'bidder')),
  title text,
  phone text,
  company_id uuid,
  company_role text CHECK (company_role IN ('admin', 'member', 'pending')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  address text,
  phone text,
  logo_url text,
  industry text,
  description text,
  state_of_incorporation text,
  email_domain text,
  company_size text CHECK (company_size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  founded_year integer,
  linkedin_url text,
  verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verified_badge boolean DEFAULT false,
  verification_requested_at timestamptz,
  verification_completed_at timestamptz,
  verification_completed_by uuid,
  verification_notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for profiles.company_id after companies table exists
ALTER TABLE profiles ADD CONSTRAINT profiles_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id);

-- =====================================
-- RFP MANAGEMENT TABLES
-- =====================================

-- Create RFPs table
CREATE TABLE IF NOT EXISTS rfps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid,
  client_name text NOT NULL,
  categories text[] NOT NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'confidential')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  milestones jsonb DEFAULT '[]'::jsonb,
  issue_date timestamptz NOT NULL DEFAULT now(),
  closing_date timestamptz NOT NULL,
  description text NOT NULL,
  logo_url text,
  submission_method text DEFAULT 'instructions' CHECK (submission_method IN ('sharefile', 'instructions')),
  submission_instructions text,
  sharefile_folder_id text,
  allow_late_submissions boolean DEFAULT true,
  sharefile_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create RFP components table
CREATE TABLE IF NOT EXISTS rfp_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  requires_approval boolean DEFAULT false,
  requires_nda boolean DEFAULT false,
  sort_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================
-- DOCUMENT MANAGEMENT TABLES
-- =====================================

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  requires_nda boolean DEFAULT false,
  requires_approval boolean DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  parent_folder uuid REFERENCES documents(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================
-- ACCESS CONTROL TABLES
-- =====================================

-- Create RFP access table for client reviewers
CREATE TABLE IF NOT EXISTS rfp_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (rfp_id, user_id)
);

-- Create RFP NDA access table
CREATE TABLE IF NOT EXISTS rfp_nda_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  document_id uuid REFERENCES documents(id),
  status text DEFAULT 'signed' CHECK (status IN ('signed', 'approved', 'rejected')),
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  full_name text NOT NULL,
  title text,
  company text,
  signature_data jsonb DEFAULT '{}'::jsonb,
  countersigned_at timestamptz,
  countersigned_by uuid REFERENCES profiles(id),
  countersigner_name text,
  countersigner_title text,
  countersignature_data jsonb DEFAULT '{}'::jsonb,
  rejection_reason text,
  rejection_date timestamptz,
  rejection_by uuid REFERENCES profiles(id),
  ip_address text,
  user_agent text,
  UNIQUE(rfp_id, user_id)
);

-- Create company NDAs table
CREATE TABLE IF NOT EXISTS company_ndas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  signed_by uuid NOT NULL REFERENCES profiles(id),
  signed_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  title text,
  signature_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'signed' CHECK (status IN ('signed', 'approved', 'rejected')),
  countersigned_by uuid REFERENCES profiles(id),
  countersigned_at timestamptz,
  countersigner_name text,
  countersigner_title text,
  countersignature_data jsonb DEFAULT '{}'::jsonb,
  rejection_reason text,
  rejection_date timestamptz,
  rejected_by uuid REFERENCES profiles(id),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, rfp_id)
);

-- =====================================
-- COMPANY MANAGEMENT TABLES
-- =====================================

-- Create company invitations table
CREATE TABLE IF NOT EXISTS company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  inviter_id uuid NOT NULL REFERENCES profiles(id),
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'rejected')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Create company join requests table
CREATE TABLE IF NOT EXISTS company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message text,
  response_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- =====================================
-- Q&A AND COMMUNICATION TABLES
-- =====================================

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  question text NOT NULL,
  topic text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'published')),
  answer text,
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  recipient_id uuid REFERENCES profiles(id),
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'rfp_published', 'rfp_updated', 'rfp_closed', 'question_answered', 
    'nda_approved', 'nda_rejected', 'access_granted', 'access_denied', 
    'system_notice', 'rfp_interest', 'company_invitation', 'join_request',
    'join_request_approved', 'join_request_rejected', 'rfp_invitation',
    'rfp_invitation_accepted', 'company_verified', 'company_rejected',
    'registration_approved', 'registration_rejected'
  )),
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =====================================
-- INTEREST AND SUBMISSION TABLES
-- =====================================

-- Create RFP interest registrations table
CREATE TABLE IF NOT EXISTS rfp_interest_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  registration_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  rejected_by uuid REFERENCES profiles(id),
  rejected_at timestamptz,
  UNIQUE(rfp_id, company_id)
);

-- Create RFP invitations table
CREATE TABLE IF NOT EXISTS rfp_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES profiles(id),
  recipient_email text NOT NULL,
  recipient_user_id uuid REFERENCES profiles(id),
  recipient_company_id uuid REFERENCES companies(id),
  invitation_type text NOT NULL CHECK (invitation_type IN ('user', 'company', 'email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

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

-- Create submission files table
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

-- =====================================
-- UTILITY TABLES
-- =====================================

-- Create saved RFPs table
CREATE TABLE IF NOT EXISTS saved_rfps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rfp_id uuid REFERENCES rfps(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, rfp_id)
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rfp_id uuid REFERENCES rfps(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Create audit trail tables
CREATE TABLE IF NOT EXISTS nda_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nda_id uuid REFERENCES rfp_nda_access(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS submission_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES proposal_submissions(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES profiles(id),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON profiles(company_id);
CREATE INDEX IF NOT EXISTS profiles_role_admin_idx ON profiles((role = 'admin'));

-- Companies indexes
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(name);
CREATE INDEX IF NOT EXISTS companies_email_domain_idx ON companies(email_domain);
CREATE INDEX IF NOT EXISTS companies_verification_status_idx ON companies(verification_status);

-- RFPs indexes
CREATE INDEX IF NOT EXISTS rfps_status_idx ON rfps(status);
CREATE INDEX IF NOT EXISTS rfps_visibility_idx ON rfps(visibility);
CREATE INDEX IF NOT EXISTS rfps_closing_date_idx ON rfps(closing_date);
CREATE INDEX IF NOT EXISTS rfps_created_at_idx ON rfps(created_at);

-- RFP components indexes
CREATE INDEX IF NOT EXISTS rfp_components_rfp_id_idx ON rfp_components(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_components_sort_order_idx ON rfp_components(sort_order);

-- Documents indexes
CREATE INDEX IF NOT EXISTS documents_rfp_id_idx ON documents(rfp_id);
CREATE INDEX IF NOT EXISTS documents_requires_nda_idx ON documents(requires_nda);
CREATE INDEX IF NOT EXISTS documents_requires_approval_idx ON documents(requires_approval);

-- Questions indexes
CREATE INDEX IF NOT EXISTS questions_rfp_id_idx ON questions(rfp_id);
CREATE INDEX IF NOT EXISTS questions_user_id_idx ON questions(user_id);
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status);

-- Access control indexes
CREATE INDEX IF NOT EXISTS rfp_access_rfp_id_idx ON rfp_access(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_access_user_id_idx ON rfp_access(user_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_rfp_id_idx ON rfp_nda_access(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_nda_access_user_id_idx ON rfp_nda_access(user_id);

-- Company management indexes
CREATE INDEX IF NOT EXISTS company_invitations_company_id_idx ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS company_join_requests_company_id_idx ON company_join_requests(company_id);
CREATE INDEX IF NOT EXISTS company_join_requests_user_id_idx ON company_join_requests(user_id);

-- Interest and submissions indexes
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_rfp_id_idx ON rfp_interest_registrations(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_interest_registrations_company_id_idx ON rfp_interest_registrations(company_id);
CREATE INDEX IF NOT EXISTS rfp_invitations_rfp_id_idx ON rfp_invitations(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_invitations_token_idx ON rfp_invitations(token);
CREATE INDEX IF NOT EXISTS proposal_submissions_rfp_id_idx ON proposal_submissions(rfp_id);

-- =====================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_nda_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ndas ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_interest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nda_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_audit_trail ENABLE ROW LEVEL SECURITY;

-- =====================================
-- BASIC RLS POLICIES
-- =====================================

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Companies policies
CREATE POLICY "Users can view companies they belong to"
  ON companies FOR SELECT TO authenticated
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Company admins can update their company"
  ON companies FOR UPDATE TO authenticated
  USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND company_role = 'admin')
  );

-- RFPs policies
CREATE POLICY "Everyone can view public RFPs"
  ON rfps FOR SELECT TO public
  USING (visibility = 'public' AND status != 'draft');

CREATE POLICY "Admins can manage all RFPs"
  ON rfps FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- RFP components policies
CREATE POLICY "Users can view public RFP components"
  ON rfp_components FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rfps
      WHERE rfps.id = rfp_components.rfp_id
      AND rfps.visibility = 'public'
    )
  );

CREATE POLICY "Anonymous users can view public RFP components"
  ON rfp_components FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM rfps
      WHERE rfps.id = rfp_components.rfp_id
      AND rfps.visibility = 'public'
      AND rfps.status != 'draft'
    )
  );

CREATE POLICY "Admins can manage all components"
  ON rfp_components FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Documents policies
CREATE POLICY "Public access to non-NDA documents"
  ON documents FOR SELECT TO anon
  USING (
    (NOT requires_nda) AND 
    EXISTS (
      SELECT 1 FROM rfps
      WHERE rfps.id = documents.rfp_id
      AND rfps.visibility = 'public'
      AND rfps.status <> 'draft'
    )
  );

CREATE POLICY "Users can access appropriate documents"
  ON documents FOR SELECT TO authenticated
  USING (
    (NOT requires_nda) OR
    EXISTS (
      SELECT 1 FROM rfp_nda_access
      WHERE rfp_nda_access.rfp_id = documents.rfp_id
      AND rfp_nda_access.user_id = auth.uid()
      AND rfp_nda_access.status IN ('signed', 'approved')
    ) OR
    EXISTS (
      SELECT 1 FROM company_ndas cn
      JOIN profiles p ON p.company_id = cn.company_id
      WHERE p.id = auth.uid()
      AND cn.rfp_id = documents.rfp_id
      AND cn.status = 'approved'
    )
  );

CREATE POLICY "Admins can manage all documents"
  ON documents FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Questions policies
CREATE POLICY "Users can submit questions"
  ON questions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view published questions"
  ON questions FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "Users can view their own questions"
  ON questions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all questions"
  ON questions FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their notifications as read"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Saved RFPs policies
CREATE POLICY "Users can view their own saved RFPs"
  ON saved_rfps FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save RFPs"
  ON saved_rfps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave RFPs"
  ON saved_rfps FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Analytics policies
CREATE POLICY "System can insert analytics events"
  ON analytics_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view analytics"
  ON analytics_events FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Platform settings policies
CREATE POLICY "Admins can manage platform settings"
  ON platform_settings FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- =====================================
-- STORAGE BUCKET SETUP
-- =====================================

-- Create storage bucket for RFP documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('rfp-documents', 'RFP Documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('rfp-logos', 'RFP Logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for rfp-documents
CREATE POLICY "Public can access non-NDA files"
  ON storage.objects FOR SELECT TO anon
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

CREATE POLICY "Authenticated users can access appropriate files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rfp-documents' AND (
      EXISTS (
        SELECT 1 FROM documents d
        WHERE storage.objects.name = d.file_path
        AND NOT d.requires_nda
      ) OR
      EXISTS (
        SELECT 1 FROM documents d
        JOIN rfp_nda_access nda ON d.rfp_id = nda.rfp_id
        WHERE storage.objects.name = d.file_path
        AND nda.user_id = auth.uid()
        AND nda.status IN ('signed', 'approved')
      ) OR
      ((auth.jwt() ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Admins can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rfp-documents' AND
    ((auth.jwt() ->> 'role') = 'admin')
  );

-- Storage policies for logos
CREATE POLICY "Public can view logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'rfp-logos');

CREATE POLICY "Admins can manage logos"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'rfp-logos' AND
    ((auth.jwt() ->> 'role') = 'admin')
  );

-- =====================================
-- ESSENTIAL FUNCTIONS
-- =====================================

-- Function to create a company
CREATE OR REPLACE FUNCTION create_company(
  p_name text,
  p_website text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_state_of_incorporation text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_user_email text;
  v_email_domain text;
BEGIN
  -- Get user's email to extract domain
  SELECT email INTO v_user_email FROM profiles WHERE id = auth.uid();
  
  IF v_user_email IS NOT NULL THEN
    v_email_domain := split_part(v_user_email, '@', 2);
  END IF;
  
  -- Create the company
  INSERT INTO companies (
    name, website, address, phone, industry, description,
    created_by, state_of_incorporation, email_domain
  ) VALUES (
    p_name, p_website, p_address, p_phone, p_industry, p_description,
    auth.uid(), p_state_of_incorporation, v_email_domain
  ) RETURNING id INTO v_company_id;
  
  -- Update user profile
  UPDATE profiles
  SET 
    company_id = v_company_id,
    company_role = 'admin',
    company = p_name
  WHERE id = auth.uid();
  
  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', p_name,
    'role', 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search companies
CREATE OR REPLACE FUNCTION search_companies(
  search_term text,
  p_limit int DEFAULT 10
) 
RETURNS TABLE (
  id uuid, 
  name text, 
  website text, 
  industry text, 
  member_count bigint
) AS $$
BEGIN
  RETURN QUERY
    SELECT 
      c.id,
      c.name,
      c.website,
      c.industry,
      COUNT(p.id) AS member_count
    FROM 
      companies c
    LEFT JOIN 
      profiles p ON c.id = p.company_id
    WHERE 
      c.name ILIKE '%' || search_term || '%'
      OR c.industry ILIKE '%' || search_term || '%'
    GROUP BY 
      c.id, c.name, c.website, c.industry
    ORDER BY 
      CASE 
        WHEN c.name ILIKE search_term || '%' THEN 1
        WHEN c.name ILIKE '%' || search_term || '%' THEN 2
        ELSE 3
      END,
      c.name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to register RFP interest
CREATE OR REPLACE FUNCTION register_rfp_interest(
  p_rfp_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_registration_id uuid;
BEGIN
  -- Check if user is associated with a company
  SELECT company_id INTO v_company_id
  FROM profiles WHERE id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'You must be associated with a company to register interest'
    );
  END IF;
  
  -- Insert registration record
  INSERT INTO rfp_interest_registrations (
    rfp_id, company_id, user_id, notes
  ) VALUES (
    p_rfp_id, v_company_id, auth.uid(), p_notes
  )
  ON CONFLICT (rfp_id, company_id) DO NOTHING
  RETURNING id INTO v_registration_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_registration_id,
    'is_duplicate', v_registration_id IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check RFP interest registration
CREATE OR REPLACE FUNCTION check_rfp_interest_registration(
  p_rfp_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM profiles WHERE id = auth.uid();
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('is_registered', false, 'reason', 'no_company');
  END IF;
  
  RETURN jsonb_build_object(
    'is_registered', EXISTS(
      SELECT 1 FROM rfp_interest_registrations 
      WHERE rfp_id = p_rfp_id AND company_id = v_company_id
    ),
    'company_id', v_company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  notification_ids uuid[]
) RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read_at = now()
  WHERE id = ANY(notification_ids)
  AND user_id = auth.uid()
  AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- INSERT DEFAULT SETTINGS
-- =====================================

INSERT INTO platform_settings (key, value, description) VALUES
  ('site.name', '"CRA RFP Platform"', 'Platform name'),
  ('site.default_visibility', '"public"', 'Default RFP visibility'),
  ('upload.max_file_size', '50', 'Maximum file size in MB'),
  ('upload.allowed_types', '".pdf,.doc,.docx,.xls,.xlsx"', 'Allowed file types'),
  ('rfp.require_nda_default', 'true', 'Require NDA by default for new RFPs'),
  ('email.from_name', '"CRA RFP Platform"', 'Email sender name'),
  ('email.from_email', '"noreply@example.com"', 'Email sender address'),
  ('user.default_role', '"bidder"', 'Default role for new users'),
  ('user.min_password_length', '8', 'Minimum password length'),
  ('user.session_timeout', '60', 'Session timeout in minutes')
ON CONFLICT (key) DO NOTHING;

-- =====================================
-- SAMPLE DATA FOR TESTING
-- =====================================

-- Insert sample RFPs for testing
INSERT INTO rfps (
  title, client_name, categories, visibility, status, 
  issue_date, closing_date, description
) VALUES 
  (
    'Solar Energy Project - Phase 1',
    'Pacific Utilities Corp',
    ARRAY['renewable_credits', 'power_generation'],
    'public',
    'active',
    now() - interval '10 days',
    now() + interval '20 days',
    'Request for proposals for a 100MW solar energy project in California.'
  ),
  (
    'Wind Farm Development',
    'Green Energy Solutions',
    ARRAY['renewable_credits', 'power_generation'],
    'public',
    'active',
    now() - interval '5 days',
    now() + interval '30 days',
    'Development of a 200MW wind farm in Texas with grid connection requirements.'
  ),
  (
    'Energy Storage System',
    'Metro Electric Utility',
    ARRAY['energy_capacity'],
    'public',
    'active',
    now() - interval '15 days',
    now() + interval '25 days',
    'Large-scale battery energy storage system for grid stabilization.'
  ),
  (
    'Transmission Line Upgrade',
    'Northern Power Grid',
    ARRAY['transmission'],
    'public',
    'active',
    now() - interval '8 days',
    now() + interval '35 days',
    'Upgrade of 345kV transmission lines to improve grid reliability.'
  ),
  (
    'Smart Grid Infrastructure',
    'City Energy Authority',
    ARRAY['transmission', 'energy_capacity'],
    'public',
    'active',
    now() - interval '12 days',
    now() + interval '40 days',
    'Implementation of smart grid technologies and advanced metering infrastructure.'
  ),
  (
    'Renewable Energy Credits Purchase',
    'State Power Commission',
    ARRAY['renewable_credits'],
    'public',
    'active',
    now() - interval '3 days',
    now() + interval '15 days',
    'Purchase of renewable energy credits to meet state clean energy requirements.'
  ),
  (
    'Microgrid Development',
    'Island Electric Cooperative',
    ARRAY['power_generation', 'energy_capacity'],
    'public',
    'active',
    now() - interval '7 days',
    now() + interval '28 days',
    'Development of microgrid system for remote island community.'
  )
ON CONFLICT DO NOTHING;

-- Log this migration
INSERT INTO platform_settings (key, value, description) VALUES (
  'migration.consolidated.20250106140000',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'Consolidated schema migration',
    'details', 'Complete database schema setup for CRA RFP Platform'
  ),
  'Consolidated migration log'
) ON CONFLICT (key) DO NOTHING;