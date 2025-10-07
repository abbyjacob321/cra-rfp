/*
  # Initial Schema for RFP Platform

  1. Tables
    - `profiles`: User profile information
    - `rfps`: Request for Proposals
    - `rfp_components`: Sections within an RFP
    - `rfp_access`: User access permissions to RFPs
    - `documents`: Files attached to RFPs
    - `questions`: Q&A for RFPs
    - `messages`: Communication between users
    - `ndas`: Non-disclosure agreements

  2. Security
    - Enable RLS on all tables
    - Create policies for role-based access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client_reviewer', 'bidder')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RFPs table
CREATE TABLE IF NOT EXISTS rfps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client_id UUID REFERENCES profiles(id),
  client_name TEXT NOT NULL,
  categories TEXT[] NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'confidential')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'closed')),
  issue_date TIMESTAMPTZ NOT NULL,
  closing_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RFP components table
CREATE TABLE IF NOT EXISTS rfp_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  requires_approval BOOLEAN DEFAULT FALSE,
  requires_nda BOOLEAN DEFAULT FALSE,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create RFP access table
CREATE TABLE IF NOT EXISTS rfp_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rfp_id, user_id)
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  requires_nda BOOLEAN DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  question TEXT NOT NULL,
  topic TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_review', 'published')),
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id), -- NULL for broadcast messages
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Create NDAs table
CREATE TABLE IF NOT EXISTS ndas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  document_id UUID REFERENCES documents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'signed', 'rejected')),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rfp_id, user_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfp_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ndas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RFPs Policies
CREATE POLICY "Everyone can view public RFPs"
  ON rfps
  FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Users can view confidential RFPs they have access to"
  ON rfps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rfp_access
      WHERE rfp_id = rfps.id AND user_id = auth.uid() AND status = 'approved'
    )
  );

CREATE POLICY "Admins can manage all RFPs"
  ON rfps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- More policies would be created for other tables
-- This is a starting point showing the pattern

-- Create admin user function (to be run manually after setup)
CREATE OR REPLACE FUNCTION create_admin_user()
RETURNS VOID AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, company, role)
  VALUES ('00000000-0000-0000-0000-000000000000', 'Admin', 'User', 'CRA', 'admin');
END;
$$ LANGUAGE plpgsql;