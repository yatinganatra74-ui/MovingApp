/*
  # Enhanced Move Types with Vehicle Shipping
  
  1. Move Type Hierarchy
    - Office Shifting (commercial)
    - Local Move (household, within city)
    - Domestic Move (household, intercity/interstate)
    - Automobile Shifting (vehicle only)
    - International Inbound (with optional vehicles)
    - International Outbound (with optional vehicles)
  
  2. New Tables
    - `move_vehicles` - Track motorcycles and cars being shipped
    - `move_office_details` - Office-specific requirements
  
  3. Enhancements to Moves Table
    - Add detailed move classification
    - Track vehicle shipment flags
    - Office shifting specifics
*/

-- Add new columns to moves table for detailed classification
ALTER TABLE moves 
  ADD COLUMN IF NOT EXISTS move_subtype text CHECK (move_subtype IN (
    'household_local', 'household_domestic', 'household_international',
    'office_local', 'office_domestic', 'office_international',
    'vehicle_only', 'mixed_household_vehicle', 'mixed_office_vehicle'
  )),
  ADD COLUMN IF NOT EXISTS is_office_shifting boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_local_move boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS includes_vehicles boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS number_of_vehicles integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicle_types text[],
  ADD COLUMN IF NOT EXISTS distance_km decimal(10,2),
  ADD COLUMN IF NOT EXISTS is_within_city boolean DEFAULT false;

-- Create move_vehicles table
CREATE TABLE IF NOT EXISTS move_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  -- Vehicle Type
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('motorcycle', 'scooter', 'car', 'suv', 'van', 'other')),
  
  -- Vehicle Details
  make text NOT NULL,
  model text NOT NULL,
  year integer,
  color text,
  registration_number text,
  vin_number text,
  
  -- Dimensions & Weight
  length_cm decimal(10,2),
  width_cm decimal(10,2),
  height_cm decimal(10,2),
  weight_kg decimal(10,2),
  calculated_cbm decimal(10,4),
  
  -- Condition & Value
  vehicle_condition text CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor')),
  estimated_value decimal(12,2),
  requires_insurance boolean DEFAULT true,
  insurance_amount decimal(12,2),
  
  -- Operational Status
  is_running boolean DEFAULT true,
  fuel_level text CHECK (fuel_level IN ('empty', 'quarter', 'half', 'three_quarter', 'full')),
  has_keys boolean DEFAULT true,
  has_documents boolean DEFAULT true,
  
  -- Damage Documentation
  pre_shipment_condition_notes text,
  pre_shipment_photos jsonb DEFAULT '[]'::jsonb,
  post_shipment_condition_notes text,
  post_shipment_photos jsonb DEFAULT '[]'::jsonb,
  damage_reported boolean DEFAULT false,
  damage_description text,
  
  -- Shipping Details
  requires_enclosed_container boolean DEFAULT false,
  shipping_method text CHECK (shipping_method IN ('roro', 'container_shared', 'container_dedicated', 'flatbed_truck', 'covered_truck')),
  
  -- Customs (for international)
  customs_value_declared decimal(12,2),
  customs_documents jsonb DEFAULT '[]'::jsonb,
  
  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'in_transit', 'customs', 'delivered')),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create move_office_details table
CREATE TABLE IF NOT EXISTS move_office_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE UNIQUE,
  
  -- Office Information
  office_name text NOT NULL,
  company_name text NOT NULL,
  industry text,
  number_of_employees integer,
  office_size_sqft decimal(10,2),
  
  -- Departments Being Moved
  departments text[],
  number_of_workstations integer DEFAULT 0,
  number_of_cabins integer DEFAULT 0,
  number_of_meeting_rooms integer DEFAULT 0,
  
  -- IT Infrastructure
  number_of_servers integer DEFAULT 0,
  number_of_computers integer DEFAULT 0,
  number_of_printers integer DEFAULT 0,
  has_network_infrastructure boolean DEFAULT false,
  it_equipment_notes text,
  
  -- Specialized Equipment
  has_specialized_equipment boolean DEFAULT false,
  specialized_equipment_list text[],
  
  -- Furniture Inventory
  desks_count integer DEFAULT 0,
  chairs_count integer DEFAULT 0,
  cabinets_count integer DEFAULT 0,
  conference_tables_count integer DEFAULT 0,
  sofas_count integer DEFAULT 0,
  
  -- Requirements
  requires_after_hours_move boolean DEFAULT false,
  requires_weekend_move boolean DEFAULT false,
  move_must_complete_in_hours integer,
  requires_it_support boolean DEFAULT false,
  requires_reconnection_services boolean DEFAULT false,
  
  -- Floor Plans
  origin_floor_plan_url text,
  destination_floor_plan_url text,
  
  -- Special Instructions
  sensitive_documents_handling text,
  security_requirements text,
  access_requirements text,
  
  -- Labeling System
  uses_color_coding boolean DEFAULT false,
  uses_department_labels boolean DEFAULT false,
  labeling_instructions text,
  
  -- Dismantling & Reassembly
  items_requiring_dismantling text[],
  items_requiring_reassembly text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_move_vehicles_move ON move_vehicles(move_id, vehicle_type);
CREATE INDEX IF NOT EXISTS idx_move_vehicles_status ON move_vehicles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_move_office_details_move ON move_office_details(move_id);

-- Enable RLS
ALTER TABLE move_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_office_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company users can access move vehicles" 
  ON move_vehicles FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);

CREATE POLICY "Company users can access office details" 
  ON move_office_details FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);

-- Function to auto-calculate vehicle CBM
CREATE OR REPLACE FUNCTION calculate_vehicle_cbm()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.length_cm IS NOT NULL AND NEW.width_cm IS NOT NULL AND NEW.height_cm IS NOT NULL THEN
    NEW.calculated_cbm := (NEW.length_cm * NEW.width_cm * NEW.height_cm) / 1000000.0;
  ELSE
    -- Default CBM based on vehicle type if dimensions not provided
    NEW.calculated_cbm := CASE NEW.vehicle_type
      WHEN 'motorcycle' THEN 1.5
      WHEN 'scooter' THEN 1.2
      WHEN 'car' THEN 6.0
      WHEN 'suv' THEN 8.0
      WHEN 'van' THEN 10.0
      ELSE 5.0
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_vehicle_cbm ON move_vehicles;
CREATE TRIGGER trg_calculate_vehicle_cbm
  BEFORE INSERT OR UPDATE OF length_cm, width_cm, height_cm, vehicle_type
  ON move_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vehicle_cbm();

-- Function to update move when vehicles are added/removed
CREATE OR REPLACE FUNCTION update_move_vehicle_info()
RETURNS TRIGGER AS $$
DECLARE
  v_move_id uuid;
  v_vehicle_count integer;
  v_vehicle_types text[];
  v_total_cbm decimal;
BEGIN
  -- Get move_id
  IF TG_OP = 'DELETE' THEN
    v_move_id := OLD.move_id;
  ELSE
    v_move_id := NEW.move_id;
  END IF;
  
  -- Count vehicles and get types
  SELECT 
    COUNT(*),
    array_agg(DISTINCT vehicle_type::text),
    SUM(calculated_cbm)
  INTO 
    v_vehicle_count,
    v_vehicle_types,
    v_total_cbm
  FROM move_vehicles
  WHERE move_id = v_move_id;
  
  -- Update move
  UPDATE moves
  SET
    includes_vehicles = (v_vehicle_count > 0),
    number_of_vehicles = COALESCE(v_vehicle_count, 0),
    vehicle_types = v_vehicle_types,
    updated_at = now()
  WHERE id = v_move_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_move_vehicle_info ON move_vehicles;
CREATE TRIGGER trg_update_move_vehicle_info
  AFTER INSERT OR UPDATE OR DELETE
  ON move_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_move_vehicle_info();

-- Function to auto-set move subtype based on characteristics
CREATE OR REPLACE FUNCTION auto_set_move_subtype()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-determine subtype if not explicitly set
  IF NEW.move_subtype IS NULL THEN
    IF NEW.is_office_shifting THEN
      NEW.move_subtype := CASE
        WHEN NEW.is_within_city OR NEW.is_local_move THEN 'office_local'
        WHEN NEW.move_type = 'domestic' THEN 'office_domestic'
        ELSE 'office_international'
      END;
    ELSIF NEW.includes_vehicles AND NEW.estimated_volume_cbm = 0 THEN
      NEW.move_subtype := 'vehicle_only';
    ELSIF NEW.includes_vehicles THEN
      IF NEW.is_office_shifting THEN
        NEW.move_subtype := 'mixed_office_vehicle';
      ELSE
        NEW.move_subtype := 'mixed_household_vehicle';
      END IF;
    ELSE
      NEW.move_subtype := CASE
        WHEN NEW.is_within_city OR NEW.is_local_move THEN 'household_local'
        WHEN NEW.move_type = 'domestic' THEN 'household_domestic'
        ELSE 'household_international'
      END;
    END IF;
  END IF;
  
  -- Set is_local_move based on distance or is_within_city
  IF NEW.distance_km IS NOT NULL AND NEW.distance_km < 100 THEN
    NEW.is_local_move := true;
    NEW.is_within_city := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_move_subtype ON moves;
CREATE TRIGGER trg_auto_set_move_subtype
  BEFORE INSERT OR UPDATE OF is_office_shifting, includes_vehicles, distance_km, move_type
  ON moves
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_move_subtype();

-- Create view for move summary with all details
CREATE OR REPLACE VIEW move_summary AS
SELECT 
  m.*,
  -- Vehicle summary
  COALESCE(v.vehicle_count, 0) as total_vehicles,
  COALESCE(v.motorcycles, 0) as motorcycles_count,
  COALESCE(v.cars, 0) as cars_count,
  COALESCE(v.vehicle_cbm, 0) as vehicles_total_cbm,
  -- Office details
  od.office_name,
  od.number_of_employees,
  od.number_of_workstations,
  -- Financial summary
  (SELECT COUNT(*) FROM move_costs WHERE move_id = m.id) as cost_items_count,
  (SELECT COUNT(*) FROM move_revenue WHERE move_id = m.id) as revenue_items_count,
  (SELECT COUNT(*) FROM move_documents WHERE move_id = m.id) as documents_count,
  (SELECT COUNT(*) FROM move_milestones WHERE move_id = m.id AND is_completed = true) as completed_milestones,
  (SELECT COUNT(*) FROM move_milestones WHERE move_id = m.id) as total_milestones
FROM moves m
LEFT JOIN (
  SELECT 
    move_id,
    COUNT(*) as vehicle_count,
    SUM(CASE WHEN vehicle_type IN ('motorcycle', 'scooter') THEN 1 ELSE 0 END) as motorcycles,
    SUM(CASE WHEN vehicle_type IN ('car', 'suv', 'van') THEN 1 ELSE 0 END) as cars,
    SUM(calculated_cbm) as vehicle_cbm
  FROM move_vehicles
  GROUP BY move_id
) v ON m.id = v.move_id
LEFT JOIN move_office_details od ON m.id = od.move_id;

-- Add comments for documentation
COMMENT ON TABLE moves IS 'Central hub - all operations revolve around the move';
COMMENT ON TABLE move_vehicles IS 'Vehicle shipment tracking for motorcycles, cars, etc.';
COMMENT ON TABLE move_office_details IS 'Additional details specific to office shifting';
COMMENT ON COLUMN moves.move_subtype IS 'Detailed classification: household_local, office_domestic, vehicle_only, mixed, etc.';
COMMENT ON COLUMN moves.includes_vehicles IS 'Auto-set to true when vehicles are added to the move';
