/*
  # Enhance Trucking System with Revenue vs Cost Logic

  1. Enhancements to Existing Tables
    - Add revenue/cost logic fields to manual_trucking_costs
    - Add margin calculation and warning system
    - Add escort, handling, and toll breakdown
    - Add billing option (agent pays extra vs absorb cost)

  2. New Functions
    - Calculate trucking margin
    - Check if margin below target
    - Get trucking cost summary for shipment

  3. Important Notes
    - Metro cities: Delivery cost included in slab rate revenue
    - Non-metro cities: Two options
      * Option A: Agent pays extra (add to agent invoice)
      * Option B: Absorb cost (reduces profit, shows warning)
    - System shows profit calculation before confirmation
    - Warning if margin < target threshold
*/

-- Add new columns to manual_trucking_costs for revenue/cost logic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'escort_cost'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN escort_cost decimal(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'handling_cost_destination'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN handling_cost_destination decimal(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'margin_percentage'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN margin_percentage decimal(5, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN margin_amount decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'billing_option'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN billing_option text DEFAULT 'agent_pays_extra';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'extra_delivery_charge'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN extra_delivery_charge decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'base_revenue_included'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN base_revenue_included decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'estimated_profit'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN estimated_profit decimal(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'margin_warning'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN margin_warning boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_trucking_costs' AND column_name = 'target_margin_percentage'
  ) THEN
    ALTER TABLE manual_trucking_costs 
    ADD COLUMN target_margin_percentage decimal(5, 2) DEFAULT 15.00;
  END IF;
END $$;

-- Add columns to delivery_zones for default pricing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_zones' AND column_name = 'default_delivery_included'
  ) THEN
    ALTER TABLE delivery_zones 
    ADD COLUMN default_delivery_included boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_zones' AND column_name = 'estimated_trucking_cost'
  ) THEN
    ALTER TABLE delivery_zones 
    ADD COLUMN estimated_trucking_cost decimal(12, 2);
  END IF;
END $$;

-- Update metro zones to mark delivery as included
UPDATE delivery_zones 
SET default_delivery_included = true 
WHERE is_metro = true;

-- Function to calculate total trucking cost with all charges
CREATE OR REPLACE FUNCTION calculate_total_trucking_cost(
  p_base_trucking_cost decimal,
  p_fuel_surcharge decimal DEFAULT 0,
  p_toll_charges decimal DEFAULT 0,
  p_escort_cost decimal DEFAULT 0,
  p_loading_unloading decimal DEFAULT 0,
  p_handling_cost_destination decimal DEFAULT 0,
  p_detention decimal DEFAULT 0
)
RETURNS decimal AS $$
BEGIN
  RETURN COALESCE(p_base_trucking_cost, 0) + 
         COALESCE(p_fuel_surcharge, 0) + 
         COALESCE(p_toll_charges, 0) + 
         COALESCE(p_escort_cost, 0) +
         COALESCE(p_loading_unloading, 0) + 
         COALESCE(p_handling_cost_destination, 0) +
         COALESCE(p_detention, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate margin on trucking
CREATE OR REPLACE FUNCTION calculate_trucking_margin(
  p_total_cost decimal,
  p_margin_percentage decimal
)
RETURNS TABLE (
  margin_amount decimal,
  extra_delivery_charge decimal,
  estimated_profit decimal
) AS $$
DECLARE
  v_margin_amount decimal;
  v_extra_charge decimal;
  v_profit decimal;
BEGIN
  v_margin_amount := (p_total_cost * p_margin_percentage / 100);
  v_extra_charge := p_total_cost + v_margin_amount;
  v_profit := v_margin_amount;
  
  RETURN QUERY SELECT v_margin_amount, v_extra_charge, v_profit;
END;
$$ LANGUAGE plpgsql;

-- Function to check if margin below target (returns warning)
CREATE OR REPLACE FUNCTION check_margin_warning(
  p_base_revenue decimal,
  p_base_cost decimal,
  p_trucking_cost decimal,
  p_billing_option text,
  p_extra_delivery_charge decimal DEFAULT 0,
  p_target_margin decimal DEFAULT 15.00
)
RETURNS TABLE (
  total_revenue decimal,
  total_cost decimal,
  estimated_profit decimal,
  profit_margin_percentage decimal,
  is_below_target boolean,
  warning_message text
) AS $$
DECLARE
  v_total_revenue decimal;
  v_total_cost decimal;
  v_profit decimal;
  v_margin_pct decimal;
  v_below_target boolean;
  v_warning text;
BEGIN
  IF p_billing_option = 'agent_pays_extra' THEN
    v_total_revenue := p_base_revenue + COALESCE(p_extra_delivery_charge, 0);
    v_total_cost := p_base_cost + p_trucking_cost;
  ELSE
    v_total_revenue := p_base_revenue;
    v_total_cost := p_base_cost + p_trucking_cost;
  END IF;
  
  v_profit := v_total_revenue - v_total_cost;
  
  IF v_total_revenue > 0 THEN
    v_margin_pct := (v_profit / v_total_revenue) * 100;
  ELSE
    v_margin_pct := 0;
  END IF;
  
  v_below_target := v_margin_pct < p_target_margin;
  
  IF v_below_target THEN
    v_warning := format('Margin %.2f%% is below target %.2f%%. Estimated profit: %.2f', 
                        v_margin_pct, p_target_margin, v_profit);
  ELSE
    v_warning := NULL;
  END IF;
  
  RETURN QUERY SELECT 
    v_total_revenue,
    v_total_cost,
    v_profit,
    v_margin_pct,
    v_below_target,
    v_warning;
END;
$$ LANGUAGE plpgsql;

-- Function to get trucking summary for shipment
CREATE OR REPLACE FUNCTION get_shipment_trucking_summary(p_shipment_id uuid)
RETURNS TABLE (
  has_trucking boolean,
  total_trucking_cost decimal,
  extra_delivery_charge decimal,
  billing_option text,
  margin_warning boolean,
  estimated_profit decimal,
  is_metro boolean,
  delivery_included boolean
) AS $$
DECLARE
  v_trucking record;
  v_zone record;
BEGIN
  SELECT * INTO v_trucking
  FROM manual_trucking_costs
  WHERE shipment_id = p_shipment_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_trucking IS NULL THEN
    RETURN QUERY SELECT 
      false,
      0::decimal,
      0::decimal,
      'none'::text,
      false,
      0::decimal,
      false,
      false;
    RETURN;
  END IF;
  
  SELECT * INTO v_zone
  FROM delivery_zones
  WHERE id = v_trucking.to_zone_id;
  
  RETURN QUERY SELECT 
    true,
    v_trucking.total_cost,
    v_trucking.extra_delivery_charge,
    v_trucking.billing_option,
    v_trucking.margin_warning,
    v_trucking.estimated_profit,
    COALESCE(v_zone.is_metro, false),
    COALESCE(v_zone.default_delivery_included, false);
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for billing_option
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manual_trucking_costs_billing_option_check'
  ) THEN
    ALTER TABLE manual_trucking_costs
    ADD CONSTRAINT manual_trucking_costs_billing_option_check
    CHECK (billing_option IN ('agent_pays_extra', 'absorb_cost', 'none'));
  END IF;
END $$;

-- Update the manual_trucking_summary view to include new fields
DROP VIEW IF EXISTS manual_trucking_summary;

CREATE VIEW manual_trucking_summary AS
SELECT 
  mtc.id,
  mtc.from_location,
  mtc.to_location,
  dz.city_name as destination_city,
  dz.zone_type,
  dz.is_metro,
  dz.default_delivery_included,
  mtc.vehicle_type,
  mtc.distance_km,
  mtc.trucking_cost as base_trucking_cost,
  mtc.fuel_surcharge,
  mtc.toll_charges,
  mtc.escort_cost,
  mtc.loading_unloading_charges,
  mtc.handling_cost_destination,
  mtc.detention_charges,
  mtc.total_cost,
  mtc.margin_percentage,
  mtc.margin_amount,
  mtc.billing_option,
  mtc.extra_delivery_charge,
  mtc.base_revenue_included,
  mtc.estimated_profit,
  mtc.margin_warning,
  mtc.target_margin_percentage,
  mtc.currency,
  mtc.vendor_name,
  mtc.vendor_contact,
  mtc.is_approved,
  mtc.valid_from,
  mtc.valid_to,
  q.quote_number,
  s.shipment_number,
  mtc.remarks,
  mtc.created_at,
  mtc.created_by
FROM manual_trucking_costs mtc
LEFT JOIN delivery_zones dz ON mtc.to_zone_id = dz.id
LEFT JOIN quotes q ON mtc.quote_id = q.id
LEFT JOIN shipments s ON mtc.shipment_id = s.id;

-- Create index on billing_option
CREATE INDEX IF NOT EXISTS idx_manual_trucking_billing_option 
ON manual_trucking_costs(billing_option);

-- Create index on margin_warning
CREATE INDEX IF NOT EXISTS idx_manual_trucking_margin_warning 
ON manual_trucking_costs(margin_warning);