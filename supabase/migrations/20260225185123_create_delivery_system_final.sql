/*
  # Delivery Execution System - Final
*/

-- Add delivery fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_planned_date') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_planned_date date; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_actual_date') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_actual_date timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_truck_id') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_truck_id uuid; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_special_equipment') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_special_equipment text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_instructions') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_instructions text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'pod_uploaded') THEN ALTER TABLE shipment_drafts ADD COLUMN pod_uploaded boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'signature_uploaded') THEN ALTER TABLE shipment_drafts ADD COLUMN signature_uploaded boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'delivery_photos_count') THEN ALTER TABLE shipment_drafts ADD COLUMN delivery_photos_count integer DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'non_metro_trucking_vendor') THEN ALTER TABLE shipment_drafts ADD COLUMN non_metro_trucking_vendor text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'final_trucking_cost') THEN ALTER TABLE shipment_drafts ADD COLUMN final_trucking_cost numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'storage_stopped_at') THEN ALTER TABLE shipment_drafts ADD COLUMN storage_stopped_at timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_drafts' AND column_name = 'final_storage_cost') THEN ALTER TABLE shipment_drafts ADD COLUMN final_storage_cost numeric; END IF;
END $$;

-- Update crew_members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crew_members' AND column_name = 'current_status') THEN ALTER TABLE crew_members ADD COLUMN current_status text DEFAULT 'available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crew_members' AND column_name = 'daily_rate') THEN ALTER TABLE crew_members ADD COLUMN daily_rate numeric; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'crew_members' AND column_name = 'updated_at') THEN ALTER TABLE crew_members ADD COLUMN updated_at timestamptz DEFAULT now(); END IF;
END $$;

-- Create trucks
CREATE TABLE IF NOT EXISTS trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text UNIQUE NOT NULL,
  truck_type text,
  capacity_cbm numeric,
  capacity_weight_kg numeric,
  current_status text DEFAULT 'available',
  owner text,
  vendor_name text,
  registration_number text,
  insurance_expiry date,
  fitness_expiry date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view trucks" ON trucks;
CREATE POLICY "Users can view trucks" ON trucks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage trucks" ON trucks;
CREATE POLICY "Users can manage trucks" ON trucks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create delivery_plans
CREATE TABLE IF NOT EXISTS delivery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  truck_id uuid REFERENCES trucks(id) ON DELETE SET NULL,
  planned_date date NOT NULL,
  planned_time_slot text,
  special_equipment text[],
  delivery_address text,
  contact_person text,
  contact_phone text,
  is_non_metro boolean DEFAULT false,
  trucking_vendor_name text,
  vendor_cost numeric,
  plan_status text DEFAULT 'planned',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view delivery plans" ON delivery_plans;
CREATE POLICY "Users can view delivery plans" ON delivery_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage delivery plans" ON delivery_plans;
CREATE POLICY "Users can manage delivery plans" ON delivery_plans FOR ALL TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Create delivery_crew_assignments
CREATE TABLE IF NOT EXISTS delivery_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_plan_id uuid REFERENCES delivery_plans(id) ON DELETE CASCADE,
  crew_member_id uuid REFERENCES crew_members(id) ON DELETE CASCADE,
  role_in_delivery text NOT NULL,
  assignment_status text DEFAULT 'assigned',
  attendance_marked boolean DEFAULT false,
  attendance_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_crew_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view crew assignments" ON delivery_crew_assignments;
CREATE POLICY "Users can view crew assignments" ON delivery_crew_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage crew assignments" ON delivery_crew_assignments;
CREATE POLICY "Users can manage crew assignments" ON delivery_crew_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create delivery_documents
CREATE TABLE IF NOT EXISTS delivery_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_url text NOT NULL,
  document_name text,
  description text,
  signed_by text,
  signature_date date,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view delivery docs" ON delivery_documents;
CREATE POLICY "Users can view delivery docs" ON delivery_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage delivery docs" ON delivery_documents;
CREATE POLICY "Users can manage delivery docs" ON delivery_documents FOR ALL TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

-- Triggers
DROP FUNCTION IF EXISTS stop_storage_billing() CASCADE;
CREATE FUNCTION stop_storage_billing() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_storage_cost json;
BEGIN
  IF NEW.delivery_actual_date IS NOT NULL AND (OLD.delivery_actual_date IS NULL OR OLD.delivery_actual_date IS DISTINCT FROM NEW.delivery_actual_date) THEN
    NEW.status := 'delivered';
    NEW.storage_stopped_at := NEW.delivery_actual_date;
    v_storage_cost := calculate_storage_cost_v2(NEW.id);
    IF (v_storage_cost->>'success')::boolean THEN NEW.final_storage_cost := (v_storage_cost->>'total_storage_cost')::numeric; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_stop_storage_billing ON shipment_drafts;
CREATE TRIGGER trigger_stop_storage_billing BEFORE UPDATE OF delivery_actual_date ON shipment_drafts FOR EACH ROW EXECUTE FUNCTION stop_storage_billing();

DROP FUNCTION IF EXISTS update_delivery_document_flags() CASCADE;
CREATE FUNCTION update_delivery_document_flags() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_photo_count integer;
BEGIN
  IF NEW.document_type = 'pod' THEN UPDATE shipment_drafts SET pod_uploaded = true WHERE id = NEW.shipment_draft_id; END IF;
  IF NEW.document_type = 'signature' THEN UPDATE shipment_drafts SET signature_uploaded = true WHERE id = NEW.shipment_draft_id; END IF;
  IF NEW.document_type IN ('delivery_photo', 'damage_photo') THEN
    SELECT COUNT(*) INTO v_photo_count FROM delivery_documents WHERE shipment_draft_id = NEW.shipment_draft_id AND document_type IN ('delivery_photo', 'damage_photo');
    UPDATE shipment_drafts SET delivery_photos_count = v_photo_count WHERE id = NEW.shipment_draft_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_update_document_flags ON delivery_documents;
CREATE TRIGGER trigger_update_document_flags AFTER INSERT ON delivery_documents FOR EACH ROW EXECUTE FUNCTION update_delivery_document_flags();

-- Sample data
INSERT INTO trucks (truck_number, truck_type, capacity_cbm, capacity_weight_kg, owner, current_status) SELECT 'TRK-001', '17ft', 25, 3000, 'owned', 'available' WHERE NOT EXISTS (SELECT 1 FROM trucks WHERE truck_number = 'TRK-001');
INSERT INTO trucks (truck_number, truck_type, capacity_cbm, capacity_weight_kg, owner, current_status) SELECT 'TRK-002', '19ft', 30, 4000, 'owned', 'available' WHERE NOT EXISTS (SELECT 1 FROM trucks WHERE truck_number = 'TRK-002');
INSERT INTO trucks (truck_number, truck_type, capacity_cbm, capacity_weight_kg, owner, current_status) SELECT 'TRK-003', '22ft', 40, 5000, 'leased', 'available' WHERE NOT EXISTS (SELECT 1 FROM trucks WHERE truck_number = 'TRK-003');

UPDATE crew_members SET current_status = 'available', daily_rate = COALESCE(hourly_rate * 8, 1000) WHERE current_status IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_plans_shipment ON delivery_plans(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_delivery_plans_truck ON delivery_plans(truck_id);
CREATE INDEX IF NOT EXISTS idx_delivery_plans_date ON delivery_plans(planned_date);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_plan ON delivery_crew_assignments(delivery_plan_id);
CREATE INDEX IF NOT EXISTS idx_delivery_docs_shipment ON delivery_documents(shipment_draft_id);
