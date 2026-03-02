/*
  # Manual Trucking Cost System for Non-Metro Deliveries

  1. New Tables
    - `delivery_zones` - Define metro vs non-metro cities
      - `id` (uuid, primary key)
      - `zone_name` (text) - e.g., "Mumbai", "Delhi", "Tier 2 Cities"
      - `city_name` (text) - City name
      - `state` (text) - State name
      - `zone_type` (text) - metro, tier1, tier2, rural
      - `is_metro` (boolean) - True for major metros
      - `auto_apply_groupage_rate` (boolean) - If true, use slab rate automatically
      - `pin_codes` (text[]) - Array of pin codes for this zone
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `manual_trucking_costs` - Manual trucking cost entries for non-metro
      - `id` (uuid, primary key)
      - `quote_id` (uuid, references quotes)
      - `shipment_id` (uuid, references shipments)
      - `from_location` (text) - Origin (e.g., "Nhava Sheva")
      - `to_location` (text) - Destination city
      - `to_zone_id` (uuid, references delivery_zones)
      - `distance_km` (decimal) - Distance in kilometers
      - `vehicle_type` (text) - 10ft, 14ft, 17ft, 19ft, 20ft, 22ft, 24ft
      - `trucking_cost` (decimal) - Manual cost entered
      - `currency` (text) - INR, USD, etc.
      - `cost_per_km` (decimal) - Calculated rate per km
      - `fuel_surcharge` (decimal) - Fuel surcharge if any
      - `toll_charges` (decimal) - Toll charges if any
      - `loading_unloading_charges` (decimal) - Labour charges
      - `detention_charges` (decimal) - Detention if any
      - `total_cost` (decimal) - Total trucking cost
      - `remarks` (text) - Additional notes
      - `valid_from` (date) - Cost validity start
      - `valid_to` (date) - Cost validity end
      - `vendor_name` (text) - Trucking vendor
      - `vendor_contact` (text) - Vendor contact
      - `is_approved` (boolean) - If cost is approved
      - `approved_by` (uuid, references auth.users)
      - `approved_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `trucking_rate_templates` - Pre-defined trucking rates for common routes
      - `id` (uuid, primary key)
      - `from_location` (text)
      - `to_location` (text)
      - `to_zone_id` (uuid, references delivery_zones)
      - `vehicle_type` (text)
      - `base_cost` (decimal)
      - `cost_per_km` (decimal)
      - `currency` (text)
      - `is_active` (boolean)
      - `effective_from` (date)
      - `effective_to` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - Check if destination is metro or non-metro
    - Calculate trucking cost based on distance and vehicle type
    - Auto-suggest trucking cost from templates
    - Add manual trucking cost to quote/estimate

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users

  4. Important Notes
    - Metro cities: Mumbai, Delhi, Bangalore, Chennai, Hyderabad → Auto-apply groupage slab rate
    - Non-metro cities: Require manual trucking cost entry
    - System checks zone_type to determine if manual entry needed
    - Manual costs can be pre-approved or require approval
    - Templates help speed up cost entry for common routes
    - Integrates with quotes and shipments
*/

-- Delivery Zones Table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  city_name text NOT NULL,
  state text NOT NULL,
  zone_type text NOT NULL DEFAULT 'tier2',
  is_metro boolean DEFAULT false,
  auto_apply_groupage_rate boolean DEFAULT false,
  pin_codes text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view delivery zones"
  ON delivery_zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create delivery zones"
  ON delivery_zones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update delivery zones"
  ON delivery_zones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete delivery zones"
  ON delivery_zones FOR DELETE
  TO authenticated
  USING (true);

-- Manual Trucking Costs Table
CREATE TABLE IF NOT EXISTS manual_trucking_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  from_location text NOT NULL DEFAULT 'Nhava Sheva',
  to_location text NOT NULL,
  to_zone_id uuid REFERENCES delivery_zones(id),
  distance_km decimal(10, 2),
  vehicle_type text NOT NULL,
  trucking_cost decimal(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  cost_per_km decimal(10, 2),
  fuel_surcharge decimal(10, 2) DEFAULT 0,
  toll_charges decimal(10, 2) DEFAULT 0,
  loading_unloading_charges decimal(10, 2) DEFAULT 0,
  detention_charges decimal(10, 2) DEFAULT 0,
  total_cost decimal(12, 2) NOT NULL,
  remarks text,
  valid_from date,
  valid_to date,
  vendor_name text,
  vendor_contact text,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE manual_trucking_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view manual trucking costs"
  ON manual_trucking_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create manual trucking costs"
  ON manual_trucking_costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update manual trucking costs"
  ON manual_trucking_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete manual trucking costs"
  ON manual_trucking_costs FOR DELETE
  TO authenticated
  USING (true);

-- Trucking Rate Templates Table
CREATE TABLE IF NOT EXISTS trucking_rate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location text NOT NULL DEFAULT 'Nhava Sheva',
  to_location text NOT NULL,
  to_zone_id uuid REFERENCES delivery_zones(id),
  vehicle_type text NOT NULL,
  base_cost decimal(12, 2) NOT NULL,
  cost_per_km decimal(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  is_active boolean DEFAULT true,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trucking_rate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trucking rate templates"
  ON trucking_rate_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create trucking rate templates"
  ON trucking_rate_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update trucking rate templates"
  ON trucking_rate_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete trucking rate templates"
  ON trucking_rate_templates FOR DELETE
  TO authenticated
  USING (true);

-- Function to check if location is metro
CREATE OR REPLACE FUNCTION is_metro_delivery(p_city_name text)
RETURNS boolean AS $$
DECLARE
  v_is_metro boolean;
BEGIN
  SELECT is_metro INTO v_is_metro
  FROM delivery_zones
  WHERE LOWER(city_name) = LOWER(p_city_name)
    AND is_metro = true
  LIMIT 1;
  
  RETURN COALESCE(v_is_metro, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get delivery zone by city or pin code
CREATE OR REPLACE FUNCTION get_delivery_zone(
  p_city_name text DEFAULT NULL,
  p_pin_code text DEFAULT NULL
)
RETURNS TABLE (
  zone_id uuid,
  zone_name text,
  city_name text,
  state text,
  zone_type text,
  is_metro boolean,
  auto_apply_groupage_rate boolean
) AS $$
BEGIN
  IF p_pin_code IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      id,
      dz.zone_name,
      dz.city_name,
      dz.state,
      dz.zone_type,
      dz.is_metro,
      dz.auto_apply_groupage_rate
    FROM delivery_zones dz
    WHERE p_pin_code = ANY(dz.pin_codes)
    LIMIT 1;
  ELSIF p_city_name IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      id,
      dz.zone_name,
      dz.city_name,
      dz.state,
      dz.zone_type,
      dz.is_metro,
      dz.auto_apply_groupage_rate
    FROM delivery_zones dz
    WHERE LOWER(dz.city_name) = LOWER(p_city_name)
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest trucking cost from template
CREATE OR REPLACE FUNCTION suggest_trucking_cost(
  p_from_location text,
  p_to_location text,
  p_vehicle_type text,
  p_distance_km decimal DEFAULT NULL
)
RETURNS TABLE (
  template_id uuid,
  base_cost decimal,
  cost_per_km decimal,
  suggested_cost decimal,
  currency text
) AS $$
DECLARE
  v_template record;
  v_suggested_cost decimal;
BEGIN
  SELECT * INTO v_template
  FROM trucking_rate_templates
  WHERE LOWER(from_location) = LOWER(p_from_location)
    AND LOWER(to_location) = LOWER(p_to_location)
    AND vehicle_type = p_vehicle_type
    AND is_active = true
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_template IS NULL THEN
    RETURN;
  END IF;
  
  IF p_distance_km IS NOT NULL AND p_distance_km > 0 THEN
    v_suggested_cost := v_template.base_cost + (v_template.cost_per_km * p_distance_km);
  ELSE
    v_suggested_cost := v_template.base_cost;
  END IF;
  
  RETURN QUERY SELECT
    v_template.id,
    v_template.base_cost,
    v_template.cost_per_km,
    v_suggested_cost,
    v_template.currency;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total manual trucking cost
CREATE OR REPLACE FUNCTION calculate_manual_trucking_total(
  p_base_trucking_cost decimal,
  p_fuel_surcharge decimal DEFAULT 0,
  p_toll_charges decimal DEFAULT 0,
  p_loading_unloading decimal DEFAULT 0,
  p_detention decimal DEFAULT 0
)
RETURNS decimal AS $$
BEGIN
  RETURN p_base_trucking_cost + 
         COALESCE(p_fuel_surcharge, 0) + 
         COALESCE(p_toll_charges, 0) + 
         COALESCE(p_loading_unloading, 0) + 
         COALESCE(p_detention, 0);
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones(city_name);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_type ON delivery_zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_metro ON delivery_zones(is_metro);
CREATE INDEX IF NOT EXISTS idx_manual_trucking_quote ON manual_trucking_costs(quote_id);
CREATE INDEX IF NOT EXISTS idx_manual_trucking_shipment ON manual_trucking_costs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_manual_trucking_zone ON manual_trucking_costs(to_zone_id);
CREATE INDEX IF NOT EXISTS idx_trucking_templates_route ON trucking_rate_templates(from_location, to_location);
CREATE INDEX IF NOT EXISTS idx_trucking_templates_active ON trucking_rate_templates(is_active);

-- Trigger for updated_at columns
CREATE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manual_trucking_costs_updated_at BEFORE UPDATE ON manual_trucking_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucking_rate_templates_updated_at BEFORE UPDATE ON trucking_rate_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default metro zones
INSERT INTO delivery_zones (zone_name, city_name, state, zone_type, is_metro, auto_apply_groupage_rate) VALUES
  ('Mumbai Metro', 'Mumbai', 'Maharashtra', 'metro', true, true),
  ('Delhi NCR', 'Delhi', 'Delhi', 'metro', true, true),
  ('Bangalore Metro', 'Bangalore', 'Karnataka', 'metro', true, true),
  ('Chennai Metro', 'Chennai', 'Tamil Nadu', 'metro', true, true),
  ('Hyderabad Metro', 'Hyderabad', 'Telangana', 'metro', true, true),
  ('Pune Metro', 'Pune', 'Maharashtra', 'metro', true, true),
  ('Kolkata Metro', 'Kolkata', 'West Bengal', 'metro', true, true)
ON CONFLICT DO NOTHING;

-- View for manual trucking cost summary
CREATE OR REPLACE VIEW manual_trucking_summary AS
SELECT 
  mtc.id,
  mtc.from_location,
  mtc.to_location,
  dz.city_name as destination_city,
  dz.zone_type,
  mtc.vehicle_type,
  mtc.distance_km,
  mtc.trucking_cost,
  mtc.fuel_surcharge,
  mtc.toll_charges,
  mtc.loading_unloading_charges,
  mtc.detention_charges,
  mtc.total_cost,
  mtc.currency,
  mtc.vendor_name,
  mtc.is_approved,
  mtc.valid_from,
  mtc.valid_to,
  q.quote_number,
  s.shipment_number,
  mtc.created_at
FROM manual_trucking_costs mtc
LEFT JOIN delivery_zones dz ON mtc.to_zone_id = dz.id
LEFT JOIN quotes q ON mtc.quote_id = q.id
LEFT JOIN shipments s ON mtc.shipment_id = s.id;