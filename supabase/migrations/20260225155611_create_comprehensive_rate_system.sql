/*
  # Comprehensive Rate and Operations Management System

  1. New Tables
    - `agents`
      - `id` (uuid, primary key)
      - `name` (text) - Agent/Company name
      - `type` (text) - 'shipping_line', 'freight_forwarder', 'customs_broker', 'warehouse', 'transport'
      - `contact_name` (text)
      - `email` (text)
      - `phone` (text)
      - `address` (text)
      - `country` (text)
      - `is_active` (boolean)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rate_sheets`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, foreign key) - Which agent provided this rate sheet
      - `name` (text)
      - `type` (text) - 'import', 'export'
      - `effective_from` (date)
      - `effective_to` (date)
      - `currency` (text)
      - `is_active` (boolean)
      - `notes` (text)
      - `created_by` (uuid)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rate_sheet_items`
      - `id` (uuid, primary key)
      - `rate_sheet_id` (uuid, foreign key)
      - `origin_country` (text)
      - `origin_port` (text)
      - `destination_country` (text)
      - `destination_port` (text)
      - `service_type` (text) - 'FCL', 'LCL', 'Air', 'Road'
      - `container_type` (text) - '20ft', '40ft', '40ft HC', etc.
      - `rate` (decimal) - Main rate
      - `currency` (text)
      - `transit_days` (integer)
      - `valid_from` (date)
      - `valid_to` (date)
      - `notes` (text)
      - `created_at` (timestamp)

    - `containers`
      - `id` (uuid, primary key)
      - `container_number` (text, unique)
      - `type` (text) - '20ft', '40ft', '40ft HC', '20ft RF', '40ft RF'
      - `status` (text) - 'available', 'in_use', 'maintenance', 'retired'
      - `current_location` (text)
      - `condition` (text) - 'excellent', 'good', 'fair', 'poor'
      - `last_inspection_date` (date)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `shipments`
      - `id` (uuid, primary key)
      - `shipment_number` (text, unique)
      - `quote_id` (uuid, foreign key to quotes)
      - `job_id` (uuid, foreign key to jobs)
      - `agent_id` (uuid, foreign key to agents)
      - `origin_country` (text)
      - `origin_port` (text)
      - `destination_country` (text)
      - `destination_port` (text)
      - `service_type` (text)
      - `status` (text) - 'booking', 'in_transit', 'customs', 'delivered', 'cancelled'
      - `booking_date` (date)
      - `etd` (date) - Estimated time of departure
      - `eta` (date) - Estimated time of arrival
      - `atd` (date) - Actual time of departure
      - `ata` (date) - Actual time of arrival
      - `total_volume` (decimal)
      - `total_weight` (decimal)
      - `notes` (text)
      - `created_by` (uuid)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `shipment_revenue`
      - `id` (uuid, primary key)
      - `shipment_id` (uuid, foreign key)
      - `description` (text)
      - `category` (text) - 'freight', 'surcharge', 'handling', 'documentation', 'insurance', 'other'
      - `amount` (decimal)
      - `currency` (text)
      - `exchange_rate` (decimal)
      - `amount_in_base_currency` (decimal)
      - `invoice_id` (uuid, nullable)
      - `created_at` (timestamp)

    - `shipment_costs`
      - `id` (uuid, primary key)
      - `shipment_id` (uuid, foreign key)
      - `agent_id` (uuid, foreign key) - Who we're paying
      - `description` (text)
      - `category` (text) - 'freight', 'surcharge', 'handling', 'documentation', 'customs', 'other'
      - `amount` (decimal)
      - `currency` (text)
      - `exchange_rate` (decimal)
      - `amount_in_base_currency` (decimal)
      - `payment_status` (text) - 'pending', 'paid', 'overdue'
      - `payment_date` (date)
      - `created_at` (timestamp)

    - `exchange_rates`
      - `id` (uuid, primary key)
      - `from_currency` (text)
      - `to_currency` (text)
      - `rate` (decimal)
      - `effective_date` (date)
      - `created_at` (timestamp)

    - `storage_records`
      - `id` (uuid, primary key)
      - `shipment_id` (uuid, foreign key)
      - `location` (text)
      - `storage_type` (text) - 'warehouse', 'container_yard', 'bonded'
      - `start_date` (date)
      - `end_date` (date)
      - `daily_rate` (decimal)
      - `total_days` (integer)
      - `total_cost` (decimal)
      - `currency` (text)
      - `paid` (boolean)
      - `notes` (text)
      - `created_at` (timestamp)

    - `extra_charges`
      - `id` (uuid, primary key)
      - `shipment_id` (uuid, foreign key)
      - `charge_name` (text)
      - `charge_type` (text) - 'demurrage', 'detention', 'late_fee', 'admin', 'other'
      - `amount` (decimal)
      - `currency` (text)
      - `reason` (text)
      - `charged_date` (date)
      - `paid` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('shipping_line', 'freight_forwarder', 'customs_broker', 'warehouse', 'transport', 'other')),
  contact_name text,
  email text,
  phone text,
  address text,
  country text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agents"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert agents"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update agents"
  ON agents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete agents"
  ON agents FOR DELETE
  TO authenticated
  USING (true);

-- Update RateSheets to include agent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_sheets' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE rate_sheets ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RateSheetItems (rename from rate_sheet_lanes for consistency)
CREATE TABLE IF NOT EXISTS rate_sheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  origin_country text NOT NULL,
  origin_port text NOT NULL,
  destination_country text NOT NULL,
  destination_port text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('FCL', 'LCL', 'Air', 'Road')),
  container_type text,
  rate decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  transit_days integer,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_sheet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheet items"
  ON rate_sheet_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheet items"
  ON rate_sheet_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update rate sheet items"
  ON rate_sheet_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete rate sheet items"
  ON rate_sheet_items FOR DELETE
  TO authenticated
  USING (true);

-- Containers Table
CREATE TABLE IF NOT EXISTS containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('20ft', '40ft', '40ft HC', '20ft RF', '40ft RF', '45ft HC')),
  status text DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  current_location text,
  condition text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  last_inspection_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view containers"
  ON containers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert containers"
  ON containers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update containers"
  ON containers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete containers"
  ON containers FOR DELETE
  TO authenticated
  USING (true);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE NOT NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  origin_country text NOT NULL,
  origin_port text NOT NULL,
  destination_country text NOT NULL,
  destination_port text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('FCL', 'LCL', 'Air', 'Road')),
  status text DEFAULT 'booking' CHECK (status IN ('booking', 'in_transit', 'customs', 'delivered', 'cancelled')),
  booking_date date DEFAULT CURRENT_DATE,
  etd date,
  eta date,
  atd date,
  ata date,
  total_volume decimal(10, 2),
  total_weight decimal(10, 2),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipments"
  ON shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert shipments"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update shipments"
  ON shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete shipments"
  ON shipments FOR DELETE
  TO authenticated
  USING (true);

-- ShipmentRevenue Table
CREATE TABLE IF NOT EXISTS shipment_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('freight', 'surcharge', 'handling', 'documentation', 'insurance', 'other')),
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate decimal(10, 6) DEFAULT 1,
  amount_in_base_currency decimal(10, 2),
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipment revenue"
  ON shipment_revenue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert shipment revenue"
  ON shipment_revenue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipment revenue"
  ON shipment_revenue FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete shipment revenue"
  ON shipment_revenue FOR DELETE
  TO authenticated
  USING (true);

-- ShipmentCosts Table
CREATE TABLE IF NOT EXISTS shipment_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('freight', 'surcharge', 'handling', 'documentation', 'customs', 'storage', 'other')),
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate decimal(10, 6) DEFAULT 1,
  amount_in_base_currency decimal(10, 2),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  payment_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipment costs"
  ON shipment_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert shipment costs"
  ON shipment_costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipment costs"
  ON shipment_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete shipment costs"
  ON shipment_costs FOR DELETE
  TO authenticated
  USING (true);

-- ExchangeRates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate decimal(10, 6) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_currency, to_currency, effective_date)
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert exchange rates"
  ON exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update exchange rates"
  ON exchange_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete exchange rates"
  ON exchange_rates FOR DELETE
  TO authenticated
  USING (true);

-- StorageRecords Table
CREATE TABLE IF NOT EXISTS storage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  location text NOT NULL,
  storage_type text NOT NULL CHECK (storage_type IN ('warehouse', 'container_yard', 'bonded', 'other')),
  start_date date NOT NULL,
  end_date date,
  daily_rate decimal(10, 2) NOT NULL,
  total_days integer,
  total_cost decimal(10, 2),
  currency text NOT NULL DEFAULT 'USD',
  paid boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE storage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storage records"
  ON storage_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert storage records"
  ON storage_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update storage records"
  ON storage_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete storage records"
  ON storage_records FOR DELETE
  TO authenticated
  USING (true);

-- ExtraCharges Table
CREATE TABLE IF NOT EXISTS extra_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  charge_name text NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('demurrage', 'detention', 'late_fee', 'admin', 'inspection', 'other')),
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  charged_date date DEFAULT CURRENT_DATE,
  paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE extra_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view extra charges"
  ON extra_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert extra charges"
  ON extra_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update extra charges"
  ON extra_charges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete extra charges"
  ON extra_charges FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_sheet_items_sheet_id ON rate_sheet_items(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_items_route ON rate_sheet_items(origin_country, origin_port, destination_country, destination_port);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_agent ON shipments(agent_id);
CREATE INDEX IF NOT EXISTS idx_shipment_revenue_shipment ON shipment_revenue(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_costs_shipment ON shipment_costs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_costs_agent ON shipment_costs(agent_id);
CREATE INDEX IF NOT EXISTS idx_storage_records_shipment ON storage_records(shipment_id);
CREATE INDEX IF NOT EXISTS idx_extra_charges_shipment ON extra_charges(shipment_id);

-- Create triggers for updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();