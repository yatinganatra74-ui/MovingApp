/*
  # Create Default Company for New Users

  1. Problem
    - New users don't have a company or company_settings
    - This causes the CompanySettings page to fail

  2. Solution
    - Create a trigger that automatically creates:
      - A default company with proper fields
      - Company settings with defaults
      - Company user relationship
    - When a new user signs up

  3. Changes
    - Add function to create default company
    - Add trigger on auth.users table
    - Backfill existing users without companies
*/

-- Function to create default company for a user
CREATE OR REPLACE FUNCTION public.create_default_company_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_code_val text;
BEGIN
  -- Generate unique company code
  company_code_val := 'COMP' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

  -- Create a new company
  INSERT INTO companies (
    company_name,
    company_code,
    primary_contact_email,
    base_currency,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    'My Company',
    company_code_val,
    NEW.email,
    'USD',
    true,
    now(),
    now()
  )
  RETURNING id INTO new_company_id;

  -- Create company settings
  INSERT INTO company_settings (
    company_id,
    company_name,
    company_address,
    company_phone,
    company_email,
    company_website,
    primary_color,
    secondary_color,
    terms_and_conditions,
    quote_footer_text
  ) VALUES (
    new_company_id,
    'Your Freight Company',
    '',
    '',
    NEW.email,
    '',
    '#1F4E78',
    '#F59E0B',
    'Standard terms and conditions apply.',
    'Thank you for your business!'
  );

  -- Link user to company as owner
  INSERT INTO company_users (
    company_id,
    user_id,
    role,
    is_active
  ) VALUES (
    new_company_id,
    NEW.id,
    'owner',
    true
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_company_for_user();

-- Backfill existing users without companies
DO $$
DECLARE
  user_record RECORD;
  new_company_id uuid;
  company_code_val text;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN company_users cu ON u.id = cu.user_id
    WHERE cu.id IS NULL
  LOOP
    -- Generate unique company code
    company_code_val := 'COMP' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- Create a new company
    INSERT INTO companies (
      company_name,
      company_code,
      primary_contact_email,
      base_currency,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      'My Company',
      company_code_val,
      user_record.email,
      'USD',
      true,
      now(),
      now()
    )
    RETURNING id INTO new_company_id;

    -- Create company settings
    INSERT INTO company_settings (
      company_id,
      company_name,
      company_address,
      company_phone,
      company_email,
      company_website,
      primary_color,
      secondary_color,
      terms_and_conditions,
      quote_footer_text
    ) VALUES (
      new_company_id,
      'Your Freight Company',
      '',
      '',
      user_record.email,
      '',
      '#1F4E78',
      '#F59E0B',
      'Standard terms and conditions apply.',
      'Thank you for your business!'
    );

    -- Link user to company as owner
    INSERT INTO company_users (
      company_id,
      user_id,
      role,
      is_active
    ) VALUES (
      new_company_id,
      user_record.id,
      'owner',
      true
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION create_default_company_for_user IS 'Automatically creates a company and settings for new users';
