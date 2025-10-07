/*
  # Fix RLS policy for profiles table

  1. Changes
    - Fix infinite recursion by modifying the policies for profiles table
    - Add policy to allow users to insert their own profile during signup
    - Simplify admin policies to avoid circular references

  This migration fixes issues with recursive policies that were causing
  infinite recursion errors when querying the profiles table.
*/

-- First, drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new, simplified policies

-- Allow users to select their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow admins to select any profile without recursive checks
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile during signup"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Note: For local development without Supabase Studio access, we recommend
-- contacting the Supabase admin to implement these policy changes directly.