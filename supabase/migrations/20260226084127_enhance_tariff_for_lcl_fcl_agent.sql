/*
  # Enhance Tariff System for LCL, FCL, and Agent Quotes

  1. Changes
    - Add shipment_type to groupage_tariffs (LCL, FCL, AIR)
    - Add container-specific fields for FCL pricing
    - Add agent_selling_rate flag for agent quotes
    - Add new FCL container rate structure
    - Enhance quote system for agent quotes

  2. New Features
    - LCL: CBM-based pricing (existing)
    - FCL: Container-based pricing (20ft, 40ft, 40HC)
    - Agent Quotes: Customer-facing vs agent buying rates
    - Multi-carrier support
    - Validity tracking

  3. Security
    - Maintain existing RLS policies
*/

-- Add new columns to groupage_tariffs for LCL/FCL/Agent support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'shipment_type'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN shipment_type text DEFAULT 'LCL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'carrier_name'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN carrier_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'is_agent_rate'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN is_agent_rate boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'free_days'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN free_days integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'port_of_loading'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN port_of_loading text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'port_of_discharge'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN port_of_discharge text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_tariffs' AND column_name = 'validity_type'
  ) THEN
    ALTER TABLE groupage_tariffs ADD COLUMN validity_type text DEFAULT 'fixed';
  END IF;
END $$;

-- Create FCL container rates table
CREATE TABLE IF NOT EXISTS groupage_fcl_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id uuid REFERENCES groupage_tariffs(id) ON DELETE CASCADE,
  container_type text NOT NULL,
  rate_per_container numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  includes_baf boolean DEFAULT false,
  includes_caf boolean DEFAULT false,
  baf_amount numeric(10,2) DEFAULT 0,
  caf_amount numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add agent-specific fields to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'is_agent_quote'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN is_agent_quote boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN agent_id uuid REFERENCES customers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'buying_rate'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN buying_rate numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'selling_rate'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN selling_rate numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN margin_amount numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'margin_percentage'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN margin_percentage numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'shipment_type'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN shipment_type text DEFAULT 'LCL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'container_type'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN container_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'number_of_containers'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN number_of_containers integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS on new table
ALTER TABLE groupage_fcl_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groupage_fcl_rates
CREATE POLICY "Users can view FCL rates"
  ON groupage_fcl_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create FCL rates"
  ON groupage_fcl_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update FCL rates"
  ON groupage_fcl_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete FCL rates"
  ON groupage_fcl_rates FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_shipment_type ON groupage_tariffs(shipment_type);
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_carrier ON groupage_tariffs(carrier_name);
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_agent ON groupage_tariffs(is_agent_rate);
CREATE INDEX IF NOT EXISTS idx_groupage_fcl_rates_tariff ON groupage_fcl_rates(tariff_id);
CREATE INDEX IF NOT EXISTS idx_groupage_fcl_rates_container_type ON groupage_fcl_rates(container_type);
CREATE INDEX IF NOT EXISTS idx_groupage_quotes_agent ON groupage_quotes(is_agent_quote);
CREATE INDEX IF NOT EXISTS idx_groupage_quotes_shipment_type ON groupage_quotes(shipment_type);

-- Create common carriers reference table
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_name text UNIQUE NOT NULL,
  carrier_code text UNIQUE NOT NULL,
  service_types text[] DEFAULT ARRAY['SEA_FCL', 'SEA_LCL', 'AIR'],
  is_active boolean DEFAULT true,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on carriers
ALTER TABLE shipping_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view carriers"
  ON shipping_carriers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage carriers"
  ON shipping_carriers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert common carriers
INSERT INTO shipping_carriers (carrier_name, carrier_code, service_types)
VALUES
  ('Maersk Line', 'MAEU', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('MSC Mediterranean Shipping', 'MSCU', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('CMA CGM', 'CMDU', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('Hapag-Lloyd', 'HLCU', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('ONE (Ocean Network Express)', 'ONEY', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('Evergreen Line', 'EGLV', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('COSCO Shipping', 'COSU', ARRAY['SEA_FCL', 'SEA_LCL']),
  ('Emirates SkyCargo', 'EK', ARRAY['AIR']),
  ('Qatar Airways Cargo', 'QR', ARRAY['AIR']),
  ('Etihad Cargo', 'EY', ARRAY['AIR'])
ON CONFLICT (carrier_code) DO NOTHING;

-- Function to calculate agent margin
CREATE OR REPLACE FUNCTION calculate_agent_quote_margin(
  p_quote_id uuid,
  p_selling_rate numeric,
  p_buying_rate numeric
)
RETURNS void AS $$
DECLARE
  v_margin numeric(10,2);
  v_margin_pct numeric(5,2);
BEGIN
  v_margin := p_selling_rate - p_buying_rate;
  v_margin_pct := CASE 
    WHEN p_buying_rate > 0 THEN (v_margin / p_buying_rate) * 100
    ELSE 0
  END;
  
  UPDATE groupage_quotes
  SET 
    buying_rate = p_buying_rate,
    selling_rate = p_selling_rate,
    margin_amount = v_margin,
    margin_percentage = v_margin_pct,
    total_amount = p_selling_rate,
    updated_at = now()
  WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE groupage_tariffs IS 'Unified tariff table supporting LCL (CBM-based), FCL (container-based), and Agent rates';
COMMENT ON TABLE groupage_fcl_rates IS 'FCL container-specific rates (20ft, 40ft, 40HC) with BAF/CAF surcharges';
COMMENT ON TABLE shipping_carriers IS 'Master list of shipping carriers and their service types';
COMMENT ON COLUMN groupage_tariffs.shipment_type IS 'LCL, FCL, or AIR';
COMMENT ON COLUMN groupage_tariffs.is_agent_rate IS 'True if this is a buying rate for agent quotes (not customer-facing)';
COMMENT ON COLUMN groupage_quotes.is_agent_quote IS 'True if quote is for an agent (shows buying vs selling rates)';
