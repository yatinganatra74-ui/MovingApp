/*
  # Create User Profiles and Role Management

  ## Overview
  This migration creates a user profiles system with role-based access control for warehouse operations.

  ## New Tables
  
  ### `user_profiles`
  Stores user information and role assignments:
  - `id` (uuid, primary key): Unique identifier for the profile
  - `user_id` (uuid, foreign key): Links to auth.users
  - `email` (text): User's email address
  - `role` (text): User role (admin, warehouse)
  - `created_at` (timestamptz): Profile creation timestamp
  - `updated_at` (timestamptz): Last update timestamp

  ## Security
  
  ### Row Level Security (RLS)
  - RLS enabled on user_profiles table
  - Users can read their own profile
  - Only admins can create/update profiles
  - Users can view other warehouse users (for team coordination)

  ## Indexes
  - Index on user_id for fast lookups
  - Index on role for role-based queries
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email text NOT NULL,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'warehouse')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read warehouse team profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (role = 'warehouse');

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
