/*
  # Create Groupage Tariff and Quote System

  1. New Tables
    - `groupage_tariffs` - Master groupage tariff records
    - `groupage_tariff_rates` - CBM-based rate slabs per route
    - `groupage_tariff_charges` - Fixed charges (documentation, handling, etc.)
    - `groupage_quotes` - Customer quotes generated from tariffs
    - `groupage_quote_line_items` - Detailed quote breakdown

  2. Features
    - Origin/destination route-based tariffs
    - Volume slab pricing (rate per CBM based on volume ranges)
    - Fixed charges for services
    - Multi-currency support
    - Quote generation and tracking
    - Customer-specific discounts
    - Validity period management

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users only
*/

-- Create groupage tariffs master table
CREATE TABLE IF NOT EXISTS groupage_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_name text NOT NULL,
  tariff_code text UNIQUE NOT NULL,
  origin_port text NOT NULL,
  destination_port text NOT NULL,
  service_type text NOT NULL DEFAULT 'sea_lcl',
  transit_time_days integer,
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create groupage tariff rates (CBM-based slabs)
CREATE TABLE IF NOT EXISTS groupage_tariff_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id uuid REFERENCES groupage_tariffs(id) ON DELETE CASCADE,
  slab_name text NOT NULL,
  min_cbm numeric(10,2) NOT NULL DEFAULT 0,
  max_cbm numeric(10,2),
  rate_per_cbm numeric(10,2) NOT NULL,
  minimum_charge numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create groupage tariff fixed charges
CREATE TABLE IF NOT EXISTS groupage_tariff_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id uuid REFERENCES groupage_tariffs(id) ON DELETE CASCADE,
  charge_type text NOT NULL,
  charge_name text NOT NULL,
  charge_amount numeric(10,2) NOT NULL,
  is_per_shipment boolean DEFAULT true,
  is_optional boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create groupage quotes table
CREATE TABLE IF NOT EXISTS groupage_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  tariff_id uuid REFERENCES groupage_tariffs(id),
  origin_port text NOT NULL,
  destination_port text NOT NULL,
  estimated_cbm numeric(10,2) NOT NULL,
  estimated_weight_kg numeric(10,2),
  number_of_packages integer,
  commodity_description text,
  total_freight_charge numeric(10,2) NOT NULL DEFAULT 0,
  total_additional_charges numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount_percentage numeric(5,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  quote_status text DEFAULT 'draft',
  valid_until date,
  incoterm text DEFAULT 'EXW',
  special_instructions text,
  customer_reference text,
  quoted_by uuid REFERENCES auth.users(id),
  quoted_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  converted_to_job_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create groupage quote line items
CREATE TABLE IF NOT EXISTS groupage_quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES groupage_quotes(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1,
  unit_type text DEFAULT 'CBM',
  unit_rate numeric(10,2) NOT NULL,
  amount numeric(10,2) NOT NULL,
  is_included boolean DEFAULT true,
  notes text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE groupage_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_tariff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_tariff_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groupage_quote_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groupage_tariffs
CREATE POLICY "Users can view active tariffs"
  ON groupage_tariffs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tariffs"
  ON groupage_tariffs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tariffs"
  ON groupage_tariffs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tariffs"
  ON groupage_tariffs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for groupage_tariff_rates
CREATE POLICY "Users can view tariff rates"
  ON groupage_tariff_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tariff rates"
  ON groupage_tariff_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tariff rates"
  ON groupage_tariff_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tariff rates"
  ON groupage_tariff_rates FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for groupage_tariff_charges
CREATE POLICY "Users can view tariff charges"
  ON groupage_tariff_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tariff charges"
  ON groupage_tariff_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tariff charges"
  ON groupage_tariff_charges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tariff charges"
  ON groupage_tariff_charges FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for groupage_quotes
CREATE POLICY "Users can view quotes"
  ON groupage_quotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create quotes"
  ON groupage_quotes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update quotes"
  ON groupage_quotes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete quotes"
  ON groupage_quotes FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for groupage_quote_line_items
CREATE POLICY "Users can view quote line items"
  ON groupage_quote_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create quote line items"
  ON groupage_quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update quote line items"
  ON groupage_quote_line_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete quote line items"
  ON groupage_quote_line_items FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_active ON groupage_tariffs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_route ON groupage_tariffs(origin_port, destination_port);
CREATE INDEX IF NOT EXISTS idx_groupage_tariffs_effective ON groupage_tariffs(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_groupage_tariff_rates_tariff ON groupage_tariff_rates(tariff_id);
CREATE INDEX IF NOT EXISTS idx_groupage_tariff_charges_tariff ON groupage_tariff_charges(tariff_id);
CREATE INDEX IF NOT EXISTS idx_groupage_quotes_customer ON groupage_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_groupage_quotes_status ON groupage_quotes(quote_status);
CREATE INDEX IF NOT EXISTS idx_groupage_quotes_tariff ON groupage_quotes(tariff_id);
CREATE INDEX IF NOT EXISTS idx_groupage_quote_items_quote ON groupage_quote_line_items(quote_id);

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_groupage_quote_number()
RETURNS text AS $$
DECLARE
  next_num integer;
  quote_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'GQ-(\d+)') AS integer)), 0) + 1
  INTO next_num
  FROM groupage_quotes
  WHERE quote_number ~ '^GQ-\d+$';
  
  quote_num := 'GQ-' || LPAD(next_num::text, 6, '0');
  RETURN quote_num;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate quote totals
CREATE OR REPLACE FUNCTION calculate_groupage_quote_totals(p_quote_id uuid)
RETURNS void AS $$
DECLARE
  v_freight_total numeric(10,2);
  v_additional_total numeric(10,2);
  v_subtotal numeric(10,2);
  v_discount_amount numeric(10,2);
  v_discount_percentage numeric(5,2);
  v_total numeric(10,2);
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN item_type = 'freight' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN item_type != 'freight' THEN amount ELSE 0 END), 0)
  INTO v_freight_total, v_additional_total
  FROM groupage_quote_line_items
  WHERE quote_id = p_quote_id AND is_included = true;
  
  v_subtotal := v_freight_total + v_additional_total;
  
  SELECT discount_percentage INTO v_discount_percentage
  FROM groupage_quotes
  WHERE id = p_quote_id;
  
  v_discount_amount := v_subtotal * (v_discount_percentage / 100);
  v_total := v_subtotal - v_discount_amount;
  
  UPDATE groupage_quotes
  SET 
    total_freight_charge = v_freight_total,
    total_additional_charges = v_additional_total,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    total_amount = v_total,
    updated_at = now()
  WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql;
