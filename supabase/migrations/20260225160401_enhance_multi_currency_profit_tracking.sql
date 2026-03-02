/*
  # Multi-Currency Profit Tracking Enhancement

  1. Updates to existing tables
    - Add base_currency system setting (default INR)
    - Enhance shipment_revenue with better currency tracking
    - Enhance shipment_costs with better currency tracking
    - Add profit calculation views

  2. New functionality
    - Automatic conversion to base currency (INR)
    - Lock exchange rates at job creation time
    - Calculate profit per shipment in base currency
    - Track revenue in original currency + converted amount
    - Track costs in original currency + converted amount

  3. Important Notes
    - All revenue stored in original currency (USD, EUR, etc.)
    - All costs stored in original currency
    - Exchange rate locked when shipment created
    - Both original and INR amounts stored for reporting
    - Profit = Revenue (INR) - Costs (INR)
*/

-- Add base_currency configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system config"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update system config"
  ON system_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default base currency
INSERT INTO system_config (config_key, config_value, description)
VALUES ('base_currency', 'INR', 'Base currency for profit calculations and reporting')
ON CONFLICT (config_key) DO NOTHING;

-- Update exchange_rates to ensure we have proper indexing
CREATE INDEX IF NOT EXISTS idx_exchange_rates_from_to ON exchange_rates(from_currency, to_currency, effective_date DESC);

-- Add computed profit columns to shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'total_revenue_base'
  ) THEN
    ALTER TABLE shipments ADD COLUMN total_revenue_base decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'total_cost_base'
  ) THEN
    ALTER TABLE shipments ADD COLUMN total_cost_base decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'profit_base'
  ) THEN
    ALTER TABLE shipments ADD COLUMN profit_base decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'profit_margin_percent'
  ) THEN
    ALTER TABLE shipments ADD COLUMN profit_margin_percent decimal(5, 2) DEFAULT 0;
  END IF;
END $$;

-- Function to get latest exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency text,
  p_to_currency text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS decimal AS $$
DECLARE
  v_rate decimal;
BEGIN
  -- If currencies are the same, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;

  -- Get the most recent exchange rate on or before the specified date
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  -- If no rate found, return 1 (no conversion)
  RETURN COALESCE(v_rate, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to convert amount to base currency
CREATE OR REPLACE FUNCTION convert_to_base_currency(
  p_amount decimal,
  p_from_currency text,
  p_exchange_rate decimal DEFAULT NULL
)
RETURNS decimal AS $$
DECLARE
  v_base_currency text;
  v_exchange_rate decimal;
BEGIN
  -- Get base currency from config
  SELECT config_value INTO v_base_currency
  FROM system_config
  WHERE config_key = 'base_currency';

  -- If no base currency configured, default to INR
  v_base_currency := COALESCE(v_base_currency, 'INR');

  -- If currencies are the same, no conversion needed
  IF p_from_currency = v_base_currency THEN
    RETURN p_amount;
  END IF;

  -- Use provided exchange rate or fetch current rate
  IF p_exchange_rate IS NOT NULL THEN
    v_exchange_rate := p_exchange_rate;
  ELSE
    v_exchange_rate := get_exchange_rate(p_from_currency, v_base_currency);
  END IF;

  RETURN p_amount * v_exchange_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to update shipment totals
CREATE OR REPLACE FUNCTION update_shipment_totals(p_shipment_id uuid)
RETURNS void AS $$
DECLARE
  v_total_revenue_base decimal := 0;
  v_total_cost_base decimal := 0;
  v_profit_base decimal := 0;
  v_profit_margin decimal := 0;
BEGIN
  -- Calculate total revenue in base currency
  SELECT COALESCE(SUM(amount_in_base_currency), 0)
  INTO v_total_revenue_base
  FROM shipment_revenue
  WHERE shipment_id = p_shipment_id;

  -- Calculate total costs in base currency
  SELECT COALESCE(SUM(amount_in_base_currency), 0)
  INTO v_total_cost_base
  FROM shipment_costs
  WHERE shipment_id = p_shipment_id;

  -- Calculate profit
  v_profit_base := v_total_revenue_base - v_total_cost_base;

  -- Calculate profit margin percentage
  IF v_total_revenue_base > 0 THEN
    v_profit_margin := (v_profit_base / v_total_revenue_base) * 100;
  END IF;

  -- Update shipment record
  UPDATE shipments
  SET 
    total_revenue_base = v_total_revenue_base,
    total_cost_base = v_total_cost_base,
    profit_base = v_profit_base,
    profit_margin_percent = v_profit_margin,
    updated_at = now()
  WHERE id = p_shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update shipment totals when revenue is added/updated
CREATE OR REPLACE FUNCTION trigger_update_shipment_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_shipment_totals(OLD.shipment_id);
    RETURN OLD;
  ELSE
    PERFORM update_shipment_totals(NEW.shipment_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_totals_on_revenue_change ON shipment_revenue;
CREATE TRIGGER update_totals_on_revenue_change
  AFTER INSERT OR UPDATE OR DELETE ON shipment_revenue
  FOR EACH ROW EXECUTE FUNCTION trigger_update_shipment_totals();

DROP TRIGGER IF EXISTS update_totals_on_cost_change ON shipment_costs;
CREATE TRIGGER update_totals_on_cost_change
  AFTER INSERT OR UPDATE OR DELETE ON shipment_costs
  FOR EACH ROW EXECUTE FUNCTION trigger_update_shipment_totals();

-- Function to calculate revenue from slab rate
CREATE OR REPLACE FUNCTION calculate_slab_revenue(
  p_rate_sheet_id uuid,
  p_cbm decimal,
  p_exchange_rate decimal DEFAULT 1
)
RETURNS TABLE (
  charge_type text,
  description text,
  amount_foreign decimal,
  currency text,
  amount_base decimal,
  exchange_rate decimal,
  slab_from_cbm decimal,
  slab_to_cbm decimal,
  rate_per_cbm decimal
) AS $$
DECLARE
  v_base_currency text;
BEGIN
  -- Get base currency
  SELECT config_value INTO v_base_currency
  FROM system_config
  WHERE config_key = 'base_currency';
  
  v_base_currency := COALESCE(v_base_currency, 'INR');

  -- Return slab-based revenue
  RETURN QUERY
  SELECT 
    s.charge_type::text,
    COALESCE(s.description, s.charge_type::text) as description,
    (p_cbm * s.rate_per_cbm) as amount_foreign,
    s.currency::text,
    (p_cbm * s.rate_per_cbm * 
      CASE 
        WHEN s.currency = v_base_currency THEN 1
        ELSE p_exchange_rate
      END
    ) as amount_base,
    p_exchange_rate as exchange_rate,
    s.from_cbm,
    s.to_cbm,
    s.rate_per_cbm
  FROM rate_sheet_slabs s
  WHERE s.rate_sheet_id = p_rate_sheet_id
    AND s.from_cbm <= p_cbm
    AND (s.to_cbm IS NULL OR s.to_cbm >= p_cbm);

  -- Return fixed charges
  RETURN QUERY
  SELECT 
    f.charge_type::text,
    f.charge_name as description,
    f.amount as amount_foreign,
    f.currency::text,
    (f.amount * 
      CASE 
        WHEN f.currency = v_base_currency THEN 1
        ELSE p_exchange_rate
      END
    ) as amount_base,
    p_exchange_rate as exchange_rate,
    NULL::decimal as slab_from_cbm,
    NULL::decimal as slab_to_cbm,
    NULL::decimal as rate_per_cbm
  FROM rate_sheet_fixed_charges f
  WHERE f.rate_sheet_id = p_rate_sheet_id
    AND f.is_mandatory = true;
END;
$$ LANGUAGE plpgsql;

-- View for shipment profitability analysis
CREATE OR REPLACE VIEW shipment_profitability AS
SELECT 
  s.id,
  s.shipment_number,
  s.status,
  s.booking_date,
  a.name as agent_name,
  rs.name as rate_sheet_name,
  rs.base_currency as rate_sheet_currency,
  s.total_cbm,
  s.locked_exchange_rate,
  s.total_revenue_base,
  s.total_cost_base,
  s.profit_base,
  s.profit_margin_percent,
  (SELECT config_value FROM system_config WHERE config_key = 'base_currency') as base_currency
FROM shipments s
LEFT JOIN agents a ON s.agent_id = a.id
LEFT JOIN rate_sheets rs ON s.locked_rate_sheet_id = rs.id
WHERE s.status != 'cancelled';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_profit ON shipments(profit_base DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_status_date ON shipments(status, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_revenue_base_amount ON shipment_revenue(shipment_id, amount_in_base_currency);
CREATE INDEX IF NOT EXISTS idx_shipment_costs_base_amount ON shipment_costs(shipment_id, amount_in_base_currency);

-- Trigger for system_config updates
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();