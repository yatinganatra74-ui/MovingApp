/*
  # Slab-Based Rate Engine System

  1. New Tables
    - `rate_sheet_slabs`
      - `id` (uuid, primary key)
      - `rate_sheet_id` (uuid, foreign key)
      - `charge_type` (text) - 'destination_handling', 'origin_handling', 'freight', 'storage'
      - `from_cbm` (decimal) - Lower bound of slab (e.g., 0, 5.01, 10.01)
      - `to_cbm` (decimal) - Upper bound of slab (e.g., 5, 10, 20, NULL for unlimited)
      - `rate_per_cbm` (decimal) - Rate applied to CBM in this range
      - `currency` (text)
      - `description` (text)
      - `created_at` (timestamp)

    - `rate_sheet_fixed_charges`
      - `id` (uuid, primary key)
      - `rate_sheet_id` (uuid, foreign key)
      - `charge_name` (text) - 'Documentation', 'Admin Fee', etc.
      - `charge_type` (text) - 'documentation', 'admin', 'customs', 'insurance', 'other'
      - `amount` (decimal) - Fixed amount per shipment
      - `currency` (text)
      - `is_mandatory` (boolean)
      - `description` (text)
      - `created_at` (timestamp)

    - Update rate_sheets table to include version tracking

  2. Important Notes
    - Slabs are non-overlapping ranges
    - System finds correct slab based on total CBM
    - Revenue = CBM × slab_rate_per_cbm
    - Each rate sheet is locked to jobs on creation
    - Multi-currency support with exchange rate locking

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Add version tracking to rate_sheets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_sheets' AND column_name = 'version'
  ) THEN
    ALTER TABLE rate_sheets ADD COLUMN version integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_sheets' AND column_name = 'base_currency'
  ) THEN
    ALTER TABLE rate_sheets ADD COLUMN base_currency text DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_sheets' AND column_name = 'is_locked'
  ) THEN
    ALTER TABLE rate_sheets ADD COLUMN is_locked boolean DEFAULT false;
  END IF;
END $$;

-- Rate Sheet Slabs (Volume-based pricing)
CREATE TABLE IF NOT EXISTS rate_sheet_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  charge_type text NOT NULL CHECK (charge_type IN (
    'destination_handling',
    'origin_handling', 
    'freight',
    'storage_monthly',
    'storage_daily',
    'other'
  )),
  from_cbm decimal(10, 2) NOT NULL,
  to_cbm decimal(10, 2),
  rate_per_cbm decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  description text,
  created_at timestamptz DEFAULT now(),
  CHECK (to_cbm IS NULL OR to_cbm > from_cbm)
);

ALTER TABLE rate_sheet_slabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheet slabs"
  ON rate_sheet_slabs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheet slabs"
  ON rate_sheet_slabs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update rate sheet slabs"
  ON rate_sheet_slabs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete rate sheet slabs"
  ON rate_sheet_slabs FOR DELETE
  TO authenticated
  USING (true);

-- Rate Sheet Fixed Charges (Per shipment charges)
CREATE TABLE IF NOT EXISTS rate_sheet_fixed_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  charge_name text NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN (
    'documentation',
    'admin',
    'customs_clearance',
    'insurance',
    'inspection',
    'fumigation',
    'other'
  )),
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  is_mandatory boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_sheet_fixed_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rate sheet fixed charges"
  ON rate_sheet_fixed_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert rate sheet fixed charges"
  ON rate_sheet_fixed_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update rate sheet fixed charges"
  ON rate_sheet_fixed_charges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete rate sheet fixed charges"
  ON rate_sheet_fixed_charges FOR DELETE
  TO authenticated
  USING (true);

-- Add locked_rate_sheet_id to shipments to track which rate sheet version was used
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'locked_rate_sheet_id'
  ) THEN
    ALTER TABLE shipments ADD COLUMN locked_rate_sheet_id uuid REFERENCES rate_sheets(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'locked_exchange_rate'
  ) THEN
    ALTER TABLE shipments ADD COLUMN locked_exchange_rate decimal(10, 6) DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'total_cbm'
  ) THEN
    ALTER TABLE shipments ADD COLUMN total_cbm decimal(10, 2);
  END IF;
END $$;

-- Function to find applicable slab rate
CREATE OR REPLACE FUNCTION get_slab_rate(
  p_rate_sheet_id uuid,
  p_charge_type text,
  p_cbm decimal
)
RETURNS TABLE (
  slab_id uuid,
  from_cbm decimal,
  to_cbm decimal,
  rate_per_cbm decimal,
  currency text,
  calculated_amount decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.from_cbm,
    s.to_cbm,
    s.rate_per_cbm,
    s.currency,
    (p_cbm * s.rate_per_cbm) as calculated_amount
  FROM rate_sheet_slabs s
  WHERE s.rate_sheet_id = p_rate_sheet_id
    AND s.charge_type = p_charge_type
    AND s.from_cbm <= p_cbm
    AND (s.to_cbm IS NULL OR s.to_cbm >= p_cbm)
  ORDER BY s.from_cbm DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total shipment cost from rate sheet
CREATE OR REPLACE FUNCTION calculate_shipment_cost(
  p_rate_sheet_id uuid,
  p_cbm decimal,
  p_include_charges text[] DEFAULT ARRAY['destination_handling', 'documentation']
)
RETURNS TABLE (
  charge_type text,
  description text,
  amount decimal,
  currency text,
  calculation_details text
) AS $$
BEGIN
  -- Return slab-based charges
  RETURN QUERY
  SELECT 
    s.charge_type::text,
    COALESCE(s.description, s.charge_type) as description,
    (p_cbm * s.rate_per_cbm) as amount,
    s.currency::text,
    format('CBM: %s × Rate: %s = %s', 
      p_cbm, s.rate_per_cbm, (p_cbm * s.rate_per_cbm)) as calculation_details
  FROM rate_sheet_slabs s
  WHERE s.rate_sheet_id = p_rate_sheet_id
    AND s.charge_type = ANY(p_include_charges)
    AND s.from_cbm <= p_cbm
    AND (s.to_cbm IS NULL OR s.to_cbm >= p_cbm)
  ORDER BY s.from_cbm DESC;

  -- Return fixed charges
  RETURN QUERY
  SELECT 
    f.charge_type::text,
    f.charge_name as description,
    f.amount,
    f.currency::text,
    format('Fixed charge: %s', f.amount) as calculation_details
  FROM rate_sheet_fixed_charges f
  WHERE f.rate_sheet_id = p_rate_sheet_id
    AND f.charge_type = ANY(p_include_charges);
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_sheet_slabs_sheet_id ON rate_sheet_slabs(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_slabs_type ON rate_sheet_slabs(charge_type);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_slabs_range ON rate_sheet_slabs(rate_sheet_id, from_cbm, to_cbm);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_fixed_charges_sheet_id ON rate_sheet_fixed_charges(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_shipments_locked_rate_sheet ON shipments(locked_rate_sheet_id);

-- Create view for active rate sheets
CREATE OR REPLACE VIEW active_rate_sheets AS
SELECT 
  rs.*,
  a.name as agent_name,
  a.type as agent_type,
  COUNT(DISTINCT rss.id) as total_slabs,
  COUNT(DISTINCT rsf.id) as total_fixed_charges
FROM rate_sheets rs
LEFT JOIN agents a ON rs.agent_id = a.id
LEFT JOIN rate_sheet_slabs rss ON rs.id = rss.rate_sheet_id
LEFT JOIN rate_sheet_fixed_charges rsf ON rs.id = rsf.rate_sheet_id
WHERE rs.is_active = true
  AND rs.effective_from <= CURRENT_DATE
  AND (rs.effective_to IS NULL OR rs.effective_to >= CURRENT_DATE)
GROUP BY rs.id, a.name, a.type;