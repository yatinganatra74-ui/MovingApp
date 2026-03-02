/*
  # Distance-Based Trucking Calculator System

  1. New Tables
    - `distance_calculator_config` - Configuration for routes and base settings
      * `id` (uuid, primary key)
      * `from_location` (text) - Origin location (default: Nhava Sheva)
      * `to_location` (text) - Destination location
      * `distance_km` (decimal) - Cached distance from Google Maps
      * `estimated_duration_minutes` (integer) - Travel time
      * `route_type` (text) - highway, city, mixed
      * `toll_factor_percentage` (decimal) - Toll as % of distance cost
      * `fixed_toll_amount` (decimal) - Fixed toll amount if known
      * `last_updated` (timestamp) - When distance was last fetched
      * `google_maps_data` (jsonb) - Raw response from Google Maps
      * `is_active` (boolean)
      * `created_at` (timestamp)
      * `created_by` (uuid)

    - `vehicle_cost_config` - Cost per KM by vehicle type
      * `id` (uuid, primary key)
      * `vehicle_type` (text) - Tata 407, 17ft, 32ft etc.
      * `base_cost_per_km` (decimal) - Base rate per KM
      * `fuel_cost_per_km` (decimal) - Fuel component per KM
      * `maintenance_cost_per_km` (decimal) - Maintenance per KM
      * `min_distance_km` (decimal) - Minimum distance for this vehicle
      * `max_distance_km` (decimal) - Maximum recommended distance
      * `driver_allowance_per_day` (decimal) - Daily driver allowance
      * `effective_from` (date)
      * `effective_to` (date)
      * `is_active` (boolean)
      * `currency` (text)
      * `created_at` (timestamp)

    - `toll_route_config` - Specific toll configurations for routes
      * `id` (uuid, primary key)
      * `route_name` (text) - e.g., "Nhava Sheva to Delhi via NH48"
      * `from_location` (text)
      * `to_location` (text)
      * `toll_points` (jsonb) - Array of toll plazas with costs
      * `total_toll_cost` (decimal)
      * `vehicle_type` (text) - Different tolls for different vehicle types
      * `last_verified` (date)
      * `is_active` (boolean)
      * `created_at` (timestamp)

    - `distance_calculation_log` - Log of all distance calculations
      * `id` (uuid, primary key)
      * `from_location` (text)
      * `to_location` (text)
      * `distance_km` (decimal)
      * `duration_minutes` (integer)
      * `api_provider` (text) - google_maps, mapbox, etc.
      * `calculation_method` (text) - api, manual, cached
      * `api_response` (jsonb)
      * `calculated_at` (timestamp)
      * `calculated_by` (uuid)

  2. Functions
    - Calculate total trucking cost based on distance
    - Get toll cost for route
    - Calculate driver allowance based on duration
    - Estimate total trip cost with all factors

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Distance Calculator Configuration Table
CREATE TABLE IF NOT EXISTS distance_calculator_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location text NOT NULL,
  to_location text NOT NULL,
  distance_km decimal(10, 2),
  estimated_duration_minutes integer,
  route_type text DEFAULT 'highway',
  toll_factor_percentage decimal(5, 2) DEFAULT 0,
  fixed_toll_amount decimal(10, 2) DEFAULT 0,
  last_updated timestamptz,
  google_maps_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(from_location, to_location)
);

ALTER TABLE distance_calculator_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view distance calculator config"
  ON distance_calculator_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert distance calculator config"
  ON distance_calculator_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update distance calculator config"
  ON distance_calculator_config FOR UPDATE
  TO authenticated
  USING (true);

-- Vehicle Cost Configuration Table
CREATE TABLE IF NOT EXISTS vehicle_cost_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text NOT NULL,
  base_cost_per_km decimal(10, 2) NOT NULL DEFAULT 0,
  fuel_cost_per_km decimal(10, 2) NOT NULL DEFAULT 0,
  maintenance_cost_per_km decimal(10, 2) DEFAULT 0,
  min_distance_km decimal(10, 2) DEFAULT 0,
  max_distance_km decimal(10, 2),
  driver_allowance_per_day decimal(10, 2) DEFAULT 0,
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  currency text DEFAULT 'INR',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE vehicle_cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vehicle cost config"
  ON vehicle_cost_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert vehicle cost config"
  ON vehicle_cost_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update vehicle cost config"
  ON vehicle_cost_config FOR UPDATE
  TO authenticated
  USING (true);

-- Toll Route Configuration Table
CREATE TABLE IF NOT EXISTS toll_route_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name text NOT NULL,
  from_location text NOT NULL,
  to_location text NOT NULL,
  toll_points jsonb DEFAULT '[]'::jsonb,
  total_toll_cost decimal(10, 2) DEFAULT 0,
  vehicle_type text NOT NULL,
  last_verified date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  notes text
);

ALTER TABLE toll_route_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view toll route config"
  ON toll_route_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert toll route config"
  ON toll_route_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update toll route config"
  ON toll_route_config FOR UPDATE
  TO authenticated
  USING (true);

-- Distance Calculation Log Table
CREATE TABLE IF NOT EXISTS distance_calculation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location text NOT NULL,
  to_location text NOT NULL,
  distance_km decimal(10, 2),
  duration_minutes integer,
  api_provider text DEFAULT 'google_maps',
  calculation_method text DEFAULT 'api',
  api_response jsonb,
  calculated_at timestamptz DEFAULT now(),
  calculated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE distance_calculation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view distance calculation log"
  ON distance_calculation_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert distance calculation log"
  ON distance_calculation_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = calculated_by);

-- Function to get active vehicle cost config
CREATE OR REPLACE FUNCTION get_vehicle_cost_config(
  p_vehicle_type text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  vehicle_type text,
  base_cost_per_km decimal,
  fuel_cost_per_km decimal,
  maintenance_cost_per_km decimal,
  total_cost_per_km decimal,
  driver_allowance_per_day decimal,
  currency text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vcc.vehicle_type,
    vcc.base_cost_per_km,
    vcc.fuel_cost_per_km,
    vcc.maintenance_cost_per_km,
    (vcc.base_cost_per_km + vcc.fuel_cost_per_km + vcc.maintenance_cost_per_km) as total_cost_per_km,
    vcc.driver_allowance_per_day,
    vcc.currency
  FROM vehicle_cost_config vcc
  WHERE vcc.vehicle_type = p_vehicle_type
    AND vcc.is_active = true
    AND (vcc.effective_from IS NULL OR vcc.effective_from <= p_date)
    AND (vcc.effective_to IS NULL OR vcc.effective_to >= p_date)
  ORDER BY vcc.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get toll cost for route
CREATE OR REPLACE FUNCTION get_toll_cost_for_route(
  p_from_location text,
  p_to_location text,
  p_vehicle_type text DEFAULT '17ft'
)
RETURNS TABLE (
  route_name text,
  total_toll_cost decimal,
  toll_points jsonb,
  last_verified date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    trc.route_name,
    trc.total_toll_cost,
    trc.toll_points,
    trc.last_verified
  FROM toll_route_config trc
  WHERE trc.from_location ILIKE '%' || p_from_location || '%'
    AND trc.to_location ILIKE '%' || p_to_location || '%'
    AND trc.vehicle_type = p_vehicle_type
    AND trc.is_active = true
  ORDER BY trc.last_verified DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate driver allowance based on duration
CREATE OR REPLACE FUNCTION calculate_driver_allowance(
  p_duration_minutes integer,
  p_vehicle_type text,
  p_allowance_per_day decimal DEFAULT 500
)
RETURNS decimal AS $$
DECLARE
  v_days decimal;
  v_allowance decimal;
  v_config_allowance decimal;
BEGIN
  -- Get configured allowance for vehicle type
  SELECT driver_allowance_per_day INTO v_config_allowance
  FROM vehicle_cost_config
  WHERE vehicle_type = p_vehicle_type
    AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Use configured allowance if available, otherwise use default
  v_allowance := COALESCE(v_config_allowance, p_allowance_per_day);
  
  -- Calculate days (8 hours of driving = 1 day, round up)
  v_days := CEIL(p_duration_minutes::decimal / (8 * 60));
  
  -- Minimum 1 day allowance
  IF v_days < 1 THEN
    v_days := 1;
  END IF;
  
  RETURN v_days * v_allowance;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total distance-based trucking cost
CREATE OR REPLACE FUNCTION calculate_distance_based_trucking_cost(
  p_from_location text,
  p_to_location text,
  p_distance_km decimal,
  p_vehicle_type text,
  p_duration_minutes integer DEFAULT NULL,
  p_include_toll boolean DEFAULT true,
  p_include_driver_allowance boolean DEFAULT true
)
RETURNS TABLE (
  base_distance_cost decimal,
  fuel_cost decimal,
  maintenance_cost decimal,
  toll_cost decimal,
  driver_allowance decimal,
  total_cost decimal,
  cost_breakdown jsonb
) AS $$
DECLARE
  v_vehicle_config record;
  v_toll_config record;
  v_base_cost decimal := 0;
  v_fuel_cost decimal := 0;
  v_maintenance_cost decimal := 0;
  v_toll_cost decimal := 0;
  v_driver_allowance decimal := 0;
  v_total_cost decimal := 0;
  v_breakdown jsonb;
BEGIN
  -- Get vehicle cost configuration
  SELECT * INTO v_vehicle_config
  FROM get_vehicle_cost_config(p_vehicle_type);
  
  IF v_vehicle_config IS NOT NULL THEN
    v_base_cost := v_vehicle_config.base_cost_per_km * p_distance_km;
    v_fuel_cost := v_vehicle_config.fuel_cost_per_km * p_distance_km;
    v_maintenance_cost := v_vehicle_config.maintenance_cost_per_km * p_distance_km;
  END IF;
  
  -- Get toll cost if requested
  IF p_include_toll THEN
    SELECT * INTO v_toll_config
    FROM get_toll_cost_for_route(p_from_location, p_to_location, p_vehicle_type);
    
    IF v_toll_config IS NOT NULL THEN
      v_toll_cost := v_toll_config.total_toll_cost;
    ELSE
      -- Use toll factor from distance config if specific toll not found
      SELECT 
        (v_base_cost * COALESCE(toll_factor_percentage, 0) / 100) + COALESCE(fixed_toll_amount, 0)
      INTO v_toll_cost
      FROM distance_calculator_config
      WHERE from_location = p_from_location
        AND to_location = p_to_location
        AND is_active = true
      LIMIT 1;
      
      v_toll_cost := COALESCE(v_toll_cost, 0);
    END IF;
  END IF;
  
  -- Calculate driver allowance if requested
  IF p_include_driver_allowance AND p_duration_minutes IS NOT NULL THEN
    v_driver_allowance := calculate_driver_allowance(
      p_duration_minutes,
      p_vehicle_type,
      COALESCE(v_vehicle_config.driver_allowance_per_day, 500)
    );
  END IF;
  
  -- Calculate total
  v_total_cost := v_base_cost + v_fuel_cost + v_maintenance_cost + v_toll_cost + v_driver_allowance;
  
  -- Build breakdown JSON
  v_breakdown := jsonb_build_object(
    'distance_km', p_distance_km,
    'vehicle_type', p_vehicle_type,
    'base_cost_per_km', v_vehicle_config.base_cost_per_km,
    'fuel_cost_per_km', v_vehicle_config.fuel_cost_per_km,
    'maintenance_cost_per_km', v_vehicle_config.maintenance_cost_per_km,
    'base_distance_cost', v_base_cost,
    'fuel_cost', v_fuel_cost,
    'maintenance_cost', v_maintenance_cost,
    'toll_cost', v_toll_cost,
    'driver_allowance', v_driver_allowance,
    'driver_days', CASE WHEN p_duration_minutes IS NOT NULL THEN CEIL(p_duration_minutes::decimal / (8 * 60)) ELSE 0 END,
    'total_cost', v_total_cost
  );
  
  RETURN QUERY SELECT 
    v_base_cost,
    v_fuel_cost,
    v_maintenance_cost,
    v_toll_cost,
    v_driver_allowance,
    v_total_cost,
    v_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Insert default vehicle cost configurations
INSERT INTO vehicle_cost_config (vehicle_type, base_cost_per_km, fuel_cost_per_km, maintenance_cost_per_km, driver_allowance_per_day, currency)
VALUES 
  ('Tata 407', 25, 8, 2, 500, 'INR'),
  ('10ft', 28, 9, 2, 500, 'INR'),
  ('14ft', 30, 10, 3, 500, 'INR'),
  ('17ft', 32, 11, 3, 600, 'INR'),
  ('19ft', 34, 12, 3, 600, 'INR'),
  ('20ft', 35, 12, 3, 600, 'INR'),
  ('22ft', 38, 13, 4, 700, 'INR'),
  ('24ft', 40, 14, 4, 700, 'INR'),
  ('32ft Container', 45, 16, 5, 800, 'INR')
ON CONFLICT DO NOTHING;

-- Insert common toll routes (examples - update with actual toll data)
INSERT INTO toll_route_config (route_name, from_location, to_location, vehicle_type, total_toll_cost, toll_points, last_verified)
VALUES 
  (
    'Nhava Sheva to Delhi via NH48',
    'Nhava Sheva',
    'Delhi',
    '17ft',
    3500,
    '[
      {"name": "Mumbai Entry", "cost": 250},
      {"name": "Surat Toll", "cost": 180},
      {"name": "Vadodara Toll", "cost": 220},
      {"name": "Ahmedabad Toll", "cost": 200},
      {"name": "Udaipur Toll", "cost": 280},
      {"name": "Ajmer Toll", "cost": 240},
      {"name": "Jaipur Toll", "cost": 350},
      {"name": "Gurgaon Entry", "cost": 400},
      {"name": "Delhi Entry", "cost": 1380}
    ]'::jsonb,
    CURRENT_DATE
  ),
  (
    'Nhava Sheva to Bangalore via NH48',
    'Nhava Sheva',
    'Bangalore',
    '17ft',
    2200,
    '[
      {"name": "Pune Toll", "cost": 150},
      {"name": "Satara Toll", "cost": 200},
      {"name": "Kolhapur Toll", "cost": 180},
      {"name": "Belgaum Toll", "cost": 220},
      {"name": "Hubli Toll", "cost": 250},
      {"name": "Bangalore Entry", "cost": 1200}
    ]'::jsonb,
    CURRENT_DATE
  ),
  (
    'Nhava Sheva to Chennai via NH48',
    'Nhava Sheva',
    'Chennai',
    '17ft',
    2800,
    '[
      {"name": "Pune Toll", "cost": 150},
      {"name": "Solapur Toll", "cost": 200},
      {"name": "Kurnool Toll", "cost": 250},
      {"name": "Anantapur Toll", "cost": 220},
      {"name": "Vellore Toll", "cost": 280},
      {"name": "Chennai Entry", "cost": 1700}
    ]'::jsonb,
    CURRENT_DATE
  )
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_distance_calculator_config_locations 
ON distance_calculator_config(from_location, to_location);

CREATE INDEX IF NOT EXISTS idx_vehicle_cost_config_type 
ON vehicle_cost_config(vehicle_type, is_active);

CREATE INDEX IF NOT EXISTS idx_toll_route_config_route 
ON toll_route_config(from_location, to_location, vehicle_type);

CREATE INDEX IF NOT EXISTS idx_distance_calculation_log_locations 
ON distance_calculation_log(from_location, to_location);