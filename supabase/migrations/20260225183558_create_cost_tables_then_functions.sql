/*
  # Create Cost Tables and Functions

  ## Step 1: Create Tables
  ## Step 2: Add Columns to Existing Tables
  ## Step 3: Create Functions
  ## Step 4: Create Triggers
*/

-- Step 1: Create Tables

CREATE TABLE IF NOT EXISTS fixed_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_name text NOT NULL,
  charge_type text NOT NULL CHECK (charge_type IN ('documentation', 'insurance', 'handling', 'clearance', 'other')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'INR',
  applies_to text DEFAULT 'all' CHECK (applies_to IN ('all', 'metro', 'non-metro')),
  is_percentage boolean DEFAULT false,
  percentage_of text,
  is_active boolean DEFAULT true,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trucking_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  cost_amount numeric NOT NULL CHECK (cost_amount >= 0),
  is_billable boolean DEFAULT false,
  billable_amount numeric DEFAULT 0,
  distance_km numeric,
  vehicle_type text,
  driver_name text,
  vehicle_number text,
  pickup_date date,
  delivery_date date,
  notes text,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'in_transit', 'delivered', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Add columns to existing tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_zones' AND column_name = 'zone_type') THEN
    ALTER TABLE delivery_zones ADD COLUMN zone_type text DEFAULT 'non-metro' CHECK (zone_type IN ('metro', 'non-metro'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_zones' AND column_name = 'requires_trucking') THEN
    ALTER TABLE delivery_zones ADD COLUMN requires_trucking boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'freight_revenue') THEN
    ALTER TABLE shipment_costs ADD COLUMN freight_revenue numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'fixed_charges_total') THEN
    ALTER TABLE shipment_costs ADD COLUMN fixed_charges_total numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'fixed_charges_detail') THEN
    ALTER TABLE shipment_costs ADD COLUMN fixed_charges_detail jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'trucking_revenue') THEN
    ALTER TABLE shipment_costs ADD COLUMN trucking_revenue numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'total_revenue_inr') THEN
    ALTER TABLE shipment_costs ADD COLUMN total_revenue_inr numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'total_revenue_usd') THEN
    ALTER TABLE shipment_costs ADD COLUMN total_revenue_usd numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'container_cost_share') THEN
    ALTER TABLE shipment_costs ADD COLUMN container_cost_share numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'trucking_cost') THEN
    ALTER TABLE shipment_costs ADD COLUMN trucking_cost numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'other_costs') THEN
    ALTER TABLE shipment_costs ADD COLUMN other_costs numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'total_cost_inr') THEN
    ALTER TABLE shipment_costs ADD COLUMN total_cost_inr numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'gross_profit_inr') THEN
    ALTER TABLE shipment_costs ADD COLUMN gross_profit_inr numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'gross_profit_usd') THEN
    ALTER TABLE shipment_costs ADD COLUMN gross_profit_usd numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'profit_margin_percentage') THEN
    ALTER TABLE shipment_costs ADD COLUMN profit_margin_percentage numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'delivery_zone_type') THEN
    ALTER TABLE shipment_costs ADD COLUMN delivery_zone_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'requires_trucking') THEN
    ALTER TABLE shipment_costs ADD COLUMN requires_trucking boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'is_cost_allocated') THEN
    ALTER TABLE shipment_costs ADD COLUMN is_cost_allocated boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_costs' AND column_name = 'cost_allocated_at') THEN
    ALTER TABLE shipment_costs ADD COLUMN cost_allocated_at timestamptz;
  END IF;
END $$;

-- Step 3: Create Functions

DROP FUNCTION IF EXISTS detect_delivery_zone(text, text);
CREATE FUNCTION detect_delivery_zone(p_city text, p_pincode text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_zone record;
BEGIN
  SELECT * INTO v_zone FROM delivery_zones WHERE LOWER(city_name) = LOWER(p_city) LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('zone_type', COALESCE(v_zone.zone_type, 'non-metro'), 'requires_trucking', COALESCE(v_zone.requires_trucking, true));
  END IF;
  RETURN json_build_object('zone_type', 'non-metro', 'requires_trucking', true);
END;
$$;

DROP FUNCTION IF EXISTS calculate_fixed_charges(numeric, text);
CREATE FUNCTION calculate_fixed_charges(p_freight_revenue numeric, p_zone_type text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_charge record;
  v_total numeric := 0;
  v_charges jsonb := '[]'::jsonb;
  v_charge_amount numeric;
BEGIN
  FOR v_charge IN SELECT * FROM fixed_charges WHERE is_active = true AND (applies_to = 'all' OR applies_to = p_zone_type) ORDER BY charge_name
  LOOP
    IF v_charge.is_percentage THEN
      v_charge_amount := p_freight_revenue * (v_charge.amount / 100);
    ELSE
      v_charge_amount := v_charge.amount;
    END IF;
    v_total := v_total + v_charge_amount;
    v_charges := v_charges || jsonb_build_object('charge_name', v_charge.charge_name, 'amount', v_charge_amount);
  END LOOP;
  RETURN json_build_object('total', v_total, 'charges', v_charges);
END;
$$;

DROP FUNCTION IF EXISTS calculate_shipment_profit(uuid);
CREATE FUNCTION calculate_shipment_profit(p_shipment_draft_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_draft record;
  v_zone_info json;
  v_fixed_charges json;
  v_trucking record;
  v_container_share numeric := 0;
  v_freight_revenue numeric;
  v_fixed_charges_total numeric;
  v_trucking_revenue numeric := 0;
  v_trucking_cost numeric := 0;
  v_total_revenue numeric;
  v_total_cost numeric;
  v_gross_profit numeric;
  v_profit_margin numeric;
  v_exchange_rate numeric;
BEGIN
  SELECT * INTO v_draft FROM shipment_drafts WHERE id = p_shipment_draft_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false); END IF;
  
  v_freight_revenue := COALESCE(v_draft.calculated_revenue_inr, 0);
  v_exchange_rate := COALESCE(v_draft.exchange_rate_inr_usd, 0.012);
  v_zone_info := detect_delivery_zone(v_draft.delivery_city, v_draft.delivery_pincode);
  v_fixed_charges := calculate_fixed_charges(v_freight_revenue, v_zone_info->>'zone_type');
  v_fixed_charges_total := (v_fixed_charges->>'total')::numeric;
  
  SELECT * INTO v_trucking FROM trucking_costs WHERE shipment_draft_id = p_shipment_draft_id LIMIT 1;
  IF FOUND THEN
    v_trucking_cost := v_trucking.cost_amount;
    IF v_trucking.is_billable THEN v_trucking_revenue := v_trucking.billable_amount; END IF;
  END IF;
  
  SELECT container_cost_share INTO v_container_share FROM shipment_costs WHERE shipment_draft_id = p_shipment_draft_id;
  v_container_share := COALESCE(v_container_share, 0);
  v_total_revenue := v_freight_revenue + v_fixed_charges_total + v_trucking_revenue;
  v_total_cost := v_container_share + v_trucking_cost;
  v_gross_profit := v_total_revenue - v_total_cost;
  IF v_total_revenue > 0 THEN v_profit_margin := (v_gross_profit / v_total_revenue * 100); ELSE v_profit_margin := 0; END IF;
  
  INSERT INTO shipment_costs (shipment_draft_id, freight_revenue, fixed_charges_total, fixed_charges_detail, trucking_revenue, total_revenue_inr, total_revenue_usd, container_cost_share, trucking_cost, total_cost_inr, gross_profit_inr, gross_profit_usd, profit_margin_percentage, delivery_zone_type, requires_trucking, created_by)
  VALUES (p_shipment_draft_id, v_freight_revenue, v_fixed_charges_total, v_fixed_charges->'charges', v_trucking_revenue, v_total_revenue, v_total_revenue * v_exchange_rate, v_container_share, v_trucking_cost, v_total_cost, v_gross_profit, v_gross_profit * v_exchange_rate, v_profit_margin, v_zone_info->>'zone_type', (v_zone_info->>'requires_trucking')::boolean, auth.uid())
  ON CONFLICT (shipment_draft_id) DO UPDATE SET freight_revenue = EXCLUDED.freight_revenue, fixed_charges_total = EXCLUDED.fixed_charges_total, fixed_charges_detail = EXCLUDED.fixed_charges_detail, trucking_revenue = EXCLUDED.trucking_revenue, total_revenue_inr = EXCLUDED.total_revenue_inr, total_revenue_usd = EXCLUDED.total_revenue_usd, trucking_cost = EXCLUDED.trucking_cost, total_cost_inr = EXCLUDED.total_cost_inr, gross_profit_inr = EXCLUDED.gross_profit_inr, gross_profit_usd = EXCLUDED.gross_profit_usd, profit_margin_percentage = EXCLUDED.profit_margin_percentage, delivery_zone_type = EXCLUDED.delivery_zone_type, requires_trucking = EXCLUDED.requires_trucking, updated_at = now();
  
  RETURN json_build_object('success', true, 'profit', v_gross_profit);
END;
$$;

DROP FUNCTION IF EXISTS allocate_container_costs(uuid);
CREATE FUNCTION allocate_container_costs(p_container_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_cbm numeric := 0;
  v_cost_per_cbm numeric := 0;
  v_draft record;
  v_count integer := 0;
BEGIN
  SELECT SUM(actual_cost) INTO v_total_cost FROM container_costs WHERE container_id = p_container_id;
  v_total_cost := COALESCE(v_total_cost, 0);
  SELECT SUM(cbm) INTO v_total_cbm FROM shipment_drafts WHERE container_id = p_container_id AND status IN ('draft', 'confirmed');
  
  IF v_total_cbm IS NULL OR v_total_cbm <= 0 THEN RETURN json_build_object('success', false); END IF;
  
  v_cost_per_cbm := v_total_cost / v_total_cbm;
  
  FOR v_draft IN SELECT id, cbm FROM shipment_drafts WHERE container_id = p_container_id AND status IN ('draft', 'confirmed')
  LOOP
    UPDATE shipment_costs SET container_cost_share = v_draft.cbm * v_cost_per_cbm, is_cost_allocated = true, cost_allocated_at = now() WHERE shipment_draft_id = v_draft.id;
    IF NOT FOUND THEN INSERT INTO shipment_costs (shipment_draft_id, container_cost_share, is_cost_allocated, cost_allocated_at, created_by) VALUES (v_draft.id, v_draft.cbm * v_cost_per_cbm, true, now(), auth.uid()); END IF;
    PERFORM calculate_shipment_profit(v_draft.id);
    v_count := v_count + 1;
  END LOOP;
  
  UPDATE containers SET status = 'landed' WHERE id = p_container_id;
  RETURN json_build_object('success', true, 'count', v_count, 'cost_per_cbm', v_cost_per_cbm);
END;
$$;

-- Step 4: Create Trigger Functions and Triggers

DROP FUNCTION IF EXISTS trigger_calculate_shipment_costs();
CREATE FUNCTION trigger_calculate_shipment_costs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM calculate_shipment_profit(NEW.id);
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS trigger_recalculate_on_trucking();
CREATE FUNCTION trigger_recalculate_on_trucking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM calculate_shipment_profit(NEW.shipment_draft_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_calculate_costs ON shipment_drafts;
CREATE TRIGGER trigger_auto_calculate_costs AFTER INSERT OR UPDATE OF calculated_revenue_inr, delivery_city ON shipment_drafts FOR EACH ROW EXECUTE FUNCTION trigger_calculate_shipment_costs();

DROP TRIGGER IF EXISTS trigger_trucking_profit_update ON trucking_costs;
CREATE TRIGGER trigger_trucking_profit_update AFTER INSERT OR UPDATE ON trucking_costs FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_on_trucking();

-- Insert default data
INSERT INTO fixed_charges (charge_name, charge_type, amount, applies_to, is_percentage, description) SELECT 'Documentation Fee', 'documentation', 500, 'all', false, 'Standard docs' WHERE NOT EXISTS (SELECT 1 FROM fixed_charges WHERE charge_name = 'Documentation Fee');
INSERT INTO fixed_charges (charge_name, charge_type, amount, applies_to, is_percentage, description) SELECT 'Handling', 'handling', 1000, 'all', false, 'Cargo handling' WHERE NOT EXISTS (SELECT 1 FROM fixed_charges WHERE charge_name = 'Handling');
INSERT INTO fixed_charges (charge_name, charge_type, amount, applies_to, is_percentage, description) SELECT 'Insurance', 'insurance', 2, 'all', true, '2% insurance' WHERE NOT EXISTS (SELECT 1 FROM fixed_charges WHERE charge_name = 'Insurance');
INSERT INTO fixed_charges (charge_name, charge_type, amount, applies_to, is_percentage, description) SELECT 'Non-Metro Surcharge', 'handling', 1500, 'non-metro', false, 'Non-metro charge' WHERE NOT EXISTS (SELECT 1 FROM fixed_charges WHERE charge_name = 'Non-Metro Surcharge');

UPDATE delivery_zones SET zone_type = 'metro', requires_trucking = false WHERE zone_type IS NULL AND city_name IN ('Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune');
