/*
  # Add Billable Tracking to Trucking Costs

  1. Changes to Existing Tables
    - Add `is_billable_to_agent` column to manual_trucking_costs
    - Add `revenue_amount` column to manual_trucking_costs (replaces base_revenue_included)
    - Update existing margin tracking to support billable/non-billable
    - Add billable tracking to distance calculations

  2. New Features
    - Track whether trucking cost is billable to agent
    - Clear distinction between cost and revenue
    - Forces explicit decision at time of entry

  3. Purpose
    - Prevents ambiguity on whether costs should generate revenue
    - Forces explicit decision: "Is this billable to agent? Yes/No"
    - Enables accurate profit tracking
    - Separates internal costs from billable services

  4. Business Logic
    - If is_billable_to_agent = true:
      * revenue_amount = user-entered amount charged to agent
      * margin_amount = revenue_amount - total_cost
      * margin_percentage = (margin_amount / total_cost) × 100
    - If is_billable_to_agent = false:
      * revenue_amount = 0
      * margin_amount = -total_cost (pure cost/loss)
      * margin_percentage = -100 (indicates pure cost)
*/

-- Add billable tracking columns to manual_trucking_costs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'is_billable_to_agent'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN is_billable_to_agent boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'revenue_amount'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN revenue_amount decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'billing_notes'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN billing_notes text;
  END IF;
END $$;

-- Add billable tracking to distance_calculation_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distance_calculation_log' AND column_name = 'is_billable_to_agent'
  ) THEN
    ALTER TABLE distance_calculation_log 
    ADD COLUMN is_billable_to_agent boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distance_calculation_log' AND column_name = 'revenue_amount'
  ) THEN
    ALTER TABLE distance_calculation_log 
    ADD COLUMN revenue_amount decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distance_calculation_log' AND column_name = 'cost_amount'
  ) THEN
    ALTER TABLE distance_calculation_log 
    ADD COLUMN cost_amount decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distance_calculation_log' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE distance_calculation_log 
    ADD COLUMN margin_amount decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distance_calculation_log' AND column_name = 'margin_percentage'
  ) THEN
    ALTER TABLE distance_calculation_log 
    ADD COLUMN margin_percentage decimal(8, 2) DEFAULT 0;
  END IF;
END $$;

-- Function to calculate margin when updating manual trucking costs
CREATE OR REPLACE FUNCTION calculate_trucking_margin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_billable_to_agent = true THEN
    -- Billable to agent: Calculate margin based on revenue vs cost
    -- Use revenue_amount if set, otherwise fall back to base_revenue_included
    IF NEW.revenue_amount > 0 THEN
      NEW.margin_amount := NEW.revenue_amount - NEW.total_cost;
    ELSIF NEW.base_revenue_included > 0 THEN
      NEW.revenue_amount := NEW.base_revenue_included;
      NEW.margin_amount := NEW.base_revenue_included - NEW.total_cost;
    END IF;
    
    -- Calculate margin percentage: (margin / cost) × 100
    IF NEW.total_cost > 0 THEN
      NEW.margin_percentage := (NEW.margin_amount / NEW.total_cost) * 100;
    ELSE
      NEW.margin_percentage := 0;
    END IF;
    
    -- Update estimated_profit to match margin_amount
    NEW.estimated_profit := NEW.margin_amount;
    
    -- Set margin warning if below target
    IF NEW.target_margin_percentage > 0 AND NEW.margin_percentage < NEW.target_margin_percentage THEN
      NEW.margin_warning := true;
    ELSE
      NEW.margin_warning := false;
    END IF;
  ELSE
    -- Not billable = pure cost (internal use, company vehicle, etc.)
    NEW.revenue_amount := 0;
    NEW.margin_amount := -NEW.total_cost;
    NEW.margin_percentage := -100;
    NEW.estimated_profit := -NEW.total_cost;
    NEW.margin_warning := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for manual_trucking_costs
DROP TRIGGER IF EXISTS calculate_trucking_margin_trigger ON manual_trucking_costs;
CREATE TRIGGER calculate_trucking_margin_trigger
  BEFORE INSERT OR UPDATE ON manual_trucking_costs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trucking_margin();

-- Function to get trucking revenue summary
CREATE OR REPLACE FUNCTION get_trucking_revenue_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_shipment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_costs decimal,
  total_revenue decimal,
  total_margin decimal,
  avg_margin_percentage decimal,
  billable_count bigint,
  non_billable_count bigint,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(mtc.total_cost), 0) as total_costs,
    COALESCE(SUM(mtc.revenue_amount), 0) as total_revenue,
    COALESCE(SUM(mtc.margin_amount), 0) as total_margin,
    COALESCE(AVG(CASE WHEN mtc.is_billable_to_agent THEN mtc.margin_percentage END), 0) as avg_margin_percentage,
    COUNT(*) FILTER (WHERE mtc.is_billable_to_agent = true) as billable_count,
    COUNT(*) FILTER (WHERE mtc.is_billable_to_agent = false) as non_billable_count,
    COUNT(*) as total_count
  FROM manual_trucking_costs mtc
  WHERE 
    (p_start_date IS NULL OR mtc.valid_from >= p_start_date)
    AND (p_end_date IS NULL OR mtc.valid_to <= p_end_date)
    AND (p_shipment_id IS NULL OR mtc.shipment_id = p_shipment_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get detailed margin breakdown by vehicle type
CREATE OR REPLACE FUNCTION get_trucking_margin_by_vehicle(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  vehicle_type text,
  total_trips bigint,
  billable_trips bigint,
  total_costs decimal,
  total_revenue decimal,
  total_margin decimal,
  avg_margin_percentage decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mtc.vehicle_type,
    COUNT(*) as total_trips,
    COUNT(*) FILTER (WHERE mtc.is_billable_to_agent = true) as billable_trips,
    COALESCE(SUM(mtc.total_cost), 0) as total_costs,
    COALESCE(SUM(mtc.revenue_amount), 0) as total_revenue,
    COALESCE(SUM(mtc.margin_amount), 0) as total_margin,
    COALESCE(AVG(CASE WHEN mtc.is_billable_to_agent THEN mtc.margin_percentage END), 0) as avg_margin_percentage
  FROM manual_trucking_costs mtc
  WHERE 
    (p_start_date IS NULL OR mtc.valid_from >= p_start_date)
    AND (p_end_date IS NULL OR mtc.valid_to <= p_end_date)
  GROUP BY mtc.vehicle_type
  ORDER BY total_margin DESC;
END;
$$ LANGUAGE plpgsql;

-- Create index for better performance on billable queries
CREATE INDEX IF NOT EXISTS idx_manual_trucking_costs_billable 
ON manual_trucking_costs(is_billable_to_agent, valid_from);

-- Add comments for clarity
COMMENT ON COLUMN manual_trucking_costs.is_billable_to_agent IS 'CRITICAL: Whether this trucking cost is charged to the agent (true = revenue generating, false = pure cost). Must be explicitly set.';
COMMENT ON COLUMN manual_trucking_costs.revenue_amount IS 'Amount charged to agent if billable. Should be ≥ total_cost for profit. System calculates margin automatically.';
COMMENT ON COLUMN manual_trucking_costs.billing_notes IS 'Additional notes about billing arrangement or why cost is/isn''t billable';

-- Update existing records to default billable status if NULL
UPDATE manual_trucking_costs 
SET is_billable_to_agent = true 
WHERE is_billable_to_agent IS NULL;