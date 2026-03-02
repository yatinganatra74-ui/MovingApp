/*
  # Add Missing Financial Summary Fields

  1. New Fields
    - Extra charges in INR
    - Local costs in INR
    - Target margin percentage
    - Margin status indicator
    - Storage cost tracking fields
    
  2. Calculation Functions
    - Auto-calculate total costs
    - Auto-calculate profit
    - Auto-calculate profit percentage
    - Determine margin status
*/

-- Add missing financial fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'extra_charges_inr'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN extra_charges_inr decimal(12, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'local_costs_inr'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN local_costs_inr decimal(12, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'target_margin_percentage'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN target_margin_percentage decimal(5, 2) DEFAULT 20.0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'margin_status'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN margin_status text DEFAULT 'unknown';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'storage_cost_inr'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN storage_cost_inr decimal(12, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'total_costs_calculated'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN total_costs_calculated decimal(12, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'estimated_profit'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN estimated_profit decimal(12, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'profit_pct'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN profit_pct decimal(5, 2) DEFAULT 0;
  END IF;
END $$;

-- Function to calculate comprehensive financial summary
CREATE OR REPLACE FUNCTION calculate_import_financial_summary(shipment_id uuid)
RETURNS json AS $$
DECLARE
  shipment_record RECORD;
  base_revenue_inr decimal(12, 2);
  extra_charges decimal(12, 2);
  total_revenue decimal(12, 2);
  container_cost decimal(12, 2);
  trucking_cost decimal(12, 2);
  storage_cost decimal(12, 2);
  local_costs decimal(12, 2);
  total_costs decimal(12, 2);
  profit decimal(12, 2);
  profit_pct decimal(5, 2);
  target_margin decimal(5, 2);
  margin_status text;
  result json;
BEGIN
  SELECT * INTO shipment_record
  FROM import_shipments
  WHERE id = shipment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Shipment not found');
  END IF;
  
  -- REVENUE CALCULATION
  -- Base revenue in INR (foreign currency × exchange rate)
  base_revenue_inr := COALESCE(shipment_record.total_revenue_foreign, 0) * COALESCE(shipment_record.exchange_rate, 1.0);
  
  -- Extra charges
  extra_charges := COALESCE(shipment_record.extra_charges_inr, 0);
  
  -- Total revenue
  total_revenue := base_revenue_inr + extra_charges;
  
  -- COST CALCULATION
  -- Container cost (allocated)
  container_cost := COALESCE(shipment_record.allocated_container_cost_inr, 0);
  
  -- Trucking cost (actual cost, not revenue)
  trucking_cost := COALESCE(shipment_record.trucking_cost_actual, 0);
  
  -- Storage cost
  storage_cost := COALESCE(shipment_record.storage_amount_inr, 0);
  
  -- Local costs
  local_costs := COALESCE(shipment_record.local_costs_inr, 0);
  
  -- Total costs
  total_costs := container_cost + trucking_cost + storage_cost + local_costs;
  
  -- PROFIT CALCULATION
  profit := total_revenue - total_costs;
  
  -- Profit percentage
  IF total_revenue > 0 THEN
    profit_pct := (profit / total_revenue) * 100;
  ELSE
    profit_pct := 0;
  END IF;
  
  -- Target margin
  target_margin := COALESCE(shipment_record.target_margin_percentage, 20.0);
  
  -- Margin status
  IF profit_pct >= target_margin THEN
    margin_status := 'above_target';
  ELSIF profit_pct >= (target_margin * 0.75) THEN
    margin_status := 'low_margin';
  ELSIF profit < 0 THEN
    margin_status := 'loss';
  ELSE
    margin_status := 'below_minimum';
  END IF;
  
  -- Update shipment with calculated values
  UPDATE import_shipments
  SET 
    total_revenue_inr = total_revenue,
    total_costs_calculated = total_costs,
    storage_cost_inr = storage_cost,
    estimated_profit = profit,
    profit_pct = profit_pct,
    margin_status = margin_status
  WHERE id = shipment_id;
  
  -- Return summary as JSON
  result := json_build_object(
    'base_revenue_foreign', shipment_record.total_revenue_foreign,
    'revenue_currency', shipment_record.revenue_currency,
    'exchange_rate', shipment_record.exchange_rate,
    'base_revenue_inr', base_revenue_inr,
    'extra_charges_inr', extra_charges,
    'total_revenue_inr', total_revenue,
    'container_cost', container_cost,
    'trucking_cost', trucking_cost,
    'storage_cost', storage_cost,
    'local_costs', local_costs,
    'total_costs', total_costs,
    'estimated_profit', profit,
    'profit_percentage', profit_pct,
    'target_margin', target_margin,
    'margin_status', margin_status
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_shipments_margin_status 
  ON import_shipments(margin_status);

CREATE INDEX IF NOT EXISTS idx_import_shipments_profit 
  ON import_shipments(estimated_profit);

-- Comments
COMMENT ON COLUMN import_shipments.extra_charges_inr IS 'Additional charges in INR (packing, documentation, etc.)';
COMMENT ON COLUMN import_shipments.local_costs_inr IS 'Local handling and processing costs in INR';
COMMENT ON COLUMN import_shipments.target_margin_percentage IS 'Target profit margin percentage for this shipment';
COMMENT ON COLUMN import_shipments.margin_status IS 'Status: above_target, low_margin, below_minimum, or loss';
COMMENT ON COLUMN import_shipments.storage_cost_inr IS 'Storage cost in INR (mirrors storage_amount_inr)';
COMMENT ON COLUMN import_shipments.total_costs_calculated IS 'Total costs = Container + Trucking + Storage + Local';
COMMENT ON COLUMN import_shipments.estimated_profit IS 'Estimated profit = Total Revenue - Total Costs';
COMMENT ON COLUMN import_shipments.profit_pct IS 'Profit as percentage of revenue';

COMMENT ON FUNCTION calculate_import_financial_summary IS 'Calculates comprehensive financial summary including revenue, costs, profit, and margin status';