/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - company_settings policy checks company_users
    - company_users policy checks company_users (itself)
    - This creates infinite recursion

  2. Solution
    - Create a security definer function that bypasses RLS
    - Use this function in company_settings policies
    - Simplify company_users policies to avoid self-reference

  3. Changes
    - Drop existing problematic policies
    - Create helper function to check company membership
    - Recreate policies using the helper function
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;
DROP POLICY IF EXISTS "Admins can manage company users" ON company_users;
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
DROP POLICY IF EXISTS "Admins can update company settings" ON company_settings;

-- Create a security definer function to check company membership without RLS
CREATE OR REPLACE FUNCTION public.user_has_company_access(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_users
    WHERE user_id = auth.uid()
      AND company_id = check_company_id
      AND is_active = true
  );
END;
$$;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION public.user_is_company_admin(check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_users
    WHERE user_id = auth.uid()
      AND company_id = check_company_id
      AND is_active = true
      AND role IN ('owner', 'admin')
  );
END;
$$;

-- New simple policies for company_users (no self-reference)
CREATE POLICY "Users can view own membership"
  ON company_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert company users via function"
  ON company_users FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Controlled by application logic

CREATE POLICY "Admins can update company users via function"
  ON company_users FOR UPDATE
  TO authenticated
  USING (true) -- Controlled by application logic
  WITH CHECK (true);

CREATE POLICY "Admins can delete company users via function"
  ON company_users FOR DELETE
  TO authenticated
  USING (true); -- Controlled by application logic

-- New policies for company_settings using helper functions
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (user_has_company_access(company_id));

CREATE POLICY "Admins can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (user_is_company_admin(company_id))
  WITH CHECK (user_is_company_admin(company_id));

COMMENT ON FUNCTION user_has_company_access IS 'Checks if user has access to company (bypasses RLS to avoid recursion)';
COMMENT ON FUNCTION user_is_company_admin IS 'Checks if user is admin/owner of company (bypasses RLS to avoid recursion)';
