/*
  # Move Temporary Data to Database

  1. Changes
    - Add saved_rfps table for bookmarking functionality
    - Add analytics tables for tracking metrics
    - Add settings table for platform configuration
    - Add indexes for performance optimization
    - Add RLS policies for new tables

  2. Security
    - Enable RLS on all new tables
    - Add appropriate policies for data access
*/

-- Create saved_rfps table for bookmarking
CREATE TABLE IF NOT EXISTS saved_rfps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rfp_id uuid REFERENCES rfps(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, rfp_id)
);

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rfp_id uuid REFERENCES rfps(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Create analytics_metrics table for aggregated data
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  dimensions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE saved_rfps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS saved_rfps_user_id_idx ON saved_rfps(user_id);
CREATE INDEX IF NOT EXISTS saved_rfps_rfp_id_idx ON saved_rfps(rfp_id);
CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_metrics_name_idx ON analytics_metrics(metric_name);
CREATE INDEX IF NOT EXISTS analytics_metrics_period_idx ON analytics_metrics(period_start, period_end);

-- RLS Policies

-- Saved RFPs policies
CREATE POLICY "Users can view their own saved RFPs"
ON saved_rfps
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can save RFPs"
ON saved_rfps
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave RFPs"
ON saved_rfps
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Analytics events policies
CREATE POLICY "Only admins can view analytics events"
ON analytics_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "System can insert analytics events"
ON analytics_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Platform settings policies
CREATE POLICY "Admins can manage platform settings"
ON platform_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Everyone can view public settings"
ON platform_settings
FOR SELECT
TO authenticated
USING (key LIKE 'public.%');

-- Analytics metrics policies
CREATE POLICY "Only admins can view analytics metrics"
ON analytics_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Insert default platform settings
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

-- Function to track analytics events
CREATE OR REPLACE FUNCTION track_analytics_event(
  event_type text,
  user_id uuid DEFAULT NULL,
  rfp_id uuid DEFAULT NULL,
  metadata jsonb DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO analytics_events (event_type, user_id, rfp_id, metadata)
  VALUES (event_type, user_id, rfp_id, metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate analytics metrics
CREATE OR REPLACE FUNCTION aggregate_analytics_metrics(
  start_date timestamptz,
  end_date timestamptz
) RETURNS void AS $$
BEGIN
  -- Total RFPs
  INSERT INTO analytics_metrics (metric_name, metric_value, period_start, period_end, dimensions)
  SELECT 
    'total_rfps',
    COUNT(*),
    start_date,
    end_date,
    '{}'::jsonb
  FROM rfps
  WHERE created_at BETWEEN start_date AND end_date;

  -- Active RFPs
  INSERT INTO analytics_metrics (metric_name, metric_value, period_start, period_end, dimensions)
  SELECT 
    'active_rfps',
    COUNT(*),
    start_date,
    end_date,
    '{}'::jsonb
  FROM rfps
  WHERE status = 'active'
  AND created_at BETWEEN start_date AND end_date;

  -- Total Users
  INSERT INTO analytics_metrics (metric_name, metric_value, period_start, period_end, dimensions)
  SELECT 
    'total_users',
    COUNT(*),
    start_date,
    end_date,
    '{}'::jsonb
  FROM profiles
  WHERE created_at BETWEEN start_date AND end_date;

  -- Questions by Status
  INSERT INTO analytics_metrics (metric_name, metric_value, period_start, period_end, dimensions)
  SELECT 
    'questions_by_status',
    COUNT(*),
    start_date,
    end_date,
    jsonb_build_object('status', status)
  FROM questions
  WHERE created_at BETWEEN start_date AND end_date
  GROUP BY status;

  -- RFPs by Category
  INSERT INTO analytics_metrics (metric_name, metric_value, period_start, period_end, dimensions)
  SELECT 
    'rfps_by_category',
    COUNT(*),
    start_date,
    end_date,
    jsonb_build_object('category', category)
  FROM rfps, unnest(categories) category
  WHERE created_at BETWEEN start_date AND end_date
  GROUP BY category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;