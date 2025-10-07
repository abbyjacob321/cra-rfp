/*
  # Add indexes for RFP-related tables

  1. Changes
    - Add indexes to optimize RFP queries
    - Add indexes for foreign key relationships
    - Add indexes for commonly filtered fields
    - Add indexes for sorting operations

  2. Performance
    - Improves query performance for RFP listing and detail views
    - Optimizes joins between RFPs and related tables
    - Speeds up filtering and sorting operations
*/

-- Add indexes for RFPs table
CREATE INDEX IF NOT EXISTS rfps_status_idx ON rfps(status);
CREATE INDEX IF NOT EXISTS rfps_visibility_idx ON rfps(visibility);
CREATE INDEX IF NOT EXISTS rfps_client_id_idx ON rfps(client_id);
CREATE INDEX IF NOT EXISTS rfps_closing_date_idx ON rfps(closing_date);
CREATE INDEX IF NOT EXISTS rfps_created_at_idx ON rfps(created_at);

-- Add indexes for RFP components
CREATE INDEX IF NOT EXISTS rfp_components_rfp_id_idx ON rfp_components(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_components_sort_order_idx ON rfp_components(sort_order);

-- Add indexes for documents
CREATE INDEX IF NOT EXISTS documents_rfp_id_idx ON documents(rfp_id);
CREATE INDEX IF NOT EXISTS documents_requires_nda_idx ON documents(requires_nda);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON documents(created_at);

-- Add indexes for questions
CREATE INDEX IF NOT EXISTS questions_rfp_id_idx ON questions(rfp_id);
CREATE INDEX IF NOT EXISTS questions_user_id_idx ON questions(user_id);
CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status);
CREATE INDEX IF NOT EXISTS questions_created_at_idx ON questions(created_at);

-- Add indexes for NDAs
CREATE INDEX IF NOT EXISTS ndas_rfp_id_idx ON ndas(rfp_id);
CREATE INDEX IF NOT EXISTS ndas_user_id_idx ON ndas(user_id);
CREATE INDEX IF NOT EXISTS ndas_status_idx ON ndas(status);

-- Add indexes for RFP access
CREATE INDEX IF NOT EXISTS rfp_access_rfp_id_idx ON rfp_access(rfp_id);
CREATE INDEX IF NOT EXISTS rfp_access_user_id_idx ON rfp_access(user_id);
CREATE INDEX IF NOT EXISTS rfp_access_status_idx ON rfp_access(status);