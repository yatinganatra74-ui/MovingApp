/*
  # Complete Warehouse System (Final Clean Version)
*/

-- Update shipment_drafts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'actual_arrival_date') THEN ALTER TABLE shipment_drafts ADD COLUMN actual_arrival_date date; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'clearance_start_date') THEN ALTER TABLE shipment_drafts ADD COLUMN clearance_start_date date; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'clearance_completed_date') THEN ALTER TABLE shipment_drafts ADD COLUMN clearance_completed_date date; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'warehouse_entry_date') THEN ALTER TABLE shipment_drafts ADD COLUMN warehouse_entry_date timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'warehouse_location') THEN ALTER TABLE shipment_drafts ADD COLUMN warehouse_location text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'warehouse_rack') THEN ALTER TABLE shipment_drafts ADD COLUMN warehouse_rack text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'free_storage_days') THEN ALTER TABLE shipment_drafts ADD COLUMN free_storage_days integer DEFAULT 7; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'condition_notes') THEN ALTER TABLE shipment_drafts ADD COLUMN condition_notes text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'photos_uploaded') THEN ALTER TABLE shipment_drafts ADD COLUMN photos_uploaded boolean DEFAULT false; END IF;
END $$;

-- Update warehouse_locations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'warehouse_locations' AND column_name = 'capacity_cbm') THEN ALTER TABLE warehouse_locations ADD COLUMN capacity_cbm numeric DEFAULT 50; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'warehouse_locations' AND column_name = 'current_utilization_cbm') THEN ALTER TABLE warehouse_locations ADD COLUMN current_utilization_cbm numeric DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'warehouse_locations' AND column_name = 'is_available') THEN ALTER TABLE warehouse_locations ADD COLUMN is_available boolean DEFAULT true; END IF;
END $$;

-- Create tables
CREATE TABLE IF NOT EXISTS customs_clearance_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  cost_type text NOT NULL,
  cost_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'INR',
  exchange_rate numeric DEFAULT 83.0,
  amount_inr numeric,
  is_duty_recoverable boolean DEFAULT false,
  is_pass_through boolean DEFAULT false,
  vendor_name text,
  invoice_number text,
  payment_status text DEFAULT 'pending',
  payment_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  total_days integer,
  free_days_used integer DEFAULT 0,
  chargeable_days integer,
  rate_per_day_per_cbm numeric,
  total_storage_cost numeric,
  billing_status text DEFAULT 'draft',
  invoice_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS condition_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  photo_type text,
  photo_url text NOT NULL,
  photo_description text,
  taken_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE customs_clearance_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view customs costs" ON customs_clearance_costs;
CREATE POLICY "Users can view customs costs" ON customs_clearance_costs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage customs costs" ON customs_clearance_costs;
CREATE POLICY "Users can manage customs costs" ON customs_clearance_costs FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

ALTER TABLE storage_billing_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view storage records" ON storage_billing_records;
CREATE POLICY "Users can view storage records" ON storage_billing_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage storage records" ON storage_billing_records;
CREATE POLICY "Users can manage storage records" ON storage_billing_records FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

ALTER TABLE condition_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view photos" ON condition_photos;
CREATE POLICY "Users can view photos" ON condition_photos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage photos" ON condition_photos;
CREATE POLICY "Users can manage photos" ON condition_photos FOR ALL TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

-- Functions
DROP FUNCTION IF EXISTS calculate_storage_days_v2(uuid);
CREATE FUNCTION calculate_storage_days_v2(p_shipment_draft_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_shipment record; v_entry_date date; v_total_days integer; v_free_days integer; v_chargeable_days integer;
BEGIN
  SELECT * INTO v_shipment FROM shipment_drafts WHERE id = p_shipment_draft_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false); END IF;
  v_entry_date := COALESCE(v_shipment.warehouse_entry_date::date, v_shipment.clearance_completed_date, v_shipment.actual_arrival_date);
  IF v_entry_date IS NULL THEN RETURN json_build_object('success', false); END IF;
  v_total_days := CURRENT_DATE - v_entry_date;
  v_free_days := COALESCE(v_shipment.free_storage_days, 7);
  v_chargeable_days := GREATEST(0, v_total_days - v_free_days);
  RETURN json_build_object('success', true, 'total_days', v_total_days, 'free_days', v_free_days, 'chargeable_days', v_chargeable_days, 'free_days_remaining', GREATEST(0, v_free_days - v_total_days));
END; $$;

DROP FUNCTION IF EXISTS get_storage_rate_v2(integer);
CREATE FUNCTION get_storage_rate_v2(p_days integer) RETURNS numeric LANGUAGE plpgsql AS $$
BEGIN IF p_days <= 15 THEN RETURN 0; ELSIF p_days <= 30 THEN RETURN 5; ELSIF p_days <= 60 THEN RETURN 7; ELSE RETURN 10; END IF; END; $$;

DROP FUNCTION IF EXISTS calculate_storage_cost_v2(uuid);
CREATE FUNCTION calculate_storage_cost_v2(p_shipment_draft_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_shipment record; v_storage_days json; v_chargeable_days integer; v_rate_per_day numeric; v_total_cost numeric;
BEGIN
  SELECT * INTO v_shipment FROM shipment_drafts WHERE id = p_shipment_draft_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false); END IF;
  v_storage_days := calculate_storage_days_v2(p_shipment_draft_id);
  IF NOT (v_storage_days->>'success')::boolean THEN RETURN v_storage_days; END IF;
  v_chargeable_days := (v_storage_days->>'chargeable_days')::integer;
  IF v_chargeable_days <= 0 THEN RETURN json_build_object('success', true, 'chargeable_days', 0, 'total_storage_cost', 0); END IF;
  v_rate_per_day := get_storage_rate_v2(v_chargeable_days);
  v_total_cost := v_chargeable_days * v_rate_per_day * v_shipment.cbm;
  RETURN json_build_object('success', true, 'total_days', (v_storage_days->>'total_days')::integer, 'chargeable_days', v_chargeable_days, 'rate_per_day_per_cbm', v_rate_per_day, 'total_storage_cost', v_total_cost);
END; $$;

DROP FUNCTION IF EXISTS update_clearance_status_v2() CASCADE;
CREATE FUNCTION update_clearance_status_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.clearance_completed_date IS NOT NULL AND (OLD IS NULL OR OLD.clearance_completed_date IS NULL OR OLD.clearance_completed_date != NEW.clearance_completed_date) THEN NEW.status := 'cleared'; END IF; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trigger_clearance_status_v2 ON shipment_drafts;
CREATE TRIGGER trigger_clearance_status_v2 BEFORE UPDATE OF clearance_completed_date ON shipment_drafts FOR EACH ROW EXECUTE FUNCTION update_clearance_status_v2();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customs_costs_shipment ON customs_clearance_costs(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_storage_records_shipment ON storage_billing_records(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_condition_photos_shipment ON condition_photos(shipment_draft_id);

-- View
CREATE OR REPLACE VIEW warehouse_inventory_v2 AS
SELECT sd.id, sd.draft_number, sd.client_name, sd.cbm, sd.warehouse_entry_date, sd.warehouse_location, sd.warehouse_rack, sd.free_storage_days, sd.condition_notes, sd.photos_uploaded, sd.status,
  COALESCE((calculate_storage_days_v2(sd.id)->>'total_days')::integer, 0) as days_in_storage,
  COALESCE((calculate_storage_days_v2(sd.id)->>'chargeable_days')::integer, 0) as chargeable_days,
  COALESCE((calculate_storage_days_v2(sd.id)->>'free_days_remaining')::integer, 0) as free_days_remaining,
  COALESCE((calculate_storage_cost_v2(sd.id)->>'total_storage_cost')::numeric, 0) as current_storage_cost
FROM shipment_drafts sd WHERE sd.warehouse_entry_date IS NOT NULL;
