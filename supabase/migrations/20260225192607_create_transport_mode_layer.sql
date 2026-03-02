/*
  # Transport Mode Layer - SEA and AIR Support

  1. New Tables
    - `locations` - Unified table for seaports, ICDs, and airports
      - Replaces indian_ports_icds with expanded scope
      - Supports seaports, ICDs, CFS, and airports
    - `transport_mode_config` - Transport mode definitions

  2. Schema Enhancements
    - Add transport_mode to shipment_drafts with weight fields for AIR
    - Add transport_mode to groupage_containers with KG capacity
    - Add transport_mode to container_shipments
    - Add transport_mode to rate_sheets and rate_sheet_slabs
    - Add KG-based slab fields for AIR freight pricing

  3. Data Migration
    - Migrate existing port data to locations table
    - Set default transport_mode = 'SEA' for all existing records
    - Insert major Indian airports

  4. Important Notes
    - SEA mode uses CBM for calculations
    - AIR mode uses chargeable_weight_kg (MAX of gross and volumetric)
    - Volumetric weight = CBM × 167 kg (IATA standard)
    - All existing data remains valid with SEA defaults
*/

-- Create locations table (renamed from indian_ports_icds)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code text UNIQUE NOT NULL,
  location_name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('seaport', 'icd', 'cfs', 'airport')),
  iata_code text,
  un_locode text,
  city text NOT NULL,
  state text NOT NULL,
  country text DEFAULT 'India',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Migrate data from indian_ports_icds if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indian_ports_icds') THEN
    INSERT INTO locations (location_code, location_name, location_type, city, state, is_active, display_order)
    SELECT 
      port_code,
      port_name,
      CASE 
        WHEN port_type = 'port' THEN 'seaport'
        WHEN port_type = 'icd' THEN 'icd'
        WHEN port_type = 'cfs' THEN 'cfs'
        ELSE 'seaport'
      END,
      city,
      state,
      is_active,
      display_order
    FROM indian_ports_icds
    ON CONFLICT (location_code) DO NOTHING;
  END IF;
END $$;

-- Insert major Indian airports
INSERT INTO locations (location_code, location_name, location_type, iata_code, city, state, is_active, display_order) VALUES
  ('BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'airport', 'BOM', 'Mumbai', 'Maharashtra', true, 1),
  ('DEL', 'Indira Gandhi International Airport', 'airport', 'DEL', 'New Delhi', 'Delhi', true, 2),
  ('BLR', 'Kempegowda International Airport', 'airport', 'BLR', 'Bangalore', 'Karnataka', true, 3),
  ('MAA', 'Chennai International Airport', 'airport', 'MAA', 'Chennai', 'Tamil Nadu', true, 4),
  ('CCU', 'Netaji Subhas Chandra Bose International Airport', 'airport', 'CCU', 'Kolkata', 'West Bengal', true, 5),
  ('HYD', 'Rajiv Gandhi International Airport', 'airport', 'HYD', 'Hyderabad', 'Telangana', true, 6)
ON CONFLICT (location_code) DO NOTHING;

-- Create transport mode configuration table
CREATE TABLE IF NOT EXISTS transport_mode_config (
  mode_code text PRIMARY KEY CHECK (mode_code IN ('SEA', 'AIR')),
  mode_name text NOT NULL,
  primary_unit text NOT NULL CHECK (primary_unit IN ('CBM', 'KG')),
  supports_containers boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO transport_mode_config (mode_code, mode_name, primary_unit, supports_containers) VALUES
  ('SEA', 'Sea Freight', 'CBM', true),
  ('AIR', 'Air Freight', 'KG', false)
ON CONFLICT (mode_code) DO NOTHING;

-- Add transport mode to shipment_drafts
ALTER TABLE shipment_drafts
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR')),
  ADD COLUMN IF NOT EXISTS gross_weight_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS volumetric_weight_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS chargeable_weight_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES locations(id);

-- Add index for transport mode queries
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_transport_mode ON shipment_drafts(transport_mode, status);

-- Add transport mode to groupage_containers
ALTER TABLE groupage_containers
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR')),
  ADD COLUMN IF NOT EXISTS total_capacity_kg decimal(12,2),
  ADD COLUMN IF NOT EXISTS used_capacity_kg decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin_location_id uuid REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES locations(id);

-- Add index for mode filtering
CREATE INDEX IF NOT EXISTS idx_groupage_containers_mode ON groupage_containers(transport_mode, status);

-- Add transport mode to container_shipments
ALTER TABLE container_shipments
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR')),
  ADD COLUMN IF NOT EXISTS gross_weight_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS chargeable_weight_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS volumetric_weight_kg decimal(10,2);

-- Add transport mode to rate_sheets
ALTER TABLE rate_sheets
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR', 'BOTH')),
  ADD COLUMN IF NOT EXISTS measurement_basis text DEFAULT 'CBM' CHECK (measurement_basis IN ('CBM', 'KG', 'BOTH'));

-- Add index for rate sheet filtering
CREATE INDEX IF NOT EXISTS idx_rate_sheets_mode ON rate_sheets(transport_mode, is_active);

-- Add KG-based fields to rate_sheet_slabs
ALTER TABLE rate_sheet_slabs
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR')),
  ADD COLUMN IF NOT EXISTS from_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS to_kg decimal(10,2),
  ADD COLUMN IF NOT EXISTS rate_per_kg decimal(10,2);

-- Add index for slab queries
CREATE INDEX IF NOT EXISTS idx_rate_sheet_slabs_mode ON rate_sheet_slabs(rate_sheet_id, transport_mode);

-- Add transport mode to containers (legacy import system)
ALTER TABLE containers
  ADD COLUMN IF NOT EXISTS transport_mode text DEFAULT 'SEA' CHECK (transport_mode IN ('SEA', 'AIR')),
  ADD COLUMN IF NOT EXISTS pod_location_id uuid REFERENCES locations(id);

-- Enable RLS on locations table
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations are viewable by authenticated users"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Locations are manageable by authenticated users"
  ON locations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on transport_mode_config
ALTER TABLE transport_mode_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transport mode config viewable by all authenticated users"
  ON transport_mode_config FOR SELECT
  TO authenticated
  USING (true);
