/*
  # Add Company Branding Fields to Company Settings

  1. Changes to company_settings table
    - Add company_name (text)
    - Add company_address (text)
    - Add company_phone (text)
    - Add company_email (text)
    - Add company_website (text)
    - Add logo_url (text) - URL to logo in storage
    - Add primary_color (text) - Hex color for branding
    - Add secondary_color (text)
    - Add tax_id (text)
    - Add bank_details (text)
    - Add terms_and_conditions (text)
    - Add quote_footer_text (text)

  2. Storage
    - Create storage bucket for company logos if not exists
    - Set up RLS policies for logo access

  3. Security
    - Company settings RLS already exists
    - Add storage policies for logos
*/

-- Add branding columns to existing company_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_name text DEFAULT 'Your Freight Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_address'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_address text DEFAULT '123 Logistics Street, Trade City';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_phone'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_phone text DEFAULT '+1-234-567-8900';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_email text DEFAULT 'info@yourfreight.com';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_website'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_website text DEFAULT 'www.yourfreight.com';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN primary_color text DEFAULT '#1F4E78';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'secondary_color'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN secondary_color text DEFAULT '#2D5F8D';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN tax_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'bank_details'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN bank_details text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'terms_and_conditions'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN terms_and_conditions text DEFAULT '1. This quotation is valid for 30 days from the date of issue.
2. Rates are subject to currency fluctuations and may be adjusted accordingly.
3. All charges are exclusive of taxes unless stated otherwise.
4. Cargo must be ready for collection on the agreed date.
5. Payment terms: As per agreed credit terms or proforma invoice.
6. The carrier reserves the right to increase rates in case of market changes.
7. Insurance is not included unless specifically mentioned.
8. Additional charges may apply for special handling or hazardous goods.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'quote_footer_text'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN quote_footer_text text DEFAULT 'Thank you for your business!';
  END IF;
END $$;

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view company logos'
  ) THEN
    CREATE POLICY "Anyone can view company logos"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'company-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload company logos'
  ) THEN
    CREATE POLICY "Authenticated users can upload company logos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'company-logos' AND
        auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update company logos'
  ) THEN
    CREATE POLICY "Authenticated users can update company logos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'company-logos')
      WITH CHECK (bucket_id = 'company-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete company logos'
  ) THEN
    CREATE POLICY "Authenticated users can delete company logos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'company-logos' AND
        auth.role() = 'authenticated'
      );
  END IF;
END $$;

COMMENT ON COLUMN company_settings.logo_url IS 'URL to company logo in storage bucket';
COMMENT ON COLUMN company_settings.primary_color IS 'Primary brand color in hex format';
COMMENT ON COLUMN company_settings.company_name IS 'Company name for branding';
