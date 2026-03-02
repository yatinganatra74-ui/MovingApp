/*
  # Master Data Tables

  Creates master data tables for freight forwarding operations:
  - Customer KYC
  - Customer Move Preferences  
  - Vendors (Labour, Transport, etc.)
  - Shipping Lines
  - Freight Forwarders
  - Service Types
*/

-- Create customer KYC table
CREATE TABLE IF NOT EXISTS customer_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  pan_number text,
  gst_number text,
  aadhar_number text,
  passport_number text,
  passport_expiry date,
  visa_details text,
  kyc_verified boolean DEFAULT false,
  kyc_verified_date timestamptz,
  kyc_verified_by uuid REFERENCES auth.users(id),
  kyc_documents jsonb DEFAULT '[]'::jsonb,
  credit_limit numeric DEFAULT 0,
  credit_days integer DEFAULT 0,
  credit_approved boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customer move preferences table
CREATE TABLE IF NOT EXISTS customer_move_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  preferred_service_type text,
  packing_required boolean DEFAULT true,
  insurance_required boolean DEFAULT false,
  storage_required boolean DEFAULT false,
  preferred_transport_mode text,
  special_requirements text,
  preferred_packing_materials jsonb DEFAULT '[]'::jsonb,
  default_origin_port text,
  default_destination_port text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_type text NOT NULL,
  vendor_code text UNIQUE NOT NULL,
  company_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  pan_number text,
  gst_number text,
  service_types jsonb DEFAULT '[]'::jsonb,
  coverage_areas jsonb DEFAULT '[]'::jsonb,
  rate_structure jsonb DEFAULT '{}'::jsonb,
  payment_terms text,
  bank_details jsonb DEFAULT '{}'::jsonb,
  msme_registered boolean DEFAULT false,
  insurance_details jsonb DEFAULT '{}'::jsonb,
  license_numbers jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  rating numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shipping lines table
CREATE TABLE IF NOT EXISTS shipping_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text UNIQUE NOT NULL,
  company_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  website text,
  address text,
  country text,
  service_routes jsonb DEFAULT '[]'::jsonb,
  container_types jsonb DEFAULT '[]'::jsonb,
  payment_terms text,
  credit_limit numeric DEFAULT 0,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create freight forwarders table
CREATE TABLE IF NOT EXISTS freight_forwarders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_code text UNIQUE NOT NULL,
  company_name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  pan_number text,
  gst_number text,
  service_types jsonb DEFAULT '[]'::jsonb,
  operating_ports jsonb DEFAULT '[]'::jsonb,
  license_numbers jsonb DEFAULT '{}'::jsonb,
  payment_terms text,
  bank_details jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  rating numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create service type master table
CREATE TABLE IF NOT EXISTS service_type_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code text UNIQUE NOT NULL,
  service_name text NOT NULL,
  service_category text NOT NULL,
  description text,
  requires_origin_handling boolean DEFAULT true,
  requires_destination_handling boolean DEFAULT true,
  requires_transport boolean DEFAULT true,
  requires_customs boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_move_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_forwarders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_type_master ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users full access customer_kyc"
  ON customer_kyc FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access preferences"
  ON customer_move_preferences FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access vendors"
  ON vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access shipping_lines"
  ON shipping_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access freight_forwarders"
  ON freight_forwarders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access service_types"
  ON service_type_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_kyc_customer ON customer_kyc(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_move_preferences(customer_id);
CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(active);

-- Insert default service types
INSERT INTO service_type_master (service_code, service_name, service_category, description, requires_origin_handling, requires_destination_handling, requires_transport, requires_customs)
VALUES 
  ('DTD', 'Door to Door', 'door-to-door', 'Complete door-to-door moving service with packing, transport, and unpacking', true, true, true, false),
  ('DTP', 'Door to Port', 'door-to-port', 'Packing and transport from origin to port', true, false, true, true),
  ('PTD', 'Port to Door', 'port-to-door', 'Transport from destination port to final address with unpacking', false, true, true, true),
  ('PTP', 'Port to Port', 'port-to-port', 'Port-to-port shipping only', false, false, false, true)
ON CONFLICT (service_code) DO NOTHING;
