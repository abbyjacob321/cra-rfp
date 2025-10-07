/*
  # Add missing profile fields
  
  1. Changes
    - Add title and phone columns to profiles table
    - These fields are needed for the profile page functionality
*/

-- Add title column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS title text;

-- Add phone column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone text;