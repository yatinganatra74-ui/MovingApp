/*
  # Additional Trucking System for Non-Metro Deliveries

  1. New Tables
    - trucking_vendors: Vendor master list for trucking services
    - import_shipment_trucking_costs: Additional trucking costs per shipment
    
  2. Trucking Vendors
    - Vendor details: name, contact, rates
    - Truck types supported
    - Service areas
    
  3. Trucking Cost Structure
    - Base truck cost (manual entry)
    - Toll estimate (manual entry)
    - Escort/special handling (manual entry)
    - Total cost (auto-sum)
    - Margin % (optional)
    - Billable toggle (Yes/No)
    - Charge currency (INR/USD)
    - Final charge to agent (auto-calculated)
    
  4. Business Logic
    - Only appears if delivery_zone = 'Non-Metro'
    - If billable = Yes → adds revenue line item
    - If billable = No → adds cost only (no revenue)
    
  5. Security
    - RLS enabled on all tables
    - Policies for authenticated users
*/

-- Create trucking_vendors table
CREATE TABLE IF NOT EXISTS trucking_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  vendor_code text UNIQUE,
  contact_person text,
  contact_phone text,
  contact_email text,
  address text,
  supported_truck_types text[],
  service_areas text[],
  payment_terms text,
  credit_limit decimal(12, 2),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create import_shipment_trucking_costs table
CREATE TABLE IF NOT EXISTS import_shipment_trucking_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE NOT NULL,
  truck_type text NOT NULL,
  vendor_id uuid REFERENCES trucking_vendors(id),
  vendor_name text NOT NULL,
  base_truck_cost_inr decimal(12, 2) NOT NULL DEFAULT 0,
  toll_estimate decimal(12, 2) DEFAULT 0,
  escort_special_handling decimal(12, 2) DEFAULT 0,
  total_trucking_cost decimal(12, 2) NOT NULL DEFAULT 0,
  margin_percentage decimal(5, 2) DEFAULT 0,
  margin_amount decimal(12, 2) DEFAULT 0,
  is_billable boolean DEFAULT false,
  charge_currency text DEFAULT 'INR',
  exchange_rate_used decimal(10, 4),
  final_charge_to_agent decimal(12, 2),
  final_charge_currency text DEFAULT 'INR',
  route_details text,
  distance_km decimal(10, 2),
  delivery_zone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Add trucking cost summary to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'has_additional_trucking'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN has_additional_trucking boolean DEFAULT false,
    ADD COLUMN additional_trucking_cost decimal(12, 2) DEFAULT 0,
    ADD COLUMN additional_trucking_billable boolean DEFAULT false,
    ADD COLUMN additional_trucking_revenue decimal(12, 2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trucking_vendors_active 
  ON trucking_vendors(is_active);

CREATE INDEX IF NOT EXISTS idx_trucking_vendors_code 
  ON trucking_vendors(vendor_code);

CREATE INDEX IF NOT EXISTS idx_trucking_costs_shipment 
  ON import_shipment_trucking_costs(import_shipment_id);

CREATE INDEX IF NOT EXISTS idx_trucking_costs_vendor 
  ON import_shipment_trucking_costs(vendor_id);

CREATE INDEX IF NOT EXISTS idx_trucking_costs_billable 
  ON import_shipment_trucking_costs(is_billable);

-- Enable RLS
ALTER TABLE trucking_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipment_trucking_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trucking_vendors
CREATE POLICY "Users can view trucking vendors"
  ON trucking_vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert trucking vendors"
  ON trucking_vendors FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update trucking vendors"
  ON trucking_vendors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Users can delete trucking vendors"
  ON trucking_vendors FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for import_shipment_trucking_costs
CREATE POLICY "Users can view trucking costs"
  ON import_shipment_trucking_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert trucking costs"
  ON import_shipment_trucking_costs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update trucking costs"
  ON import_shipment_trucking_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Users can delete trucking costs"
  ON import_shipment_trucking_costs FOR DELETE
  TO authenticated
  USING (true);

-- Function to calculate trucking totals
CREATE OR REPLACE FUNCTION calculate_trucking_totals(cost_id uuid)
RETURNS void AS $$
DECLARE
  cost_record RECORD;
  total_cost decimal(12, 2);
  margin_amt decimal(12, 2);
  final_charge decimal(12, 2);
BEGIN
  SELECT * INTO cost_record
  FROM import_shipment_trucking_costs
  WHERE id = cost_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  total_cost := COALESCE(cost_record.base_truck_cost_inr, 0) + 
                COALESCE(cost_record.toll_estimate, 0) + 
                COALESCE(cost_record.escort_special_handling, 0);
  
  margin_amt := (total_cost * COALESCE(cost_record.margin_percentage, 0)) / 100;
  
  final_charge := total_cost + margin_amt;
  
  IF cost_record.charge_currency != 'INR' AND cost_record.exchange_rate_used IS NOT NULL THEN
    final_charge := final_charge / cost_record.exchange_rate_used;
  END IF;
  
  UPDATE import_shipment_trucking_costs
  SET 
    total_trucking_cost = total_cost,
    margin_amount = margin_amt,
    final_charge_to_agent = final_charge,
    final_charge_currency = charge_currency
  WHERE id = cost_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update shipment trucking summary
CREATE OR REPLACE FUNCTION update_shipment_trucking_summary(shipment_id uuid)
RETURNS void AS $$
DECLARE
  total_cost decimal(12, 2);
  total_revenue decimal(12, 2);
  has_trucking boolean;
  is_billable boolean;
BEGIN
  SELECT 
    COALESCE(SUM(total_trucking_cost), 0),
    COALESCE(SUM(CASE WHEN is_billable THEN final_charge_to_agent ELSE 0 END), 0),
    COUNT(*) > 0,
    BOOL_OR(is_billable)
  INTO total_cost, total_revenue, has_trucking, is_billable
  FROM import_shipment_trucking_costs
  WHERE import_shipment_id = shipment_id;
  
  UPDATE import_shipments
  SET 
    has_additional_trucking = has_trucking,
    additional_trucking_cost = total_cost,
    additional_trucking_billable = COALESCE(is_billable, false),
    additional_trucking_revenue = total_revenue
  WHERE id = shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate totals on insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_trucking_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_trucking_totals(NEW.id);
  PERFORM update_shipment_trucking_summary(NEW.import_shipment_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trucking_costs_calculation ON import_shipment_trucking_costs;

CREATE TRIGGER trigger_trucking_costs_calculation
  AFTER INSERT OR UPDATE
  ON import_shipment_trucking_costs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_trucking_totals();

-- Trigger to update summary on delete
CREATE OR REPLACE FUNCTION trigger_trucking_delete_summary()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_shipment_trucking_summary(OLD.import_shipment_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_trucking_costs_delete ON import_shipment_trucking_costs;

CREATE TRIGGER trigger_trucking_costs_delete
  AFTER DELETE
  ON import_shipment_trucking_costs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_trucking_delete_summary();

-- Insert sample trucking vendors
INSERT INTO trucking_vendors (vendor_name, vendor_code, supported_truck_types, service_areas, is_active)
VALUES 
  ('Fast Track Logistics', 'FTL001', ARRAY['20ft Container', '32ft Open', '40ft Trailer'], ARRAY['North India', 'Central India'], true),
  ('Express Cargo Movers', 'ECM002', ARRAY['20ft Container', '24ft Closed', '32ft Open'], ARRAY['South India', 'West India'], true),
  ('Prime Transport Services', 'PTS003', ARRAY['All Types'], ARRAY['Pan India'], true),
  ('Regional Truckers', 'RT004', ARRAY['20ft Container', '24ft Closed'], ARRAY['East India', 'North East'], true),
  ('Metro Connect', 'MC005', ARRAY['20ft Container', '32ft Open', '40ft Trailer'], ARRAY['Metro to Non-Metro'], true)
ON CONFLICT (vendor_code) DO NOTHING;

-- Comments
COMMENT ON TABLE trucking_vendors IS 'Master list of trucking vendors for additional trucking services';
COMMENT ON TABLE import_shipment_trucking_costs IS 'Additional trucking costs for non-metro deliveries with billable toggle';

COMMENT ON COLUMN import_shipment_trucking_costs.base_truck_cost_inr IS 'Base cost of truck in INR (manual entry)';
COMMENT ON COLUMN import_shipment_trucking_costs.toll_estimate IS 'Estimated toll charges (manual entry)';
COMMENT ON COLUMN import_shipment_trucking_costs.escort_special_handling IS 'Cost for escort or special handling (manual entry)';
COMMENT ON COLUMN import_shipment_trucking_costs.total_trucking_cost IS 'Auto-calculated: base + toll + escort';
COMMENT ON COLUMN import_shipment_trucking_costs.margin_percentage IS 'Optional margin % to add';
COMMENT ON COLUMN import_shipment_trucking_costs.margin_amount IS 'Auto-calculated: total * margin%';
COMMENT ON COLUMN import_shipment_trucking_costs.is_billable IS 'If Yes: adds revenue line, If No: cost only';
COMMENT ON COLUMN import_shipment_trucking_costs.charge_currency IS 'Currency to charge agent (INR or USD)';
COMMENT ON COLUMN import_shipment_trucking_costs.final_charge_to_agent IS 'Auto-calculated: total + margin (in charge currency)';