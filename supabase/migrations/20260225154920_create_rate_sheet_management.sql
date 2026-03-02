/*
  # Rate Sheet Management System

  1. New Tables
    - `rate_sheets`
      - `id` (uuid, primary key)
      - `name` (text) - Name of the rate sheet
      - `type` (text) - 'import' or 'export'
      - `effective_from` (date) - When this rate sheet becomes active
      - `effective_to` (date, nullable) - When this rate sheet expires
      - `is_active` (boolean) - Whether this rate sheet is currently active
      - `currency` (text) - Currency code (USD, EUR, etc.)
      - `notes` (text, nullable) - Additional notes
      - `created_by` (uuid) - User who created this
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rate_sheet_lanes`
      - `id` (uuid, primary key)
      - `rate_sheet_id` (uuid, foreign key)
      - `origin_country` (text)
      - `origin_port` (text)
      - `destination_country` (text)
      - `destination_port` (text)
      - `service_type` (text) - 'FCL', 'LCL', 'Air'
      - `container_type` (text, nullable) - '20ft', '40ft', '40ft HC' for FCL
      - `base_rate` (decimal) - Base freight rate
      - `fuel_surcharge` (decimal, nullable)
      - `security_fee` (decimal, nullable)
      - `terminal_handling` (decimal, nullable)
      - `documentation_fee` (decimal, nullable)
      - `transit_days` (integer, nullable)
      - `valid_from` (date)
      - `valid_to` (date, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `rate_sheet_charges`
      - `id` (uuid, primary key)
      - `rate_sheet_id` (uuid, foreign key)
      - `charge_name` (text) - Name of the charge
      - `charge_type` (text) - 'origin', 'destination', 'freight', 'other'
      - `unit_type` (text) - 'per_shipment', 'per_container', 'per_cbm', 'per_kg', 'percentage'
      - `amount` (decimal)
      - `currency` (text)
      - `is_mandatory` (boolean)
      - `description` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their rate sheets
*/

-- Rate Sheets Table
CREATE TABLE IF NOT EXISTS rate_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('import', 'export')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheets"
  ON rate_sheets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheets"
  ON rate_sheets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update rate sheets"
  ON rate_sheets FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete rate sheets"
  ON rate_sheets FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Rate Sheet Lanes Table
CREATE TABLE IF NOT EXISTS rate_sheet_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  origin_country text NOT NULL,
  origin_port text NOT NULL,
  destination_country text NOT NULL,
  destination_port text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('FCL', 'LCL', 'Air', 'Road')),
  container_type text,
  base_rate decimal(10, 2) NOT NULL,
  fuel_surcharge decimal(10, 2) DEFAULT 0,
  security_fee decimal(10, 2) DEFAULT 0,
  terminal_handling decimal(10, 2) DEFAULT 0,
  documentation_fee decimal(10, 2) DEFAULT 0,
  transit_days integer,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rate_sheet_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheet lanes"
  ON rate_sheet_lanes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheet lanes"
  ON rate_sheet_lanes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_lanes.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update rate sheet lanes"
  ON rate_sheet_lanes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_lanes.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_lanes.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete rate sheet lanes"
  ON rate_sheet_lanes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_lanes.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

-- Rate Sheet Charges Table
CREATE TABLE IF NOT EXISTS rate_sheet_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  charge_name text NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('origin', 'destination', 'freight', 'other')),
  unit_type text NOT NULL CHECK (unit_type IN ('per_shipment', 'per_container', 'per_cbm', 'per_kg', 'percentage')),
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  is_mandatory boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_sheet_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheet charges"
  ON rate_sheet_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheet charges"
  ON rate_sheet_charges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_charges.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update rate sheet charges"
  ON rate_sheet_charges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_charges.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_charges.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete rate sheet charges"
  ON rate_sheet_charges FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rate_sheets
      WHERE rate_sheets.id = rate_sheet_charges.rate_sheet_id
      AND rate_sheets.created_by = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rate_sheet_lanes_sheet_id ON rate_sheet_lanes(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_lanes_route ON rate_sheet_lanes(origin_country, origin_port, destination_country, destination_port);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_charges_sheet_id ON rate_sheet_charges(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_type_active ON rate_sheets(type, is_active);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_rate_sheets_updated_at BEFORE UPDATE ON rate_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_sheet_lanes_updated_at BEFORE UPDATE ON rate_sheet_lanes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();