/*
  # Advanced Features for Removals Platform

  ## New Capabilities
  1. Multi-currency accounting support
  2. Groupage container management (multiple clients per container)
  3. Destination cost control and profitability tracking
  4. Agent billing vs local customer billing separation

  ## New Tables

  1. `currencies` - Supported currencies
     - `id` (uuid, primary key)
     - `code` (text) - ISO currency code (USD, EUR, GBP, INR, etc.)
     - `name` (text)
     - `symbol` (text)
     - `exchange_rate` (numeric) - Rate to base currency
     - `active` (boolean)

  2. `groupage_shipments` - Container groupage tracking
     - `id` (uuid, primary key)
     - `container_id` (uuid)
     - `shipment_name` (text)
     - `departure_date` (timestamptz)
     - `arrival_date` (timestamptz)
     - `status` (text)
     - `total_capacity_used` (numeric)

  3. `groupage_allocations` - Jobs assigned to groupage containers
     - `id` (uuid, primary key)
     - `groupage_shipment_id` (uuid)
     - `job_id` (uuid)
     - `allocated_space` (numeric)
     - `cost_share` (numeric)

  4. `destination_costs` - Inbound handling costs and profitability
     - `id` (uuid, primary key)
     - `job_id` (uuid)
     - `cost_category` (text) - customs, port_handling, delivery, storage
     - `description` (text)
     - `cost_amount` (numeric)
     - `currency_id` (uuid)
     - `billed_amount` (numeric)
     - `profit_margin` (numeric)

  5. `agent_invoices` - Separate invoicing for agents vs customers
     - `id` (uuid, primary key)
     - `job_id` (uuid)
     - `invoice_type` (text) - agent_billing, customer_billing
     - `invoice_number` (text)
     - `invoice_date` (timestamptz)
     - `due_date` (timestamptz)
     - `currency_id` (uuid)
     - `subtotal` (numeric)
     - `tax` (numeric)
     - `total` (numeric)
     - `paid_amount` (numeric)
     - `status` (text)
     - `agent_name` (text)
     - `agent_reference` (text)

  ## Modifications
  - Add currency support to existing tables
  - Update quotes, invoices to support multi-currency
  - Add groupage tracking to containers
*/

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  exchange_rate numeric DEFAULT 1.0,
  active boolean DEFAULT true
);

-- Create groupage shipments table
CREATE TABLE IF NOT EXISTS groupage_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid REFERENCES containers(id),
  shipment_name text NOT NULL,
  departure_date timestamptz,
  arrival_date timestamptz,
  status text DEFAULT 'planning',
  total_capacity_used numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create groupage allocations table
CREATE TABLE IF NOT EXISTS groupage_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groupage_shipment_id uuid REFERENCES groupage_shipments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  allocated_space numeric DEFAULT 0,
  cost_share numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create destination costs table
CREATE TABLE IF NOT EXISTS destination_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  cost_category text NOT NULL,
  description text,
  cost_amount numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  billed_amount numeric DEFAULT 0,
  profit_margin numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create agent invoices table
CREATE TABLE IF NOT EXISTS agent_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  invoice_type text NOT NULL,
  invoice_number text UNIQUE NOT NULL,
  invoice_date timestamptz DEFAULT now(),
  due_date timestamptz,
  currency_id uuid REFERENCES currencies(id),
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  agent_name text,
  agent_reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add currency support to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN currency_id uuid REFERENCES currencies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'currency_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN currency_id uuid REFERENCES currencies(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage currencies"
  ON currencies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view groupage_shipments"
  ON groupage_shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage groupage_shipments"
  ON groupage_shipments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view groupage_allocations"
  ON groupage_allocations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage groupage_allocations"
  ON groupage_allocations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view destination_costs"
  ON destination_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage destination_costs"
  ON destination_costs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view agent_invoices"
  ON agent_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent_invoices"
  ON agent_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default currencies
INSERT INTO currencies (code, name, symbol, exchange_rate) VALUES
  ('USD', 'US Dollar', '$', 1.0),
  ('EUR', 'Euro', '€', 0.92),
  ('GBP', 'British Pound', '£', 0.79),
  ('INR', 'Indian Rupee', '₹', 83.12),
  ('AED', 'UAE Dirham', 'د.إ', 3.67),
  ('AUD', 'Australian Dollar', 'A$', 1.52),
  ('CAD', 'Canadian Dollar', 'C$', 1.36),
  ('SGD', 'Singapore Dollar', 'S$', 1.34)
ON CONFLICT (code) DO NOTHING;