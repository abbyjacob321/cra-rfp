/*
  # Add function to promote users to admin role
  
  1. Changes
     - Add function to promote user to admin
     - Updates both profile and auth.users metadata
     - Ensures consistent role state
*/

-- Function to promote a user to admin
CREATE OR REPLACE FUNCTION promote_to_admin(user_email TEXT)
RETURNS void AS $$
BEGIN
  -- Update the profile
  UPDATE profiles 
  SET role = 'admin'
  WHERE email = user_email;
  
  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_app_meta_data = 
    jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'
    )
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON profiles
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.jwt()
    WHERE auth.jwt()->>'role' = 'admin'
  )
);

-- Create your first admin user by running:
-- SELECT promote_to_admin('your-email@example.com');