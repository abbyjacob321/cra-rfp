/*
  # Add notifications system
  
  1. Changes
    - Create notifications table for storing user notifications
    - Add indexes for performance optimization
    - Add RLS policies for secure access
    - Add triggers for automatic notification generation
    - Add functions for notification management
  
  2. Security
    - Enable RLS on notifications table
    - Add policies for user access
    - Ensure secure notification creation
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'rfp_published',
    'rfp_updated',
    'rfp_closed',
    'question_answered',
    'nda_approved',
    'nda_rejected',
    'access_granted',
    'access_denied',
    'system_notice'
  )),
  reference_id uuid, -- Optional reference to related item (RFP, question, etc)
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications(read_at);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their notifications as read"
ON notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  -- Only allow updating read_at field
  auth.uid() = user_id AND
  (read_at IS NULL)  -- Ensure read_at is being set from NULL
);

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_reference_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    reference_id
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_reference_id
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to create notifications on RFP events
CREATE OR REPLACE FUNCTION on_rfp_event() RETURNS trigger AS $$
BEGIN
  -- RFP published
  IF TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status = 'draft' THEN
    -- Notify all users with bidder role
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    SELECT 
      profiles.id,
      'New RFP Published',
      'A new RFP has been published: ' || NEW.title,
      'rfp_published',
      NEW.id
    FROM profiles
    WHERE profiles.role = 'bidder';
  END IF;

  -- RFP closed
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status = 'active' THEN
    -- Notify users with access to this RFP
    INSERT INTO notifications (user_id, title, message, type, reference_id)
    SELECT 
      rfp_access.user_id,
      'RFP Closed',
      'The RFP "' || NEW.title || '" has been closed.',
      'rfp_closed',
      NEW.id
    FROM rfp_access
    WHERE rfp_access.rfp_id = NEW.id AND rfp_access.status = 'approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for RFP events
DROP TRIGGER IF EXISTS rfp_notification_trigger ON rfps;
CREATE TRIGGER rfp_notification_trigger
  AFTER UPDATE ON rfps
  FOR EACH ROW
  EXECUTE FUNCTION on_rfp_event();

-- Trigger function to create notifications on question answers
CREATE OR REPLACE FUNCTION on_question_answered() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status != 'published' THEN
    -- Notify the question asker
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      reference_id
    ) VALUES (
      NEW.user_id,
      'Question Answered',
      'Your question about "' || (SELECT title FROM rfps WHERE id = NEW.rfp_id) || '" has been answered.',
      'question_answered',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for question answers
DROP TRIGGER IF EXISTS question_answered_notification_trigger ON questions;
CREATE TRIGGER question_answered_notification_trigger
  AFTER UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION on_question_answered();

-- Trigger function to create notifications on NDA status changes
CREATE OR REPLACE FUNCTION on_nda_status_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    -- NDA approved
    IF NEW.status = 'signed' THEN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        reference_id
      ) VALUES (
        NEW.user_id,
        'NDA Approved',
        'Your NDA for "' || (SELECT title FROM rfps WHERE id = NEW.rfp_id) || '" has been approved.',
        'nda_approved',
        NEW.id
      );
    -- NDA rejected
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        reference_id
      ) VALUES (
        NEW.user_id,
        'NDA Rejected',
        'Your NDA for "' || (SELECT title FROM rfps WHERE id = NEW.rfp_id) || '" has been rejected.',
        'nda_rejected',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for NDA status changes
DROP TRIGGER IF EXISTS nda_notification_trigger ON ndas;
CREATE TRIGGER nda_notification_trigger
  AFTER UPDATE ON ndas
  FOR EACH ROW
  EXECUTE FUNCTION on_nda_status_change();

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