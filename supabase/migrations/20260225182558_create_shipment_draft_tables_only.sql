/*
  # Create Shipment Draft Tables

  ## Overview
  Create tables for shipment draft entry system within containers.

  ## New Tables
  1. shipment_drafts - Main draft entries with auto-generated numbers
  2. shipment_draft_history - Audit trail for changes

  ## Features
  - Auto-generated draft numbers (DRF-YYYYMM-XXXX)
  - Link to containers, customers, and rate sheets
  - Calculate and store revenue with locked exchange rates
  - Track draft/confirmed/cancelled status
  - Full audit history

  ## Security
  - RLS enabled
  - Users can only access their own drafts
  - Confirmed drafts cannot be modified
*/

-- Create shipment_drafts table
CREATE TABLE IF NOT EXISTS shipment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  cbm numeric NOT NULL CHECK (cbm > 0),
  weight_kg numeric DEFAULT 0 CHECK (weight_kg >= 0),
  packages integer DEFAULT 1 CHECK (packages > 0),
  delivery_city text NOT NULL,
  delivery_state text,
  delivery_pincode text,
  rate_sheet_id uuid REFERENCES rate_sheets(id) ON DELETE SET NULL,
  rate_sheet_name text,
  applied_slab_rate numeric,
  applied_slab_name text,
  calculated_revenue_inr numeric DEFAULT 0,
  calculated_revenue_usd numeric DEFAULT 0,
  exchange_rate_inr_usd numeric,
  exchange_rate_locked_at timestamptz,
  commodity_description text,
  special_instructions text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  draft_number text UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE shipment_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shipment drafts"
  ON shipment_drafts FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create shipment drafts"
  ON shipment_drafts FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own draft shipments"
  ON shipment_drafts FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'draft')
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own draft shipments"
  ON shipment_drafts FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND status = 'draft');

-- Create shipment_draft_history table
CREATE TABLE IF NOT EXISTS shipment_draft_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  action text NOT NULL,
  changed_fields jsonb DEFAULT '{}',
  previous_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_draft_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own draft history"
  ON shipment_draft_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipment_drafts
      WHERE shipment_drafts.id = draft_id
      AND shipment_drafts.created_by = auth.uid()
    )
  );

-- Function to generate draft number
CREATE OR REPLACE FUNCTION generate_draft_number()
RETURNS text AS $$
DECLARE
  v_year_month text;
  v_sequence integer;
  v_draft_number text;
BEGIN
  v_year_month := to_char(now(), 'YYYYMM');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(draft_number FROM 'DRF-[0-9]{6}-([0-9]{4})') AS integer)
  ), 0) + 1
  INTO v_sequence
  FROM shipment_drafts
  WHERE draft_number LIKE 'DRF-' || v_year_month || '-%';
  
  v_draft_number := 'DRF-' || v_year_month || '-' || LPAD(v_sequence::text, 4, '0');
  
  RETURN v_draft_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate slab revenue
CREATE OR REPLACE FUNCTION calculate_slab_revenue(
  p_rate_sheet_id uuid,
  p_cbm numeric,
  p_delivery_city text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_rate_sheet record;
  v_slab record;
  v_rate numeric := 0;
  v_slab_name text := 'Standard Rate';
  v_revenue numeric := 0;
  v_currency text := 'INR';
BEGIN
  SELECT * INTO v_rate_sheet
  FROM rate_sheets
  WHERE id = p_rate_sheet_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Rate sheet not found'
    );
  END IF;
  
  v_currency := COALESCE(v_rate_sheet.currency, 'INR');
  
  FOR v_slab IN
    SELECT * FROM rate_sheet_slabs
    WHERE rate_sheet_id = p_rate_sheet_id
    AND charge_type = 'freight'
    AND p_cbm >= from_cbm
    AND (to_cbm IS NULL OR p_cbm <= to_cbm)
    ORDER BY from_cbm DESC
    LIMIT 1
  LOOP
    v_rate := v_slab.rate_per_cbm;
    v_slab_name := COALESCE(v_slab.description, 
      v_slab.from_cbm::text || '-' || COALESCE(v_slab.to_cbm::text, '∞') || ' CBM');
    v_revenue := p_cbm * v_rate;
    EXIT;
  END LOOP;
  
  IF v_rate = 0 THEN
    SELECT rate_per_cbm, description INTO v_rate, v_slab_name
    FROM rate_sheet_slabs
    WHERE rate_sheet_id = p_rate_sheet_id
    AND charge_type = 'freight'
    ORDER BY from_cbm DESC
    LIMIT 1;
    
    IF v_rate IS NOT NULL THEN
      v_revenue := p_cbm * v_rate;
    END IF;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'rate_per_cbm', COALESCE(v_rate, 0),
    'slab_name', v_slab_name,
    'calculated_revenue', COALESCE(v_revenue, 0),
    'cbm', p_cbm,
    'currency', v_currency
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get current exchange rate
CREATE OR REPLACE FUNCTION get_current_exchange_rate(
  p_from_currency text,
  p_to_currency text
)
RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    IF p_from_currency = 'INR' AND p_to_currency = 'USD' THEN
      v_rate := 0.012;
    ELSIF p_from_currency = 'USD' AND p_to_currency = 'INR' THEN
      v_rate := 83.0;
    ELSE
      v_rate := 1.0;
    END IF;
  END IF;
  
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to check available container space
CREATE OR REPLACE FUNCTION get_available_container_space(p_container_id uuid)
RETURNS json AS $$
DECLARE
  v_container record;
  v_used_cbm numeric := 0;
  v_available_cbm numeric;
BEGIN
  SELECT * INTO v_container
  FROM containers
  WHERE id = p_container_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Container not found');
  END IF;
  
  SELECT COALESCE(SUM(cbm), 0) INTO v_used_cbm
  FROM shipment_drafts
  WHERE container_id = p_container_id
    AND status IN ('draft', 'confirmed');
  
  v_available_cbm := v_container.estimated_total_cbm - v_used_cbm;
  
  RETURN json_build_object(
    'success', true,
    'container_id', p_container_id,
    'container_number', v_container.container_number,
    'total_cbm', v_container.estimated_total_cbm,
    'used_cbm', v_used_cbm,
    'available_cbm', v_available_cbm,
    'utilization_percentage', CASE 
      WHEN v_container.estimated_total_cbm > 0 THEN
        ROUND((v_used_cbm / v_container.estimated_total_cbm * 100)::numeric, 2)
      ELSE 0
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate draft number
CREATE OR REPLACE FUNCTION set_draft_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.draft_number IS NULL THEN
    NEW.draft_number := generate_draft_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_draft_number ON shipment_drafts;
CREATE TRIGGER trigger_set_draft_number
  BEFORE INSERT ON shipment_drafts
  FOR EACH ROW
  EXECUTE FUNCTION set_draft_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shipment_draft_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shipment_draft_timestamp ON shipment_drafts;
CREATE TRIGGER trigger_update_shipment_draft_timestamp
  BEFORE UPDATE ON shipment_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_draft_timestamp();

-- Trigger to log changes to draft history
CREATE OR REPLACE FUNCTION log_shipment_draft_changes()
RETURNS trigger AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    INSERT INTO shipment_draft_history (draft_id, action, new_values, changed_by)
    VALUES (NEW.id, v_action, to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status AND NEW.status = 'confirmed' THEN
      v_action := 'confirmed';
    ELSE
      v_action := 'updated';
    END IF;
    
    INSERT INTO shipment_draft_history (draft_id, action, previous_values, new_values, changed_by)
    VALUES (NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO shipment_draft_history (draft_id, action, previous_values, changed_by)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_shipment_draft_changes ON shipment_drafts;
CREATE TRIGGER trigger_log_shipment_draft_changes
  AFTER INSERT OR UPDATE OR DELETE ON shipment_drafts
  FOR EACH ROW
  EXECUTE FUNCTION log_shipment_draft_changes();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_container ON shipment_drafts(container_id);
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_client ON shipment_drafts(client_id);
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_status ON shipment_drafts(status);
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_draft_number ON shipment_drafts(draft_number);
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_created_at ON shipment_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_drafts_delivery_city ON shipment_drafts(delivery_city);
CREATE INDEX IF NOT EXISTS idx_draft_history_draft_id ON shipment_draft_history(draft_id, changed_at DESC);

-- Create view for shipment draft summary
CREATE OR REPLACE VIEW shipment_draft_summary AS
SELECT
  sd.id,
  sd.draft_number,
  sd.container_id,
  c.container_number,
  sd.client_id,
  sd.client_name,
  sd.client_email,
  sd.cbm,
  sd.weight_kg,
  sd.packages,
  sd.delivery_city,
  sd.delivery_state,
  sd.rate_sheet_id,
  sd.rate_sheet_name,
  sd.applied_slab_rate,
  sd.applied_slab_name,
  sd.calculated_revenue_inr,
  sd.calculated_revenue_usd,
  sd.exchange_rate_inr_usd,
  sd.commodity_description,
  sd.status,
  sd.created_at,
  sd.updated_at,
  sd.confirmed_at,
  c.eta_pod,
  c.pod_name,
  c.agent_name,
  c.origin_country,
  CASE
    WHEN sd.status = 'draft' THEN '🟡'
    WHEN sd.status = 'confirmed' THEN '🟢'
    WHEN sd.status = 'cancelled' THEN '🔴'
  END as status_icon
FROM shipment_drafts sd
LEFT JOIN containers c ON sd.container_id = c.id;
