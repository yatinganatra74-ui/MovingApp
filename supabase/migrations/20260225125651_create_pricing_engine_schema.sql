/*
  # Financial Calculation Engine Schema

  ## Overview
  Comprehensive pricing engine supporting:
  - Domestic, Inbound, Outbound, Third Country moves
  - Air, Sea, Road transport modes
  - Slab-based tariffs (volume/weight ranges)
  - KG-based air freight
  - Groupage pricing
  - Multi-currency support
  - Fixed + percentage margin combinations

  ## New Tables

  1. `pricing_zones` - Geographic pricing zones
     - `id` (uuid, primary key)
     - `zone_code` (text) - e.g., "ZONE_A", "DOMESTIC_LOCAL"
     - `zone_name` (text)
     - `countries` (text array)
     - `active` (boolean)

  2. `transport_modes` - Transport method configurations
     - `id` (uuid, primary key)
     - `mode_code` (text) - air, sea, road
     - `mode_name` (text)
     - `active` (boolean)

  3. `move_directions` - Move type configurations
     - `id` (uuid, primary key)
     - `direction_code` (text) - domestic, inbound, outbound, third_country
     - `direction_name` (text)
     - `active` (boolean)

  4. `pricing_slabs` - Volume/Weight-based pricing tiers
     - `id` (uuid, primary key)
     - `slab_name` (text)
     - `from_zone_id` (uuid)
     - `to_zone_id` (uuid)
     - `direction_id` (uuid)
     - `transport_mode_id` (uuid)
     - `min_value` (numeric) - minimum volume/weight
     - `max_value` (numeric) - maximum volume/weight
     - `measurement_unit` (text) - cubic_feet, cubic_meters, kg
     - `base_rate` (numeric)
     - `currency_id` (uuid)
     - `active` (boolean)

  5. `air_freight_rates` - KG-based air freight pricing
     - `id` (uuid, primary key)
     - `from_zone_id` (uuid)
     - `to_zone_id` (uuid)
     - `direction_id` (uuid)
     - `rate_per_kg` (numeric)
     - `minimum_charge` (numeric)
     - `currency_id` (uuid)
     - `fuel_surcharge_percent` (numeric)
     - `active` (boolean)

  6. `groupage_rates` - Shared container pricing
     - `id` (uuid, primary key)
     - `from_zone_id` (uuid)
     - `to_zone_id` (uuid)
     - `container_type` (text)
     - `rate_per_cubic_foot` (numeric)
     - `minimum_charge` (numeric)
     - `currency_id` (uuid)
     - `active` (boolean)

  7. `margin_profiles` - Profit margin configurations
     - `id` (uuid, primary key)
     - `profile_name` (text)
     - `fixed_amount` (numeric)
     - `percentage_margin` (numeric)
     - `currency_id` (uuid)
     - `applies_to` (text) - all, transport, labor, materials
     - `active` (boolean)

  8. `service_charges` - Additional service pricing
     - `id` (uuid, primary key)
     - `service_name` (text)
     - `service_code` (text)
     - `charge_type` (text) - fixed, per_item, per_hour, percentage
     - `amount` (numeric)
     - `currency_id` (uuid)
     - `active` (boolean)

  9. `pricing_calculations` - Saved calculation history
     - `id` (uuid, primary key)
     - `quote_id` (uuid)
     - `direction_code` (text)
     - `transport_mode` (text)
     - `volume` (numeric)
     - `weight_kg` (numeric)
     - `from_zone` (text)
     - `to_zone` (text)
     - `base_cost` (numeric)
     - `margin_applied` (numeric)
     - `final_price` (numeric)
     - `currency_id` (uuid)
     - `calculation_details` (jsonb)
     - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Policies for authenticated users
*/

-- Create pricing zones table
CREATE TABLE IF NOT EXISTS pricing_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code text UNIQUE NOT NULL,
  zone_name text NOT NULL,
  countries text[] DEFAULT ARRAY[]::text[],
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create transport modes table
CREATE TABLE IF NOT EXISTS transport_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode_code text UNIQUE NOT NULL,
  mode_name text NOT NULL,
  active boolean DEFAULT true
);

-- Create move directions table
CREATE TABLE IF NOT EXISTS move_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction_code text UNIQUE NOT NULL,
  direction_name text NOT NULL,
  active boolean DEFAULT true
);

-- Create pricing slabs table
CREATE TABLE IF NOT EXISTS pricing_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slab_name text NOT NULL,
  from_zone_id uuid REFERENCES pricing_zones(id),
  to_zone_id uuid REFERENCES pricing_zones(id),
  direction_id uuid REFERENCES move_directions(id),
  transport_mode_id uuid REFERENCES transport_modes(id),
  min_value numeric DEFAULT 0,
  max_value numeric DEFAULT 999999,
  measurement_unit text DEFAULT 'cubic_feet',
  base_rate numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create air freight rates table
CREATE TABLE IF NOT EXISTS air_freight_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_zone_id uuid REFERENCES pricing_zones(id),
  to_zone_id uuid REFERENCES pricing_zones(id),
  direction_id uuid REFERENCES move_directions(id),
  rate_per_kg numeric DEFAULT 0,
  minimum_charge numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  fuel_surcharge_percent numeric DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create groupage rates table
CREATE TABLE IF NOT EXISTS groupage_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_zone_id uuid REFERENCES pricing_zones(id),
  to_zone_id uuid REFERENCES pricing_zones(id),
  container_type text NOT NULL,
  rate_per_cubic_foot numeric DEFAULT 0,
  minimum_charge numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create margin profiles table
CREATE TABLE IF NOT EXISTS margin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL,
  fixed_amount numeric DEFAULT 0,
  percentage_margin numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  applies_to text DEFAULT 'all',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create service charges table
CREATE TABLE IF NOT EXISTS service_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  service_code text UNIQUE NOT NULL,
  charge_type text DEFAULT 'fixed',
  amount numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create pricing calculations table
CREATE TABLE IF NOT EXISTS pricing_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id),
  direction_code text NOT NULL,
  transport_mode text NOT NULL,
  volume numeric DEFAULT 0,
  weight_kg numeric DEFAULT 0,
  from_zone text,
  to_zone text,
  base_cost numeric DEFAULT 0,
  margin_applied numeric DEFAULT 0,
  final_price numeric DEFAULT 0,
  currency_id uuid REFERENCES currencies(id),
  calculation_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_freight_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE margin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can manage pricing_zones"
  ON pricing_zones FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage transport_modes"
  ON transport_modes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage move_directions"
  ON move_directions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage pricing_slabs"
  ON pricing_slabs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage air_freight_rates"
  ON air_freight_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage groupage_rates"
  ON groupage_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage margin_profiles"
  ON margin_profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage service_charges"
  ON service_charges FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage pricing_calculations"
  ON pricing_calculations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default transport modes
INSERT INTO transport_modes (mode_code, mode_name) VALUES
  ('air', 'Air Freight'),
  ('sea', 'Sea Freight'),
  ('road', 'Road Transport')
ON CONFLICT (mode_code) DO NOTHING;

-- Insert default move directions
INSERT INTO move_directions (direction_code, direction_name) VALUES
  ('domestic', 'Domestic Move'),
  ('inbound', 'Inbound International'),
  ('outbound', 'Outbound International'),
  ('third_country', 'Third Country Move')
ON CONFLICT (direction_code) DO NOTHING;

-- Insert default pricing zones
INSERT INTO pricing_zones (zone_code, zone_name, countries) VALUES
  ('DOMESTIC_LOCAL', 'Local Domestic', ARRAY['Same City']::text[]),
  ('DOMESTIC_NATIONAL', 'National Domestic', ARRAY['Same Country']::text[]),
  ('ZONE_EUROPE', 'Europe', ARRAY['UK', 'France', 'Germany', 'Italy', 'Spain']::text[]),
  ('ZONE_MIDDLE_EAST', 'Middle East', ARRAY['UAE', 'Saudi Arabia', 'Qatar', 'Oman']::text[]),
  ('ZONE_ASIA', 'Asia Pacific', ARRAY['Singapore', 'Hong Kong', 'Japan', 'Australia']::text[]),
  ('ZONE_AMERICAS', 'Americas', ARRAY['USA', 'Canada', 'Mexico', 'Brazil']::text[]),
  ('ZONE_INDIA', 'India', ARRAY['India']::text[])
ON CONFLICT (zone_code) DO NOTHING;

-- Insert sample pricing slabs (Sea Freight - Outbound from India to Europe)
DO $$
DECLARE
  zone_india uuid;
  zone_europe uuid;
  dir_outbound uuid;
  mode_sea uuid;
  curr_usd uuid;
BEGIN
  SELECT id INTO zone_india FROM pricing_zones WHERE zone_code = 'ZONE_INDIA' LIMIT 1;
  SELECT id INTO zone_europe FROM pricing_zones WHERE zone_code = 'ZONE_EUROPE' LIMIT 1;
  SELECT id INTO dir_outbound FROM move_directions WHERE direction_code = 'outbound' LIMIT 1;
  SELECT id INTO mode_sea FROM transport_modes WHERE mode_code = 'sea' LIMIT 1;
  SELECT id INTO curr_usd FROM currencies WHERE code = 'USD' LIMIT 1;

  INSERT INTO pricing_slabs (slab_name, from_zone_id, to_zone_id, direction_id, transport_mode_id, min_value, max_value, measurement_unit, base_rate, currency_id) VALUES
    ('0-500 cu ft', zone_india, zone_europe, dir_outbound, mode_sea, 0, 500, 'cubic_feet', 2500, curr_usd),
    ('501-1000 cu ft', zone_india, zone_europe, dir_outbound, mode_sea, 501, 1000, 'cubic_feet', 4500, curr_usd),
    ('1001-1500 cu ft', zone_india, zone_europe, dir_outbound, mode_sea, 1001, 1500, 'cubic_feet', 6000, curr_usd),
    ('1501-2000 cu ft', zone_india, zone_europe, dir_outbound, mode_sea, 1501, 2000, 'cubic_feet', 7500, curr_usd),
    ('2001+ cu ft', zone_india, zone_europe, dir_outbound, mode_sea, 2001, 999999, 'cubic_feet', 9000, curr_usd)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert sample air freight rates
DO $$
DECLARE
  zone_india uuid;
  zone_europe uuid;
  dir_outbound uuid;
  curr_usd uuid;
BEGIN
  SELECT id INTO zone_india FROM pricing_zones WHERE zone_code = 'ZONE_INDIA' LIMIT 1;
  SELECT id INTO zone_europe FROM pricing_zones WHERE zone_code = 'ZONE_EUROPE' LIMIT 1;
  SELECT id INTO dir_outbound FROM move_directions WHERE direction_code = 'outbound' LIMIT 1;
  SELECT id INTO curr_usd FROM currencies WHERE code = 'USD' LIMIT 1;

  INSERT INTO air_freight_rates (from_zone_id, to_zone_id, direction_id, rate_per_kg, minimum_charge, fuel_surcharge_percent, currency_id) VALUES
    (zone_india, zone_europe, dir_outbound, 8.50, 500, 15, curr_usd)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert sample margin profiles
DO $$
DECLARE
  curr_usd uuid;
BEGIN
  SELECT id INTO curr_usd FROM currencies WHERE code = 'USD' LIMIT 1;

  INSERT INTO margin_profiles (profile_name, fixed_amount, percentage_margin, applies_to, currency_id) VALUES
    ('Standard Margin', 200, 20, 'all', curr_usd),
    ('Premium Margin', 500, 25, 'all', curr_usd),
    ('Economy Margin', 100, 15, 'all', curr_usd)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert sample service charges
DO $$
DECLARE
  curr_usd uuid;
BEGIN
  SELECT id INTO curr_usd FROM currencies WHERE code = 'USD' LIMIT 1;

  INSERT INTO service_charges (service_name, service_code, charge_type, amount, currency_id) VALUES
    ('Packing Service', 'PACKING', 'per_item', 25, curr_usd),
    ('Loading Service', 'LOADING', 'per_hour', 50, curr_usd),
    ('Insurance', 'INSURANCE', 'percentage', 2, curr_usd),
    ('Documentation Fee', 'DOCS', 'fixed', 100, curr_usd),
    ('Customs Clearance', 'CUSTOMS', 'fixed', 350, curr_usd),
    ('Port Handling', 'PORT_HANDLING', 'fixed', 250, curr_usd),
    ('Delivery to Door', 'DELIVERY', 'fixed', 200, curr_usd)
  ON CONFLICT (service_code) DO NOTHING;
END $$;