/*
  # Costing Engine System

  ## Overview
  Comprehensive costing system for calculating all cost components of moving jobs
  including materials, labor, transport, freight (air/sea/road), insurance, 
  warehousing, overheads, and profit margins.

  ## New Tables

  1. `cost_components` - Master table for cost component definitions
     - `id` (uuid, primary key)
     - `component_name` (text) - Name of cost component
     - `component_type` (text) - MATERIAL, LABOR, TRANSPORT, FREIGHT, INSURANCE, WAREHOUSE, OVERHEAD
     - `calculation_method` (text) - FIXED, PER_UNIT, PER_CBM, PER_KM, PERCENTAGE, FORMULA
     - `base_rate` (decimal) - Base rate for calculation
     - `unit` (text) - Unit of measurement
     - `active` (boolean)

  2. `job_cost_sheets` - Cost sheet for each job
     - `id` (uuid, primary key)
     - `job_id` (uuid) - Reference to jobs table
     - `survey_id` (uuid) - Reference to surveys table
     - `quote_id` (uuid) - Reference to quotes table
     - `total_cbm` (decimal) - Total cubic meters
     - `total_items` (decimal) - Total items count
     - `distance_km` (decimal) - Distance for transport
     - `crew_members` (integer) - Number of crew members
     - `estimated_hours` (decimal) - Estimated job hours
     - `material_cost` (decimal) - Total material cost
     - `labor_cost` (decimal) - Total labor cost
     - `transport_cost` (decimal) - Transport cost
     - `freight_cost` (decimal) - Freight cost (air/sea)
     - `insurance_cost` (decimal) - Insurance cost
     - `warehousing_cost` (decimal) - Storage cost
     - `overhead_cost` (decimal) - Overhead allocation
     - `subtotal` (decimal) - Sum of all costs
     - `profit_margin_percent` (decimal) - Profit margin %
     - `profit_amount` (decimal) - Profit in currency
     - `total_cost` (decimal) - Final total with profit
     - `currency` (text) - Currency code
     - `version` (integer) - Version number for revisions
     - `is_approved` (boolean) - Is this cost sheet approved

  3. `cost_sheet_line_items` - Detailed line items for cost sheet
     - `id` (uuid, primary key)
     - `cost_sheet_id` (uuid) - Reference to job_cost_sheets
     - `component_type` (text) - MATERIAL, LABOR, TRANSPORT, etc.
     - `description` (text) - Line item description
     - `quantity` (decimal) - Quantity
     - `unit` (text) - Unit
     - `unit_rate` (decimal) - Rate per unit
     - `total_amount` (decimal) - Quantity × unit_rate
     - `notes` (text)

  4. `freight_rates` - Freight rate tables
     - `id` (uuid, primary key)
     - `freight_type` (text) - ROAD, AIR, SEA_FCL, SEA_LCL
     - `service_type` (text) - DOMESTIC, INTERNATIONAL
     - `origin` (text) - Origin location/port
     - `destination` (text) - Destination location/port
     - `rate_per_unit` (decimal) - Rate per km/kg/cbm
     - `unit` (text) - km, kg, cbm, container
     - `minimum_charge` (decimal) - Minimum charge
     - `fuel_surcharge_percent` (decimal) - Fuel surcharge %
     - `valid_from` (date) - Rate validity start
     - `valid_until` (date) - Rate validity end
     - `active` (boolean)

  5. `labor_rates` - Labor rate definitions
     - `id` (uuid, primary key)
     - `role` (text) - SUPERVISOR, LOADER, PACKER, DRIVER
     - `rate_per_hour` (decimal) - Hourly rate
     - `overtime_multiplier` (decimal) - Overtime rate multiplier
     - `skill_level` (text) - JUNIOR, SENIOR, EXPERT
     - `active` (boolean)

  ## Functions
  - `calculate_material_cost()` - Calculate material cost from estimate
  - `calculate_labor_cost()` - Calculate labor cost
  - `calculate_transport_cost()` - Calculate road transport cost
  - `calculate_air_freight()` - Calculate air freight with chargeable weight
  - `calculate_sea_freight()` - Calculate sea freight (FCL/LCL)
  - `generate_cost_sheet()` - Generate complete cost sheet for job
  - `apply_profit_margin()` - Apply profit margin to cost sheet

  ## Chargeable Weight Formula (Air)
  Chargeable Weight = MAX(Actual Weight, Volumetric Weight)
  Volumetric Weight = (L × W × H in cm) ÷ 6000

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create cost components master table
CREATE TABLE IF NOT EXISTS cost_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_name text NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('MATERIAL', 'LABOR', 'TRANSPORT', 'FREIGHT', 'INSURANCE', 'WAREHOUSE', 'OVERHEAD')),
  calculation_method text NOT NULL CHECK (calculation_method IN ('FIXED', 'PER_UNIT', 'PER_CBM', 'PER_KM', 'PERCENTAGE', 'FORMULA')),
  base_rate decimal(10,2) DEFAULT 0,
  unit text,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create job cost sheets table
CREATE TABLE IF NOT EXISTS job_cost_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  survey_id uuid REFERENCES surveys(id),
  quote_id uuid,
  total_cbm decimal(10,2) DEFAULT 0,
  total_items integer DEFAULT 0,
  distance_km decimal(10,2) DEFAULT 0,
  crew_members integer DEFAULT 0,
  estimated_hours decimal(10,2) DEFAULT 0,
  material_cost decimal(10,2) DEFAULT 0,
  labor_cost decimal(10,2) DEFAULT 0,
  transport_cost decimal(10,2) DEFAULT 0,
  freight_cost decimal(10,2) DEFAULT 0,
  insurance_cost decimal(10,2) DEFAULT 0,
  warehousing_cost decimal(10,2) DEFAULT 0,
  overhead_cost decimal(10,2) DEFAULT 0,
  subtotal decimal(10,2) GENERATED ALWAYS AS (
    material_cost + labor_cost + transport_cost + freight_cost + 
    insurance_cost + warehousing_cost + overhead_cost
  ) STORED,
  profit_margin_percent decimal(5,2) DEFAULT 15,
  profit_amount decimal(10,2) GENERATED ALWAYS AS (
    (material_cost + labor_cost + transport_cost + freight_cost + 
    insurance_cost + warehousing_cost + overhead_cost) * profit_margin_percent / 100
  ) STORED,
  total_cost decimal(10,2) GENERATED ALWAYS AS (
    (material_cost + labor_cost + transport_cost + freight_cost + 
    insurance_cost + warehousing_cost + overhead_cost) * (1 + profit_margin_percent / 100)
  ) STORED,
  currency text DEFAULT 'USD',
  version integer DEFAULT 1,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cost sheet line items table
CREATE TABLE IF NOT EXISTS cost_sheet_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_sheet_id uuid NOT NULL REFERENCES job_cost_sheets(id) ON DELETE CASCADE,
  component_type text NOT NULL CHECK (component_type IN ('MATERIAL', 'LABOR', 'TRANSPORT', 'FREIGHT', 'INSURANCE', 'WAREHOUSE', 'OVERHEAD', 'OTHER')),
  description text NOT NULL,
  quantity decimal(10,2) NOT NULL,
  unit text NOT NULL,
  unit_rate decimal(10,2) NOT NULL,
  total_amount decimal(10,2) GENERATED ALWAYS AS (quantity * unit_rate) STORED,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create freight rates table
CREATE TABLE IF NOT EXISTS freight_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_type text NOT NULL CHECK (freight_type IN ('ROAD', 'AIR', 'SEA_FCL_20', 'SEA_FCL_40', 'SEA_LCL')),
  service_type text NOT NULL CHECK (service_type IN ('DOMESTIC', 'INTERNATIONAL')),
  origin text,
  destination text,
  rate_per_unit decimal(10,2) NOT NULL,
  unit text NOT NULL,
  minimum_charge decimal(10,2) DEFAULT 0,
  fuel_surcharge_percent decimal(5,2) DEFAULT 0,
  valid_from date DEFAULT CURRENT_DATE,
  valid_until date,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create labor rates table
CREATE TABLE IF NOT EXISTS labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('SUPERVISOR', 'LOADER', 'PACKER', 'DRIVER', 'HELPER')),
  rate_per_hour decimal(10,2) NOT NULL,
  overtime_multiplier decimal(3,2) DEFAULT 1.5,
  skill_level text CHECK (skill_level IN ('JUNIOR', 'SENIOR', 'EXPERT')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert default cost components
INSERT INTO cost_components (component_name, component_type, calculation_method, base_rate, unit)
VALUES
  ('Packing Materials', 'MATERIAL', 'PER_UNIT', 0, 'item'),
  ('Basic Labor', 'LABOR', 'PER_UNIT', 25, 'hour'),
  ('Road Transport', 'TRANSPORT', 'PER_KM', 2.5, 'km'),
  ('Insurance', 'INSURANCE', 'PERCENTAGE', 2, 'percent'),
  ('Administrative Overhead', 'OVERHEAD', 'PERCENTAGE', 10, 'percent'),
  ('Warehouse Storage', 'WAREHOUSE', 'PER_CBM', 5, 'cbm/day')
ON CONFLICT DO NOTHING;

-- Insert default freight rates
INSERT INTO freight_rates (freight_type, service_type, rate_per_unit, unit, minimum_charge)
VALUES
  ('ROAD', 'DOMESTIC', 2.50, 'km', 100),
  ('AIR', 'INTERNATIONAL', 4.50, 'kg', 500),
  ('SEA_FCL_20', 'INTERNATIONAL', 1500, 'container', 1500),
  ('SEA_FCL_40', 'INTERNATIONAL', 2200, 'container', 2200),
  ('SEA_LCL', 'INTERNATIONAL', 50, 'cbm', 200)
ON CONFLICT DO NOTHING;

-- Insert default labor rates
INSERT INTO labor_rates (role, rate_per_hour, skill_level)
VALUES
  ('SUPERVISOR', 35, 'SENIOR'),
  ('LOADER', 20, 'JUNIOR'),
  ('PACKER', 22, 'JUNIOR'),
  ('DRIVER', 28, 'SENIOR'),
  ('HELPER', 18, 'JUNIOR')
ON CONFLICT DO NOTHING;

-- Function to calculate material cost from survey materials
CREATE OR REPLACE FUNCTION calculate_material_cost(p_survey_id uuid)
RETURNS decimal
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_cost decimal DEFAULT 0;
  v_materials jsonb;
  v_material record;
BEGIN
  v_materials := estimate_survey_materials_complete(p_survey_id);
  
  FOR v_material IN 
    SELECT 
      m.value->>'material' as material_name,
      (m.value->>'quantity')::decimal as quantity
    FROM jsonb_each(v_materials) as m
  LOOP
    v_total_cost := v_total_cost + (
      SELECT COALESCE(unit_cost * v_material.quantity, 0)
      FROM packing_materials_inventory
      WHERE material_name = v_material.material_name
      LIMIT 1
    );
  END LOOP;
  
  RETURN v_total_cost;
END;
$$;

-- Function to calculate labor cost
CREATE OR REPLACE FUNCTION calculate_labor_cost(
  p_crew_members integer,
  p_hours decimal,
  p_overtime_hours decimal DEFAULT 0
)
RETURNS decimal
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_rate decimal;
  v_overtime_multiplier decimal;
  v_regular_cost decimal;
  v_overtime_cost decimal;
BEGIN
  SELECT rate_per_hour, overtime_multiplier 
  INTO v_base_rate, v_overtime_multiplier
  FROM labor_rates
  WHERE role = 'LOADER' AND active = true
  LIMIT 1;
  
  IF v_base_rate IS NULL THEN
    v_base_rate := 25;
    v_overtime_multiplier := 1.5;
  END IF;
  
  v_regular_cost := p_crew_members * p_hours * v_base_rate;
  v_overtime_cost := p_crew_members * p_overtime_hours * v_base_rate * v_overtime_multiplier;
  
  RETURN v_regular_cost + v_overtime_cost;
END;
$$;

-- Function to calculate road transport cost
CREATE OR REPLACE FUNCTION calculate_transport_cost(
  p_distance_km decimal,
  p_fuel_price_override decimal DEFAULT NULL
)
RETURNS decimal
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate_per_km decimal;
  v_fuel_surcharge decimal;
  v_minimum_charge decimal;
  v_cost decimal;
BEGIN
  SELECT rate_per_unit, fuel_surcharge_percent, minimum_charge
  INTO v_rate_per_km, v_fuel_surcharge, v_minimum_charge
  FROM freight_rates
  WHERE freight_type = 'ROAD' 
    AND service_type = 'DOMESTIC'
    AND active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_rate_per_km IS NULL THEN
    v_rate_per_km := 2.50;
    v_fuel_surcharge := 0;
    v_minimum_charge := 100;
  END IF;
  
  v_cost := p_distance_km * v_rate_per_km;
  v_cost := v_cost * (1 + COALESCE(v_fuel_surcharge, 0) / 100);
  
  RETURN GREATEST(v_cost, v_minimum_charge);
END;
$$;

-- Function to calculate air freight with chargeable weight
CREATE OR REPLACE FUNCTION calculate_air_freight(
  p_cbm decimal,
  p_actual_weight_kg decimal
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_volumetric_weight decimal;
  v_chargeable_weight decimal;
  v_rate_per_kg decimal;
  v_freight_cost decimal;
  v_minimum_charge decimal;
BEGIN
  v_volumetric_weight := p_cbm * 1000000 / 6000;
  
  v_chargeable_weight := GREATEST(p_actual_weight_kg, v_volumetric_weight);
  
  SELECT rate_per_unit, minimum_charge
  INTO v_rate_per_kg, v_minimum_charge
  FROM freight_rates
  WHERE freight_type = 'AIR' AND active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_rate_per_kg IS NULL THEN
    v_rate_per_kg := 4.50;
    v_minimum_charge := 500;
  END IF;
  
  v_freight_cost := GREATEST(v_chargeable_weight * v_rate_per_kg, v_minimum_charge);
  
  RETURN jsonb_build_object(
    'actual_weight_kg', p_actual_weight_kg,
    'volumetric_weight_kg', ROUND(v_volumetric_weight, 2),
    'chargeable_weight_kg', ROUND(v_chargeable_weight, 2),
    'rate_per_kg', v_rate_per_kg,
    'freight_cost', ROUND(v_freight_cost, 2)
  );
END;
$$;

-- Function to calculate sea freight
CREATE OR REPLACE FUNCTION calculate_sea_freight(
  p_cbm decimal,
  p_freight_type text DEFAULT 'SEA_LCL'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate decimal;
  v_minimum_charge decimal;
  v_freight_cost decimal;
  v_unit text;
  v_quantity decimal;
BEGIN
  SELECT rate_per_unit, minimum_charge, unit
  INTO v_rate, v_minimum_charge, v_unit
  FROM freight_rates
  WHERE freight_type = p_freight_type AND active = true
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    IF p_freight_type = 'SEA_FCL_20' THEN
      v_rate := 1500;
      v_minimum_charge := 1500;
      v_unit := 'container';
    ELSIF p_freight_type = 'SEA_FCL_40' THEN
      v_rate := 2200;
      v_minimum_charge := 2200;
      v_unit := 'container';
    ELSE
      v_rate := 50;
      v_minimum_charge := 200;
      v_unit := 'cbm';
    END IF;
  END IF;
  
  IF p_freight_type LIKE 'SEA_FCL%' THEN
    v_quantity := 1;
    v_freight_cost := v_rate;
  ELSE
    v_quantity := p_cbm;
    v_freight_cost := GREATEST(p_cbm * v_rate, v_minimum_charge);
  END IF;
  
  RETURN jsonb_build_object(
    'freight_type', p_freight_type,
    'quantity', ROUND(v_quantity, 2),
    'unit', v_unit,
    'rate', v_rate,
    'freight_cost', ROUND(v_freight_cost, 2)
  );
END;
$$;

-- Function to generate complete cost sheet
CREATE OR REPLACE FUNCTION generate_cost_sheet(
  p_job_id uuid,
  p_survey_id uuid,
  p_distance_km decimal DEFAULT 0,
  p_crew_members integer DEFAULT 2,
  p_estimated_hours decimal DEFAULT 8,
  p_freight_type text DEFAULT 'ROAD',
  p_profit_margin decimal DEFAULT 15,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_sheet_id uuid;
  v_total_cbm decimal;
  v_total_items integer;
  v_material_cost decimal;
  v_labor_cost decimal;
  v_transport_cost decimal;
  v_freight_cost decimal;
  v_insurance_cost decimal;
  v_warehousing_cost decimal;
  v_overhead_cost decimal;
  v_subtotal decimal;
BEGIN
  SELECT total_volume_cbm, total_items_count
  INTO v_total_cbm, v_total_items
  FROM surveys
  WHERE id = p_survey_id;
  
  v_material_cost := calculate_material_cost(p_survey_id);
  v_labor_cost := calculate_labor_cost(p_crew_members, p_estimated_hours);
  
  IF p_freight_type = 'ROAD' THEN
    v_transport_cost := calculate_transport_cost(p_distance_km);
    v_freight_cost := 0;
  ELSIF p_freight_type = 'AIR' THEN
    v_transport_cost := 0;
    v_freight_cost := (calculate_air_freight(v_total_cbm, v_total_cbm * 150)->>'freight_cost')::decimal;
  ELSE
    v_transport_cost := 0;
    v_freight_cost := (calculate_sea_freight(v_total_cbm, p_freight_type)->>'freight_cost')::decimal;
  END IF;
  
  v_subtotal := v_material_cost + v_labor_cost + COALESCE(v_transport_cost, 0) + COALESCE(v_freight_cost, 0);
  v_insurance_cost := v_subtotal * 0.02;
  v_overhead_cost := v_subtotal * 0.10;
  
  INSERT INTO job_cost_sheets (
    job_id, survey_id, total_cbm, total_items, distance_km,
    crew_members, estimated_hours, material_cost, labor_cost,
    transport_cost, freight_cost, insurance_cost, warehousing_cost,
    overhead_cost, profit_margin_percent, created_by
  ) VALUES (
    p_job_id, p_survey_id, v_total_cbm, v_total_items, p_distance_km,
    p_crew_members, p_estimated_hours, v_material_cost, v_labor_cost,
    v_transport_cost, v_freight_cost, v_insurance_cost, 0,
    v_overhead_cost, p_profit_margin, p_created_by
  ) RETURNING id INTO v_cost_sheet_id;
  
  INSERT INTO cost_sheet_line_items (cost_sheet_id, component_type, description, quantity, unit, unit_rate)
  VALUES 
    (v_cost_sheet_id, 'MATERIAL', 'Packing Materials', 1, 'lot', v_material_cost),
    (v_cost_sheet_id, 'LABOR', 'Crew Labor', p_crew_members * p_estimated_hours, 'hours', v_labor_cost / (p_crew_members * p_estimated_hours));
  
  IF v_transport_cost > 0 THEN
    INSERT INTO cost_sheet_line_items (cost_sheet_id, component_type, description, quantity, unit, unit_rate)
    VALUES (v_cost_sheet_id, 'TRANSPORT', 'Road Transport', p_distance_km, 'km', v_transport_cost / p_distance_km);
  END IF;
  
  IF v_freight_cost > 0 THEN
    INSERT INTO cost_sheet_line_items (cost_sheet_id, component_type, description, quantity, unit, unit_rate)
    VALUES (v_cost_sheet_id, 'FREIGHT', p_freight_type || ' Freight', 1, 'shipment', v_freight_cost);
  END IF;
  
  RETURN v_cost_sheet_id;
END;
$$;

-- Create cost sheet summary view
CREATE OR REPLACE VIEW cost_sheet_summary AS
SELECT 
  jcs.id,
  jcs.job_id,
  j.job_number,
  c.name as customer_name,
  jcs.total_cbm,
  jcs.total_items,
  jcs.distance_km,
  jcs.material_cost,
  jcs.labor_cost,
  jcs.transport_cost,
  jcs.freight_cost,
  jcs.insurance_cost,
  jcs.overhead_cost,
  jcs.subtotal,
  jcs.profit_margin_percent,
  jcs.profit_amount,
  jcs.total_cost,
  jcs.currency,
  jcs.is_approved,
  jcs.version,
  jcs.created_at
FROM job_cost_sheets jcs
LEFT JOIN jobs j ON jcs.job_id = j.id
LEFT JOIN customers c ON j.customer_id = c.id
ORDER BY jcs.created_at DESC;

-- Enable RLS
ALTER TABLE cost_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_sheet_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view cost_components"
  ON cost_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage cost_components"
  ON cost_components FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view job_cost_sheets"
  ON job_cost_sheets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage job_cost_sheets"
  ON job_cost_sheets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view cost_sheet_line_items"
  ON cost_sheet_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage cost_sheet_line_items"
  ON cost_sheet_line_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view freight_rates"
  ON freight_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage freight_rates"
  ON freight_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view labor_rates"
  ON labor_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage labor_rates"
  ON labor_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cost_sheets_job ON job_cost_sheets(job_id);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_survey ON job_cost_sheets(survey_id);
CREATE INDEX IF NOT EXISTS idx_cost_line_items_sheet ON cost_sheet_line_items(cost_sheet_id);
CREATE INDEX IF NOT EXISTS idx_freight_rates_type ON freight_rates(freight_type, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_labor_rates_role ON labor_rates(role, active) WHERE active = true;

-- Grant access to views
GRANT SELECT ON cost_sheet_summary TO authenticated;