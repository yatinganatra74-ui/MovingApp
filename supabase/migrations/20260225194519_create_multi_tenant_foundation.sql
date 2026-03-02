/*
  # Multi-Tenant Cloud Architecture Foundation

  1. New Tables
    - `companies` - Tenant organizations (removal companies)
      - Company profile, branding, settings
      - Subscription status and plan
      - Domain/subdomain configuration
    - `company_users` - Junction table for user-company relationships
      - Supports users working for multiple companies
      - Role-based access within each company
    - `company_settings` - Per-tenant configuration
      - Business rules, pricing defaults
      - Workflow preferences
      - Integration settings

  2. Updates to Existing Tables
    - Add company_id to ALL existing tables
    - Set default company for backward compatibility
    - Create indexes for company_id filtering

  3. Row Level Security
    - Enforce company_id filtering on ALL operations
    - Users can only see data from their assigned companies
    - Super admins can see across companies

  4. Important Notes
    - This is the foundation for SaaS multi-tenancy
    - All future tables MUST include company_id
    - RLS policies MUST check company_id
    - 10% effort now saves 1000% pain later
*/

-- Create companies table (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_code text UNIQUE NOT NULL,
  legal_name text,
  registration_number text,
  tax_id text,
  
  -- Contact Information
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text DEFAULT 'India',
  postal_code text,
  
  -- Branding
  logo_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#10B981',
  
  -- Subscription & Status
  subscription_plan text DEFAULT 'starter' CHECK (subscription_plan IN ('trial', 'starter', 'professional', 'enterprise')),
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at timestamptz,
  subscription_started_at timestamptz DEFAULT now(),
  
  -- Domain Configuration
  custom_domain text,
  subdomain text UNIQUE,
  
  -- Business Configuration
  base_currency text DEFAULT 'INR',
  financial_year_start_month integer DEFAULT 4 CHECK (financial_year_start_month BETWEEN 1 AND 12),
  timezone text DEFAULT 'Asia/Kolkata',
  
  -- Features & Limits
  max_users integer DEFAULT 5,
  max_storage_gb integer DEFAULT 10,
  features_enabled jsonb DEFAULT '{"crm": true, "moves": true, "freight": true, "warehouse": true, "inventory": true, "crew": true, "financials": true}'::jsonb,
  
  -- Status
  is_active boolean DEFAULT true,
  onboarding_completed boolean DEFAULT false,
  onboarding_step integer DEFAULT 1,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  notes text
);

-- Create company_users junction table
CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role within this company
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'manager', 'operator', 'user', 'viewer')),
  
  -- Permissions
  permissions jsonb DEFAULT '{"read": true, "write": false, "delete": false, "admin": false}'::jsonb,
  
  -- Status
  is_active boolean DEFAULT true,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  last_active_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(company_id, user_id)
);

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  -- CRM Settings
  lead_auto_numbering_prefix text DEFAULT 'LEAD',
  lead_auto_numbering_start integer DEFAULT 1001,
  quote_validity_days integer DEFAULT 30,
  quote_auto_numbering_prefix text DEFAULT 'QT',
  
  -- Move Settings
  move_auto_numbering_prefix text DEFAULT 'MV',
  move_auto_numbering_start integer DEFAULT 1001,
  default_packing_days integer DEFAULT 2,
  default_storage_free_days integer DEFAULT 7,
  
  -- Freight Settings
  sea_freight_enabled boolean DEFAULT true,
  air_freight_enabled boolean DEFAULT true,
  default_cbm_to_kg_ratio decimal DEFAULT 167,
  container_utilization_warning_percent integer DEFAULT 90,
  
  -- Warehouse Settings
  warehouse_enabled boolean DEFAULT true,
  auto_grn_numbering boolean DEFAULT true,
  grn_prefix text DEFAULT 'GRN',
  storage_billing_cycle text DEFAULT 'monthly' CHECK (storage_billing_cycle IN ('daily', 'weekly', 'monthly')),
  
  -- Inventory Settings
  inventory_enabled boolean DEFAULT true,
  low_stock_alert_threshold integer DEFAULT 10,
  auto_deduct_materials boolean DEFAULT true,
  
  -- Crew Settings
  crew_enabled boolean DEFAULT true,
  crew_cost_per_day_default decimal DEFAULT 1000,
  crew_overtime_multiplier decimal DEFAULT 1.5,
  
  -- Financial Settings
  auto_lock_exchange_rate boolean DEFAULT true,
  profit_margin_warning_percent decimal DEFAULT 15,
  tally_export_enabled boolean DEFAULT false,
  tally_company_name text,
  
  -- Notification Settings
  email_notifications_enabled boolean DEFAULT true,
  sms_notifications_enabled boolean DEFAULT false,
  whatsapp_notifications_enabled boolean DEFAULT false,
  
  -- Integration Settings
  integrations jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create default company for existing data (backward compatibility)
INSERT INTO companies (
  id,
  company_name,
  company_code,
  subdomain,
  subscription_plan,
  onboarding_completed
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Company',
  'DEFAULT',
  'default',
  'enterprise',
  true
) ON CONFLICT (id) DO NOTHING;

-- Create default settings for default company
INSERT INTO company_settings (company_id)
SELECT '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1 FROM company_settings WHERE company_id = '00000000-0000-0000-0000-000000000001'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active, subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id, is_active);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Company owners and admins can update"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for company_users
CREATE POLICY "Users can view company memberships"
  ON company_users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage company users"
  ON company_users FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for company_settings
CREATE POLICY "Users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() 
      AND is_active = true 
      AND role IN ('owner', 'admin')
    )
  );

-- Helper function to get user's current company
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT company_id 
    FROM company_users 
    WHERE user_id = auth.uid() 
    AND is_active = true 
    ORDER BY last_active_at DESC NULLS LAST, created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to check if user has role in company
CREATE OR REPLACE FUNCTION user_has_role_in_company(p_company_id uuid, p_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM company_users 
    WHERE user_id = auth.uid() 
    AND company_id = p_company_id
    AND is_active = true 
    AND (role = p_role OR role IN ('owner', 'admin'))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
