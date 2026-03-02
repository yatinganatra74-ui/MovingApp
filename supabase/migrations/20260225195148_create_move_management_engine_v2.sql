/*
  # Move Management Engine - The Central Hub (v2)

  Creates the moves table and related tables without FK references to tables that don't exist yet.
  Those references can be added later.
*/

-- Create moves table (MASTER TABLE - CENTRAL HUB)
CREATE TABLE IF NOT EXISTS moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  
  move_number text NOT NULL,
  reference_number text,
  
  move_type text NOT NULL CHECK (move_type IN ('domestic', 'international_inbound', 'international_outbound')),
  service_type text CHECK (service_type IN ('door_to_door', 'door_to_port', 'port_to_door', 'port_to_port')),
  transport_mode text CHECK (transport_mode IN ('ROAD', 'SEA', 'AIR', 'RAIL', 'MULTI_MODE')),
  
  customer_id uuid,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_reference text,
  
  origin_address_line1 text,
  origin_address_line2 text,
  origin_city text NOT NULL,
  origin_state text,
  origin_country text DEFAULT 'India',
  origin_postal_code text,
  origin_location_id uuid REFERENCES locations(id),
  
  destination_address_line1 text,
  destination_address_line2 text,
  destination_city text NOT NULL,
  destination_state text,
  destination_country text,
  destination_postal_code text,
  destination_location_id uuid REFERENCES locations(id),
  
  estimated_volume_cbm decimal(10,2),
  actual_volume_cbm decimal(10,2),
  estimated_weight_kg decimal(10,2),
  actual_weight_kg decimal(10,2),
  chargeable_weight_kg decimal(10,2),
  number_of_packages integer,
  
  booking_date date DEFAULT CURRENT_DATE,
  preferred_packing_date date,
  actual_packing_date date,
  preferred_delivery_date date,
  actual_delivery_date date,
  estimated_transit_days integer,
  
  requires_packing boolean DEFAULT true,
  requires_unpacking boolean DEFAULT false,
  requires_storage boolean DEFAULT false,
  requires_insurance boolean DEFAULT false,
  requires_customs boolean DEFAULT false,
  
  storage_location text,
  storage_free_days integer DEFAULT 7,
  storage_start_date date,
  storage_end_date date,
  storage_charges_applied boolean DEFAULT false,
  
  container_id uuid REFERENCES groupage_containers(id),
  container_number text,
  bl_number text,
  awb_number text,
  freight_booked_at timestamptz,
  freight_departed_at timestamptz,
  freight_arrived_at timestamptz,
  
  base_currency text DEFAULT 'INR',
  exchange_rate_usd_inr decimal(10,4),
  exchange_rate_locked_at timestamptz,
  
  total_revenue_inr decimal(12,2) DEFAULT 0,
  total_cost_inr decimal(12,2) DEFAULT 0,
  gross_profit_inr decimal(12,2) DEFAULT 0,
  profit_margin_percent decimal(5,2) DEFAULT 0,
  
  quoted_amount decimal(12,2),
  invoiced_amount decimal(12,2),
  paid_amount decimal(12,2) DEFAULT 0,
  outstanding_amount decimal(12,2) DEFAULT 0,
  
  status text DEFAULT 'draft' CHECK (status IN (
    'draft', 'confirmed', 'survey_scheduled', 'survey_completed',
    'packing_scheduled', 'packing_in_progress', 'packing_complete',
    'freight_booked', 'in_transit', 'customs_clearance', 
    'warehouse_received', 'delivery_scheduled', 'out_for_delivery',
    'delivered', 'closed', 'cancelled'
  )),
  
  assigned_to uuid,
  packer_team_lead uuid,
  delivery_team_lead uuid,
  
  quote_id uuid,
  survey_id uuid,
  lead_id uuid,
  
  customer_feedback_rating integer CHECK (customer_feedback_rating BETWEEN 1 AND 5),
  customer_feedback_comments text,
  internal_quality_rating integer CHECK (internal_quality_rating BETWEEN 1 AND 5),
  
  is_priority boolean DEFAULT false,
  is_high_value boolean DEFAULT false,
  has_fragile_items boolean DEFAULT false,
  has_customs_issues boolean DEFAULT false,
  profit_margin_warning boolean DEFAULT false,
  
  packing_instructions text,
  delivery_instructions text,
  internal_notes text,
  customer_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  confirmed_at timestamptz,
  confirmed_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  
  UNIQUE(company_id, move_number)
);

-- Create move_milestones table
CREATE TABLE IF NOT EXISTS move_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  milestone_type text NOT NULL CHECK (milestone_type IN (
    'booking_confirmed', 'survey_scheduled', 'survey_completed',
    'packing_scheduled', 'packing_started', 'packing_completed',
    'loading_started', 'loading_completed', 
    'freight_booked', 'departed_origin', 'in_transit',
    'arrived_port', 'customs_filed', 'customs_cleared',
    'warehouse_received', 'delivery_scheduled', 'out_for_delivery',
    'delivered', 'invoice_sent', 'payment_received', 'closed'
  )),
  
  milestone_name text NOT NULL,
  milestone_description text,
  
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  
  planned_date date,
  actual_date date,
  delay_days integer,
  
  sequence_order integer,
  is_mandatory boolean DEFAULT true,
  can_skip boolean DEFAULT false,
  
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create move_timeline table
CREATE TABLE IF NOT EXISTS move_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  event_type text NOT NULL CHECK (event_type IN (
    'status_change', 'document_uploaded', 'cost_added', 'revenue_added',
    'crew_assigned', 'note_added', 'customer_communication', 'alert_triggered',
    'milestone_completed', 'delay_reported', 'issue_reported', 'issue_resolved'
  )),
  
  event_title text NOT NULL,
  event_description text,
  
  old_value text,
  new_value text,
  
  performed_by uuid,
  performed_by_name text,
  
  is_visible_to_customer boolean DEFAULT false,
  
  event_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create move_documents table
CREATE TABLE IF NOT EXISTS move_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  document_type text NOT NULL CHECK (document_type IN (
    'quote', 'invoice', 'receipt', 'packing_list', 'inventory_list',
    'bill_of_lading', 'airway_bill', 'customs_declaration', 'insurance_certificate',
    'delivery_receipt', 'survey_report', 'photo', 'contract', 'other'
  )),
  
  document_name text NOT NULL,
  document_number text,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size_kb integer,
  mime_type text,
  
  is_customer_visible boolean DEFAULT false,
  is_official_document boolean DEFAULT false,
  requires_signature boolean DEFAULT false,
  is_signed boolean DEFAULT false,
  
  uploaded_by uuid,
  uploaded_at timestamptz DEFAULT now(),
  description text,
  tags text[]
);

-- Create move_costs table
CREATE TABLE IF NOT EXISTS move_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  cost_category text NOT NULL CHECK (cost_category IN (
    'freight_sea', 'freight_air', 'origin_handling', 'destination_handling',
    'customs_clearance', 'storage', 'packing_materials', 'crew_labor',
    'trucking_origin', 'trucking_destination', 'insurance', 'documentation',
    'port_charges', 'demurrage', 'detention', 'fumigation', 'other'
  )),
  
  cost_description text NOT NULL,
  
  agent_id uuid,
  agent_name text,
  
  quantity decimal(10,2) DEFAULT 1,
  unit_cost decimal(10,2) NOT NULL,
  total_cost decimal(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  currency text DEFAULT 'INR',
  exchange_rate decimal(10,4) DEFAULT 1,
  cost_in_inr decimal(12,2),
  
  is_estimated boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  is_paid boolean DEFAULT false,
  payment_date date,
  
  supplier_invoice_number text,
  supplier_invoice_date date,
  
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create move_revenue table
CREATE TABLE IF NOT EXISTS move_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES companies(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  
  revenue_category text NOT NULL CHECK (revenue_category IN (
    'freight_charges', 'packing_charges', 'loading_charges', 'unloading_charges',
    'storage_charges', 'insurance_premium', 'customs_brokerage',
    'documentation_fee', 'handling_charges', 'delivery_charges', 'miscellaneous', 'other'
  )),
  
  revenue_description text NOT NULL,
  
  quantity decimal(10,2) DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  subtotal decimal(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  is_taxable boolean DEFAULT true,
  tax_percentage decimal(5,2) DEFAULT 18,
  tax_amount decimal(12,2),
  total_amount decimal(12,2),
  
  currency text DEFAULT 'INR',
  exchange_rate decimal(10,4) DEFAULT 1,
  amount_in_inr decimal(12,2),
  
  is_invoiced boolean DEFAULT false,
  invoice_number text,
  invoice_date date,
  
  is_paid boolean DEFAULT false,
  payment_date date,
  payment_method text,
  
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moves_company ON moves(company_id, status);
CREATE INDEX IF NOT EXISTS idx_moves_customer ON moves(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_moves_dates ON moves(company_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_moves_assigned ON moves(assigned_to);
CREATE INDEX IF NOT EXISTS idx_move_milestones_move ON move_milestones(move_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_move_timeline_move ON move_timeline(move_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_move_documents_move ON move_documents(move_id, document_type);
CREATE INDEX IF NOT EXISTS idx_move_costs_move ON move_costs(move_id, cost_category);
CREATE INDEX IF NOT EXISTS idx_move_revenue_move ON move_revenue(move_id, revenue_category);

-- Enable RLS
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_revenue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company users can access moves" ON moves FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Company users can access milestones" ON move_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Company users can access timeline" ON move_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Company users can access documents" ON move_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Company users can access costs" ON move_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Company users can access revenue" ON move_revenue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to update move financials
CREATE OR REPLACE FUNCTION update_move_financials()
RETURNS TRIGGER AS $$
DECLARE
  v_move_id uuid;
  v_total_revenue decimal;
  v_total_cost decimal;
  v_profit decimal;
  v_margin decimal;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_move_id := OLD.move_id;
  ELSE
    v_move_id := NEW.move_id;
  END IF;
  
  SELECT COALESCE(SUM(amount_in_inr), 0) INTO v_total_revenue FROM move_revenue WHERE move_id = v_move_id;
  SELECT COALESCE(SUM(cost_in_inr), 0) INTO v_total_cost FROM move_costs WHERE move_id = v_move_id;
  
  v_profit := v_total_revenue - v_total_cost;
  v_margin := CASE WHEN v_total_revenue > 0 THEN (v_profit / v_total_revenue) * 100 ELSE 0 END;
  
  UPDATE moves
  SET
    total_revenue_inr = v_total_revenue,
    total_cost_inr = v_total_cost,
    gross_profit_inr = v_profit,
    profit_margin_percent = v_margin,
    profit_margin_warning = (v_margin < 15),
    updated_at = now()
  WHERE id = v_move_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_move_financials_revenue ON move_revenue;
CREATE TRIGGER trg_update_move_financials_revenue
  AFTER INSERT OR UPDATE OR DELETE ON move_revenue
  FOR EACH ROW EXECUTE FUNCTION update_move_financials();

DROP TRIGGER IF EXISTS trg_update_move_financials_cost ON move_costs;
CREATE TRIGGER trg_update_move_financials_cost
  AFTER INSERT OR UPDATE OR DELETE ON move_costs
  FOR EACH ROW EXECUTE FUNCTION update_move_financials();
