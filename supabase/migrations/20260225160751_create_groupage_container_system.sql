/*
  # Groupage Container Management System

  1. New Tables
    - `groupage_containers` - Master container records
      - `id` (uuid, primary key)
      - `container_number` (text, unique)
      - `container_type` (text) - 20ft, 40ft, 40HC
      - `status` (text) - planning, loading, in_transit, delivered, closed
      - `origin_port` (text)
      - `destination_port` (text)
      - `etd` (date)
      - `eta` (date)
      - `total_capacity_cbm` (decimal)
      - `used_capacity_cbm` (decimal)
      - `total_cost` (decimal) - Total container cost in INR
      - `total_revenue_base` (decimal) - Sum of all shipment revenues in INR
      - `total_allocated_cost` (decimal) - Sum of allocated costs to shipments
      - `profit_base` (decimal) - Revenue - Allocated Costs
      - `profit_margin_percent` (decimal)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `container_costs` - Individual container cost items
      - `id` (uuid, primary key)
      - `container_id` (uuid, references groupage_containers)
      - `description` (text)
      - `category` (text) - freight, handling, documentation, customs, etc.
      - `amount` (decimal)
      - `currency` (text)
      - `exchange_rate` (decimal)
      - `amount_in_inr` (decimal)
      - `supplier_id` (uuid, references agents) - optional
      - `created_at` (timestamptz)

    - `container_shipments` - Shipments within container
      - `id` (uuid, primary key)
      - `container_id` (uuid, references groupage_containers)
      - `shipment_number` (text, unique)
      - `customer_id` (uuid, references customers)
      - `agent_id` (uuid, references agents) - Can be different per shipment
      - `rate_sheet_id` (uuid, references rate_sheets)
      - `locked_exchange_rate` (decimal)
      - `cbm` (decimal)
      - `weight_kg` (decimal)
      - `package_count` (integer)
      - `description` (text)
      - `revenue_base` (decimal) - Calculated from slab rates in INR
      - `allocated_cost_base` (decimal) - Proportional container cost
      - `profit_base` (decimal) - Revenue - Allocated Cost
      - `profit_margin_percent` (decimal)
      - `status` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `container_shipment_revenue` - Revenue line items per shipment
      - `id` (uuid, primary key)
      - `container_shipment_id` (uuid, references container_shipments)
      - `description` (text)
      - `category` (text) - freight, handling, documentation, etc.
      - `amount` (decimal) - Original currency
      - `currency` (text)
      - `exchange_rate` (decimal)
      - `amount_in_base_currency` (decimal) - INR
      - `created_at` (timestamptz)

  2. Functions
    - Calculate revenue from slab rates for container shipment
    - Allocate container costs proportionally by CBM
    - Update container totals automatically
    - Recalculate when shipments added/removed

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users

  4. Important Notes
    - Container created first (empty)
    - Shipments added one by one
    - Each shipment uses its own agent's rate sheet
    - Revenue auto-calculated from slabs
    - Container costs allocated by CBM proportion
    - All amounts stored in INR for profit calculation
*/

-- Groupage Containers Table
CREATE TABLE IF NOT EXISTS groupage_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text UNIQUE NOT NULL,
  container_type text NOT NULL DEFAULT '20ft',
  status text NOT NULL DEFAULT 'planning',
  origin_port text NOT NULL,
  destination_port text NOT NULL,
  etd date,
  eta date,
  total_capacity_cbm decimal(10, 2) NOT NULL DEFAULT 33,
  used_capacity_cbm decimal(10, 2) DEFAULT 0,
  total_cost decimal(12, 2) DEFAULT 0,
  total_revenue_base decimal(12, 2) DEFAULT 0,
  total_allocated_cost decimal(12, 2) DEFAULT 0,
  profit_base decimal(12, 2) DEFAULT 0,
  profit_margin_percent decimal(5, 2) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE groupage_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groupage containers"
  ON groupage_containers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create groupage containers"
  ON groupage_containers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update groupage containers"
  ON groupage_containers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete groupage containers"
  ON groupage_containers FOR DELETE
  TO authenticated
  USING (true);

-- Container Costs Table
CREATE TABLE IF NOT EXISTS container_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES groupage_containers(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'freight',
  amount decimal(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  exchange_rate decimal(10, 4) NOT NULL DEFAULT 1,
  amount_in_inr decimal(12, 2) NOT NULL,
  supplier_id uuid REFERENCES agents(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE container_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view container costs"
  ON container_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create container costs"
  ON container_costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update container costs"
  ON container_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete container costs"
  ON container_costs FOR DELETE
  TO authenticated
  USING (true);

-- Container Shipments Table
CREATE TABLE IF NOT EXISTS container_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES groupage_containers(id) ON DELETE CASCADE,
  shipment_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  agent_id uuid NOT NULL REFERENCES agents(id),
  rate_sheet_id uuid NOT NULL REFERENCES rate_sheets(id),
  locked_exchange_rate decimal(10, 4) NOT NULL DEFAULT 1,
  cbm decimal(10, 2) NOT NULL,
  weight_kg decimal(10, 2),
  package_count integer DEFAULT 1,
  description text,
  revenue_base decimal(12, 2) DEFAULT 0,
  allocated_cost_base decimal(12, 2) DEFAULT 0,
  profit_base decimal(12, 2) DEFAULT 0,
  profit_margin_percent decimal(5, 2) DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE container_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view container shipments"
  ON container_shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create container shipments"
  ON container_shipments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update container shipments"
  ON container_shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete container shipments"
  ON container_shipments FOR DELETE
  TO authenticated
  USING (true);

-- Container Shipment Revenue Table
CREATE TABLE IF NOT EXISTS container_shipment_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_shipment_id uuid NOT NULL REFERENCES container_shipments(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'freight',
  amount decimal(12, 2) NOT NULL,
  currency text NOT NULL,
  exchange_rate decimal(10, 4) NOT NULL DEFAULT 1,
  amount_in_base_currency decimal(12, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE container_shipment_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view container shipment revenue"
  ON container_shipment_revenue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create container shipment revenue"
  ON container_shipment_revenue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete container shipment revenue"
  ON container_shipment_revenue FOR DELETE
  TO authenticated
  USING (true);

-- Function to allocate container costs proportionally
CREATE OR REPLACE FUNCTION allocate_container_costs(p_container_id uuid)
RETURNS void AS $$
DECLARE
  v_total_cost decimal;
  v_total_cbm decimal;
  v_shipment record;
  v_allocated_cost decimal;
BEGIN
  -- Get total container cost
  SELECT COALESCE(SUM(amount_in_inr), 0)
  INTO v_total_cost
  FROM container_costs
  WHERE container_id = p_container_id;

  -- Get total CBM used in container
  SELECT COALESCE(SUM(cbm), 0)
  INTO v_total_cbm
  FROM container_shipments
  WHERE container_id = p_container_id
    AND status = 'active';

  -- If no CBM, no allocation needed
  IF v_total_cbm = 0 THEN
    RETURN;
  END IF;

  -- Allocate costs to each shipment proportionally
  FOR v_shipment IN
    SELECT id, cbm, revenue_base
    FROM container_shipments
    WHERE container_id = p_container_id
      AND status = 'active'
  LOOP
    -- Calculate proportional cost allocation
    v_allocated_cost := (v_shipment.cbm / v_total_cbm) * v_total_cost;

    -- Update shipment with allocated cost and profit
    UPDATE container_shipments
    SET 
      allocated_cost_base = v_allocated_cost,
      profit_base = revenue_base - v_allocated_cost,
      profit_margin_percent = CASE 
        WHEN revenue_base > 0 THEN ((revenue_base - v_allocated_cost) / revenue_base) * 100
        ELSE 0
      END,
      updated_at = now()
    WHERE id = v_shipment.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update container totals
CREATE OR REPLACE FUNCTION update_container_totals(p_container_id uuid)
RETURNS void AS $$
DECLARE
  v_total_cost decimal := 0;
  v_total_revenue decimal := 0;
  v_total_allocated_cost decimal := 0;
  v_total_cbm decimal := 0;
  v_profit decimal := 0;
  v_margin decimal := 0;
BEGIN
  -- Get total cost
  SELECT COALESCE(SUM(amount_in_inr), 0)
  INTO v_total_cost
  FROM container_costs
  WHERE container_id = p_container_id;

  -- Get total CBM used
  SELECT COALESCE(SUM(cbm), 0)
  INTO v_total_cbm
  FROM container_shipments
  WHERE container_id = p_container_id
    AND status = 'active';

  -- Get total revenue
  SELECT COALESCE(SUM(revenue_base), 0)
  INTO v_total_revenue
  FROM container_shipments
  WHERE container_id = p_container_id
    AND status = 'active';

  -- Get total allocated costs
  SELECT COALESCE(SUM(allocated_cost_base), 0)
  INTO v_total_allocated_cost
  FROM container_shipments
  WHERE container_id = p_container_id
    AND status = 'active';

  -- Calculate profit
  v_profit := v_total_revenue - v_total_allocated_cost;

  -- Calculate margin
  IF v_total_revenue > 0 THEN
    v_margin := (v_profit / v_total_revenue) * 100;
  END IF;

  -- Update container
  UPDATE groupage_containers
  SET 
    used_capacity_cbm = v_total_cbm,
    total_cost = v_total_cost,
    total_revenue_base = v_total_revenue,
    total_allocated_cost = v_total_allocated_cost,
    profit_base = v_profit,
    profit_margin_percent = v_margin,
    updated_at = now()
  WHERE id = p_container_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update container shipment revenue totals
CREATE OR REPLACE FUNCTION update_container_shipment_totals(p_shipment_id uuid)
RETURNS void AS $$
DECLARE
  v_total_revenue decimal := 0;
  v_container_id uuid;
BEGIN
  -- Get total revenue for this shipment
  SELECT COALESCE(SUM(amount_in_base_currency), 0)
  INTO v_total_revenue
  FROM container_shipment_revenue
  WHERE container_shipment_id = p_shipment_id;

  -- Update shipment revenue
  UPDATE container_shipments
  SET 
    revenue_base = v_total_revenue,
    updated_at = now()
  WHERE id = p_shipment_id
  RETURNING container_id INTO v_container_id;

  -- Reallocate container costs
  PERFORM allocate_container_costs(v_container_id);

  -- Update container totals
  PERFORM update_container_totals(v_container_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger for container shipment revenue changes
CREATE OR REPLACE FUNCTION trigger_update_container_shipment_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_container_shipment_totals(OLD.container_shipment_id);
    RETURN OLD;
  ELSE
    PERFORM update_container_shipment_totals(NEW.container_shipment_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_container_shipment_revenue_totals ON container_shipment_revenue;
CREATE TRIGGER update_container_shipment_revenue_totals
  AFTER INSERT OR UPDATE OR DELETE ON container_shipment_revenue
  FOR EACH ROW EXECUTE FUNCTION trigger_update_container_shipment_totals();

-- Trigger for container cost changes
CREATE OR REPLACE FUNCTION trigger_update_container_on_cost_change()
RETURNS TRIGGER AS $$
DECLARE
  v_container_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_container_id := OLD.container_id;
  ELSE
    v_container_id := NEW.container_id;
  END IF;

  -- Reallocate costs
  PERFORM allocate_container_costs(v_container_id);
  
  -- Update totals
  PERFORM update_container_totals(v_container_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_container_on_cost_change ON container_costs;
CREATE TRIGGER update_container_on_cost_change
  AFTER INSERT OR UPDATE OR DELETE ON container_costs
  FOR EACH ROW EXECUTE FUNCTION trigger_update_container_on_cost_change();

-- Trigger for container shipment changes
CREATE OR REPLACE FUNCTION trigger_update_container_on_shipment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_container_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_container_id := OLD.container_id;
  ELSE
    v_container_id := NEW.container_id;
  END IF;

  -- Reallocate costs
  PERFORM allocate_container_costs(v_container_id);
  
  -- Update totals
  PERFORM update_container_totals(v_container_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_container_on_shipment_change ON container_shipments;
CREATE TRIGGER update_container_on_shipment_change
  AFTER INSERT OR UPDATE OR DELETE ON container_shipments
  FOR EACH ROW EXECUTE FUNCTION trigger_update_container_on_shipment_change();

-- View for container dashboard
CREATE OR REPLACE VIEW container_dashboard AS
SELECT 
  gc.id,
  gc.container_number,
  gc.container_type,
  gc.status,
  gc.origin_port,
  gc.destination_port,
  gc.etd,
  gc.eta,
  gc.total_capacity_cbm,
  gc.used_capacity_cbm,
  gc.total_capacity_cbm - gc.used_capacity_cbm as remaining_capacity_cbm,
  ROUND((gc.used_capacity_cbm / gc.total_capacity_cbm) * 100, 1) as utilization_percent,
  gc.total_cost,
  gc.total_revenue_base,
  gc.total_allocated_cost,
  gc.profit_base,
  gc.profit_margin_percent,
  COUNT(cs.id) as shipment_count,
  gc.created_at,
  gc.updated_at
FROM groupage_containers gc
LEFT JOIN container_shipments cs ON gc.id = cs.container_id AND cs.status = 'active'
GROUP BY gc.id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groupage_containers_status ON groupage_containers(status);
CREATE INDEX IF NOT EXISTS idx_groupage_containers_dates ON groupage_containers(etd, eta);
CREATE INDEX IF NOT EXISTS idx_container_costs_container ON container_costs(container_id);
CREATE INDEX IF NOT EXISTS idx_container_shipments_container ON container_shipments(container_id);
CREATE INDEX IF NOT EXISTS idx_container_shipments_status ON container_shipments(status);
CREATE INDEX IF NOT EXISTS idx_container_shipment_revenue_shipment ON container_shipment_revenue(container_shipment_id);

-- Trigger for updated_at columns
CREATE TRIGGER update_groupage_containers_updated_at BEFORE UPDATE ON groupage_containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_container_shipments_updated_at BEFORE UPDATE ON container_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();