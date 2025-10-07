/*
  # Add rfp_interest notification type

  1. Schema Updates
    - Add 'rfp_interest' to the notification type check constraint
*/

-- Update the constraint to include rfp_interest type
ALTER TABLE IF EXISTS notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE IF EXISTS notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'rfp_published', 
  'rfp_updated', 
  'rfp_closed', 
  'question_answered', 
  'nda_approved', 
  'nda_rejected', 
  'access_granted',
  'access_denied',
  'system_notice',
  'rfp_interest'
]));