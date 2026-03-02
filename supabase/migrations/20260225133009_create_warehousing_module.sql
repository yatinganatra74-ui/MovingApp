/*
  # Warehousing Module

  ## Overview
  Complete warehousing system for storage management including location tracking,
  goods inward/outward register, racking system, and monthly billing automation.

  ## New Tables

  1. `warehouse_locations` - Physical warehouse locations
     - `id` (uuid, primary key)
     - `location_code` (text) - Unique location code (e.g., WH-A-01-05)
     - `warehouse_name` (text) - Name of warehouse
     - `section` (text) - Warehouse section (A, B, C, etc.)
     - `rack_number` (text) - Rack identifier
     - `shelf_level` (text) - Shelf level
     - `capacity_cbm` (decimal) - Total capacity in CBM
     - `occupied_cbm` (decimal) - Currently occupied CBM
     - `available_cbm` (decimal) - Available capacity
     - `location_type` (text) - FLOOR, RACK, CONTAINER
     - `is_climate_controlled` (boolean)
     - `active` (boolean)

  2. `stored_goods` - Goods currently in storage
     - `id` (uuid, primary key)
     - `job_id` (uuid) - Reference to jobs table
     - `customer_id` (uuid) - Reference to customers
     - `location_id` (uuid) - Reference to warehouse_locations
     - `description` (text) - Goods description
     - `volume_cbm` (decimal) - Volume in CBM
     - `actual_weight_kg` (decimal) - Weight in kg
     - `item_count` (integer) - Number of items
     - `storage_type` (text) - SHORT_TERM, LONG_TERM, CONTAINER
     - `inward_date` (timestamptz) - Date goods received
     - `expected_outward_date` (timestamptz) - Expected pickup date
     - `actual_outward_date` (timestamptz) - Actual pickup date
     - `storage_status` (text) - IN_STORAGE, SCHEDULED_OUT, OUT
     - `daily_rate_per_cbm` (decimal) - Daily storage rate
     - `container_number` (text) - Container number if applicable
     - `special_handling` (text) - Special handling instructions
     - `insurance_value` (decimal) - Declared value for insurance

  3. `warehouse_transactions` - Goods inward/outward register
     - `id` (uuid, primary key)
     - `transaction_type` (text) - INWARD, OUTWARD
     - `stored_goods_id` (uuid) - Reference to stored_goods
     - `transaction_date` (timestamptz)
     - `location_id` (uuid) - Warehouse location
     - `volume_cbm` (decimal)
     - `weight_kg` (decimal)
     - `handled_by` (uuid) - Staff who handled transaction
     - `vehicle_number` (text) - Truck/container number
     - `notes` (text)
     - `photos` (jsonb) - Array of photo URLs

  4. `warehouse_billing` - Monthly billing records
     - `id` (uuid, primary key)
     - `stored_goods_id` (uuid) - Reference to stored_goods
     - `customer_id` (uuid) - Reference to customers
     - `billing_period_start` (date)
     - `billing_period_end` (date)
     - `days_stored` (integer)
     - `volume_cbm` (decimal)
     - `daily_rate` (decimal)
     - `total_amount` (decimal)
     - `billing_status` (text) - PENDING, INVOICED, PAID
     - `invoice_id` (uuid) - Reference to invoices
     - `generated_date` (timestamptz)

  5. `container_storage` - Container-specific storage
     - `id` (uuid, primary key)
     - `container_number` (text) - Container number
     - `container_type` (text) - 20FT, 40FT, 40HC
     - `customer_id` (uuid)
     - `location_id` (uuid)
     - `seal_number` (text)
     - `contents_description` (text)
     - `inward_date` (timestamptz)
     - `monthly_rate` (decimal)
     - `status` (text) - STORED, RELEASED

  ## Functions
  - `process_inward_goods()` - Process goods inward and allocate location
  - `process_outward_goods()` - Process goods outward and update location
  - `generate_warehouse_billing()` - Generate monthly billing for storage
  - `allocate_warehouse_location()` - Find and allocate suitable location
  - `get_warehouse_utilization()` - Get warehouse capacity utilization

  ## Views
  - `warehouse_inventory` - Current goods in storage
  - `warehouse_capacity_summary` - Warehouse capacity overview
  - `pending_warehouse_billing` - Unbilled storage

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create warehouse locations table
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code text UNIQUE NOT NULL,
  warehouse_name text NOT NULL,
  section text,
  rack_number text,
  shelf_level text,
  capacity_cbm decimal(10,2) NOT NULL CHECK (capacity_cbm > 0),
  occupied_cbm decimal(10,2) DEFAULT 0 CHECK (occupied_cbm >= 0),
  available_cbm decimal(10,2) GENERATED ALWAYS AS (capacity_cbm - occupied_cbm) STORED,
  location_type text NOT NULL CHECK (location_type IN ('FLOOR', 'RACK', 'CONTAINER', 'YARD')),
  is_climate_controlled boolean DEFAULT false,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stored goods table
CREATE TABLE IF NOT EXISTS stored_goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  location_id uuid REFERENCES warehouse_locations(id),
  description text NOT NULL,
  volume_cbm decimal(10,2) NOT NULL CHECK (volume_cbm > 0),
  actual_weight_kg decimal(10,2),
  item_count integer,
  storage_type text NOT NULL CHECK (storage_type IN ('SHORT_TERM', 'LONG_TERM', 'CONTAINER', 'TEMPORARY')),
  inward_date timestamptz DEFAULT now(),
  expected_outward_date timestamptz,
  actual_outward_date timestamptz,
  storage_status text DEFAULT 'IN_STORAGE' CHECK (storage_status IN ('IN_STORAGE', 'SCHEDULED_OUT', 'OUT')),
  daily_rate_per_cbm decimal(10,2) DEFAULT 5.00,
  container_number text,
  special_handling text,
  insurance_value decimal(10,2),
  photos jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create warehouse transactions table
CREATE TABLE IF NOT EXISTS warehouse_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('INWARD', 'OUTWARD', 'TRANSFER')),
  stored_goods_id uuid REFERENCES stored_goods(id) ON DELETE CASCADE,
  transaction_date timestamptz DEFAULT now(),
  location_id uuid REFERENCES warehouse_locations(id),
  volume_cbm decimal(10,2) NOT NULL,
  weight_kg decimal(10,2),
  handled_by uuid REFERENCES auth.users(id),
  vehicle_number text,
  driver_name text,
  notes text,
  photos jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create warehouse billing table
CREATE TABLE IF NOT EXISTS warehouse_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stored_goods_id uuid NOT NULL REFERENCES stored_goods(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  days_stored integer GENERATED ALWAYS AS (billing_period_end - billing_period_start + 1) STORED,
  volume_cbm decimal(10,2) NOT NULL,
  daily_rate decimal(10,2) NOT NULL,
  total_amount decimal(10,2) GENERATED ALWAYS AS (
    (billing_period_end - billing_period_start + 1) * volume_cbm * daily_rate
  ) STORED,
  billing_status text DEFAULT 'PENDING' CHECK (billing_status IN ('PENDING', 'INVOICED', 'PAID', 'CANCELLED')),
  invoice_id uuid,
  generated_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create container storage table
CREATE TABLE IF NOT EXISTS container_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text UNIQUE NOT NULL,
  container_type text NOT NULL CHECK (container_type IN ('20FT', '40FT', '40HC', '45FT')),
  customer_id uuid NOT NULL REFERENCES customers(id),
  location_id uuid REFERENCES warehouse_locations(id),
  seal_number text,
  contents_description text,
  volume_cbm decimal(10,2),
  inward_date timestamptz DEFAULT now(),
  outward_date timestamptz,
  monthly_rate decimal(10,2) DEFAULT 200,
  status text DEFAULT 'STORED' CHECK (status IN ('STORED', 'RELEASED', 'IN_TRANSIT')),
  photos jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert sample warehouse locations
INSERT INTO warehouse_locations (location_code, warehouse_name, section, rack_number, shelf_level, capacity_cbm, location_type, is_climate_controlled)
VALUES
  ('WH-MAIN-FLOOR-01', 'Main Warehouse', 'A', NULL, NULL, 100, 'FLOOR', false),
  ('WH-MAIN-A-01-01', 'Main Warehouse', 'A', '01', 'Level-1', 20, 'RACK', false),
  ('WH-MAIN-A-01-02', 'Main Warehouse', 'A', '01', 'Level-2', 20, 'RACK', false),
  ('WH-MAIN-A-02-01', 'Main Warehouse', 'A', '02', 'Level-1', 20, 'RACK', false),
  ('WH-MAIN-B-01-01', 'Main Warehouse', 'B', '01', 'Level-1', 25, 'RACK', true),
  ('WH-MAIN-B-01-02', 'Main Warehouse', 'B', '01', 'Level-2', 25, 'RACK', true),
  ('WH-YARD-01', 'Outdoor Yard', 'YARD', NULL, NULL, 200, 'YARD', false),
  ('WH-CONTAINER-01', 'Container Park', 'C', NULL, NULL, 50, 'CONTAINER', false),
  ('WH-CONTAINER-02', 'Container Park', 'C', NULL, NULL, 50, 'CONTAINER', false),
  ('WH-CLIMATE-01', 'Climate Controlled', 'CC', '01', 'Level-1', 30, 'RACK', true)
ON CONFLICT (location_code) DO NOTHING;

-- Function to allocate warehouse location
CREATE OR REPLACE FUNCTION allocate_warehouse_location(
  p_required_cbm decimal,
  p_climate_controlled boolean DEFAULT false,
  p_location_type text DEFAULT 'RACK'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_location_id uuid;
BEGIN
  SELECT id INTO v_location_id
  FROM warehouse_locations
  WHERE active = true
    AND location_type = p_location_type
    AND is_climate_controlled >= p_climate_controlled
    AND available_cbm >= p_required_cbm
  ORDER BY available_cbm ASC
  LIMIT 1;
  
  RETURN v_location_id;
END;
$$;

-- Function to process inward goods
CREATE OR REPLACE FUNCTION process_inward_goods(
  p_customer_id uuid,
  p_job_id uuid,
  p_description text,
  p_volume_cbm decimal,
  p_weight_kg decimal,
  p_item_count integer,
  p_storage_type text,
  p_daily_rate decimal DEFAULT 5.00,
  p_climate_controlled boolean DEFAULT false,
  p_handled_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_stored_goods_id uuid;
  v_location_id uuid;
BEGIN
  v_location_id := allocate_warehouse_location(p_volume_cbm, p_climate_controlled);
  
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No suitable warehouse location available for % CBM', p_volume_cbm;
  END IF;
  
  INSERT INTO stored_goods (
    job_id, customer_id, location_id, description, volume_cbm,
    actual_weight_kg, item_count, storage_type, daily_rate_per_cbm
  ) VALUES (
    p_job_id, p_customer_id, v_location_id, p_description, p_volume_cbm,
    p_weight_kg, p_item_count, p_storage_type, p_daily_rate
  ) RETURNING id INTO v_stored_goods_id;
  
  INSERT INTO warehouse_transactions (
    transaction_type, stored_goods_id, location_id, volume_cbm, weight_kg, handled_by
  ) VALUES (
    'INWARD', v_stored_goods_id, v_location_id, p_volume_cbm, p_weight_kg, p_handled_by
  );
  
  UPDATE warehouse_locations
  SET occupied_cbm = occupied_cbm + p_volume_cbm,
      updated_at = now()
  WHERE id = v_location_id;
  
  RETURN v_stored_goods_id;
END;
$$;

-- Function to process outward goods
CREATE OR REPLACE FUNCTION process_outward_goods(
  p_stored_goods_id uuid,
  p_outward_date timestamptz DEFAULT now(),
  p_handled_by uuid DEFAULT NULL,
  p_vehicle_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_location_id uuid;
  v_volume_cbm decimal;
  v_weight_kg decimal;
BEGIN
  SELECT location_id, volume_cbm, actual_weight_kg
  INTO v_location_id, v_volume_cbm, v_weight_kg
  FROM stored_goods
  WHERE id = p_stored_goods_id;
  
  UPDATE stored_goods
  SET 
    storage_status = 'OUT',
    actual_outward_date = p_outward_date,
    updated_at = now()
  WHERE id = p_stored_goods_id;
  
  INSERT INTO warehouse_transactions (
    transaction_type, stored_goods_id, location_id, volume_cbm, weight_kg, handled_by, vehicle_number
  ) VALUES (
    'OUTWARD', p_stored_goods_id, v_location_id, v_volume_cbm, v_weight_kg, p_handled_by, p_vehicle_number
  );
  
  UPDATE warehouse_locations
  SET occupied_cbm = occupied_cbm - v_volume_cbm,
      updated_at = now()
  WHERE id = v_location_id;
END;
$$;

-- Function to generate warehouse billing
CREATE OR REPLACE FUNCTION generate_warehouse_billing(
  p_billing_month date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_start date;
  v_period_end date;
  v_goods_record record;
  v_billing_count integer DEFAULT 0;
BEGIN
  v_period_start := date_trunc('month', p_billing_month)::date;
  v_period_end := (date_trunc('month', p_billing_month) + interval '1 month' - interval '1 day')::date;
  
  FOR v_goods_record IN
    SELECT 
      id,
      customer_id,
      volume_cbm,
      daily_rate_per_cbm,
      inward_date,
      COALESCE(actual_outward_date, v_period_end::timestamptz) as outward_date
    FROM stored_goods
    WHERE storage_status IN ('IN_STORAGE', 'OUT')
      AND inward_date <= v_period_end::timestamptz
      AND (actual_outward_date IS NULL OR actual_outward_date >= v_period_start::timestamptz)
      AND NOT EXISTS (
        SELECT 1 FROM warehouse_billing wb
        WHERE wb.stored_goods_id = stored_goods.id
          AND wb.billing_period_start = v_period_start
          AND wb.billing_period_end = v_period_end
      )
  LOOP
    INSERT INTO warehouse_billing (
      stored_goods_id,
      customer_id,
      billing_period_start,
      billing_period_end,
      volume_cbm,
      daily_rate
    ) VALUES (
      v_goods_record.id,
      v_goods_record.customer_id,
      GREATEST(v_period_start, v_goods_record.inward_date::date),
      LEAST(v_period_end, v_goods_record.outward_date::date),
      v_goods_record.volume_cbm,
      v_goods_record.daily_rate_per_cbm
    );
    
    v_billing_count := v_billing_count + 1;
  END LOOP;
  
  RETURN v_billing_count;
END;
$$;

-- Function to get warehouse utilization
CREATE OR REPLACE FUNCTION get_warehouse_utilization()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_capacity decimal;
  v_total_occupied decimal;
  v_utilization_percent decimal;
BEGIN
  SELECT 
    SUM(capacity_cbm),
    SUM(occupied_cbm)
  INTO v_total_capacity, v_total_occupied
  FROM warehouse_locations
  WHERE active = true;
  
  v_utilization_percent := CASE 
    WHEN v_total_capacity > 0 THEN (v_total_occupied / v_total_capacity * 100)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'total_capacity_cbm', ROUND(v_total_capacity, 2),
    'occupied_cbm', ROUND(v_total_occupied, 2),
    'available_cbm', ROUND(v_total_capacity - v_total_occupied, 2),
    'utilization_percent', ROUND(v_utilization_percent, 2)
  );
END;
$$;

-- Create warehouse inventory view
CREATE OR REPLACE VIEW warehouse_inventory AS
SELECT 
  sg.id,
  sg.customer_id,
  c.name as customer_name,
  c.email as customer_email,
  sg.description,
  sg.volume_cbm,
  sg.item_count,
  sg.storage_type,
  sg.inward_date,
  sg.expected_outward_date,
  sg.storage_status,
  sg.daily_rate_per_cbm,
  wl.location_code,
  wl.warehouse_name,
  wl.section,
  EXTRACT(DAY FROM (COALESCE(sg.actual_outward_date, now()) - sg.inward_date)) as days_in_storage,
  ROUND(EXTRACT(DAY FROM (COALESCE(sg.actual_outward_date, now()) - sg.inward_date)) * sg.volume_cbm * sg.daily_rate_per_cbm, 2) as estimated_charges
FROM stored_goods sg
LEFT JOIN customers c ON sg.customer_id = c.id
LEFT JOIN warehouse_locations wl ON sg.location_id = wl.id
WHERE sg.storage_status IN ('IN_STORAGE', 'SCHEDULED_OUT');

-- Create warehouse capacity summary view
CREATE OR REPLACE VIEW warehouse_capacity_summary AS
SELECT 
  warehouse_name,
  section,
  location_type,
  is_climate_controlled,
  COUNT(*) as location_count,
  SUM(capacity_cbm) as total_capacity,
  SUM(occupied_cbm) as total_occupied,
  SUM(available_cbm) as total_available,
  ROUND(SUM(occupied_cbm) / NULLIF(SUM(capacity_cbm), 0) * 100, 2) as utilization_percent
FROM warehouse_locations
WHERE active = true
GROUP BY warehouse_name, section, location_type, is_climate_controlled;

-- Create pending warehouse billing view
CREATE OR REPLACE VIEW pending_warehouse_billing AS
SELECT 
  sg.id as stored_goods_id,
  c.name as customer_name,
  sg.description,
  sg.volume_cbm,
  sg.inward_date,
  sg.daily_rate_per_cbm,
  EXTRACT(DAY FROM (now() - sg.inward_date)) as days_stored,
  ROUND(EXTRACT(DAY FROM (now() - sg.inward_date)) * sg.volume_cbm * sg.daily_rate_per_cbm, 2) as unbilled_amount
FROM stored_goods sg
JOIN customers c ON sg.customer_id = c.id
WHERE sg.storage_status = 'IN_STORAGE'
  AND NOT EXISTS (
    SELECT 1 FROM warehouse_billing wb
    WHERE wb.stored_goods_id = sg.id
      AND wb.billing_status IN ('PENDING', 'INVOICED')
      AND wb.billing_period_end >= CURRENT_DATE - interval '30 days'
  );

-- Enable RLS
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_storage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view warehouse_locations"
  ON warehouse_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage warehouse_locations"
  ON warehouse_locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view stored_goods"
  ON stored_goods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage stored_goods"
  ON stored_goods FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view warehouse_transactions"
  ON warehouse_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create warehouse_transactions"
  ON warehouse_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view warehouse_billing"
  ON warehouse_billing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage warehouse_billing"
  ON warehouse_billing FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view container_storage"
  ON container_storage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage container_storage"
  ON container_storage FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_active ON warehouse_locations(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_stored_goods_customer ON stored_goods(customer_id);
CREATE INDEX IF NOT EXISTS idx_stored_goods_location ON stored_goods(location_id);
CREATE INDEX IF NOT EXISTS idx_stored_goods_status ON stored_goods(storage_status);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_goods ON warehouse_transactions(stored_goods_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_billing_customer ON warehouse_billing(customer_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_billing_status ON warehouse_billing(billing_status);
CREATE INDEX IF NOT EXISTS idx_container_storage_customer ON container_storage(customer_id);

-- Grant access to views
GRANT SELECT ON warehouse_inventory TO authenticated;
GRANT SELECT ON warehouse_capacity_summary TO authenticated;
GRANT SELECT ON pending_warehouse_billing TO authenticated;