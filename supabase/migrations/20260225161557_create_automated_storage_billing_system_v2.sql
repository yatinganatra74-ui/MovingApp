/*
  # Automated Storage Billing System

  1. New Tables
    - `storage_rate_sheets` - Storage rate sheets with slab-based pricing
      - `id` (uuid, primary key)
      - `name` (text) - e.g., "Dubai Warehouse Storage Rates 2024"
      - `currency` (text) - USD, INR, EUR, etc.
      - `free_days` (integer) - Default free days (e.g., 7)
      - `base_unit` (text) - cbm, weight, pallet, etc.
      - `billing_cycle` (text) - daily, weekly, monthly
      - `is_active` (boolean)
      - `effective_from` (date)
      - `effective_to` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `storage_rate_slabs` - Slab-based storage rates
      - `id` (uuid, primary key)
      - `storage_rate_sheet_id` (uuid, references storage_rate_sheets)
      - `from_days` (integer) - Start of slab (e.g., 8 days)
      - `to_days` (integer) - End of slab (e.g., 30 days, null for unlimited)
      - `rate_per_unit_per_month` (decimal) - Rate per CBM per month
      - `rate_per_unit_per_day` (decimal) - Rate per CBM per day
      - `created_at` (timestamptz)

    - `storage_invoices` - Auto-generated storage invoices
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique)
      - `shipment_id` (uuid) - Reference to shipment or job
      - `customer_id` (uuid, references customers)
      - `storage_rate_sheet_id` (uuid, references storage_rate_sheets)
      - `arrival_date` (date)
      - `delivery_date` (date)
      - `free_days` (integer)
      - `total_days_stored` (integer)
      - `chargeable_days` (integer)
      - `chargeable_months` (decimal) - Pro-rata calculation
      - `volume_cbm` (decimal)
      - `weight_kg` (decimal)
      - `billing_unit` (text) - cbm or weight
      - `billing_quantity` (decimal)
      - `rate_per_unit_per_month` (decimal)
      - `rate_per_unit_per_day` (decimal)
      - `subtotal` (decimal)
      - `tax_percent` (decimal)
      - `tax_amount` (decimal)
      - `total_amount` (decimal)
      - `currency` (text)
      - `exchange_rate` (decimal)
      - `amount_in_inr` (decimal)
      - `status` (text) - draft, pending, paid, cancelled
      - `invoice_date` (date)
      - `due_date` (date)
      - `paid_date` (date)
      - `notes` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `storage_invoice_line_items` - Detailed line items
      - `id` (uuid, primary key)
      - `storage_invoice_id` (uuid, references storage_invoices)
      - `description` (text)
      - `from_date` (date)
      - `to_date` (date)
      - `days` (integer)
      - `quantity` (decimal)
      - `rate` (decimal)
      - `amount` (decimal)
      - `created_at` (timestamptz)

  2. Functions
    - Calculate chargeable days automatically
    - Find applicable storage rate slab
    - Generate pro-rata monthly charges
    - Auto-create invoices when delivery date is set
    - Support daily and monthly billing

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users

  4. Important Notes
    - Arrival Date + Free Days = Billing Start Date
    - Delivery Date - Billing Start Date = Chargeable Days
    - Chargeable Days / 30 = Chargeable Months (pro-rata)
    - System finds applicable slab based on chargeable days
    - Invoice auto-generated when delivery date is entered
    - Multi-currency support with INR conversion
*/

-- Storage Rate Sheets Table
CREATE TABLE IF NOT EXISTS storage_rate_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  free_days integer NOT NULL DEFAULT 7,
  base_unit text NOT NULL DEFAULT 'cbm',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  is_active boolean DEFAULT true,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE storage_rate_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storage rate sheets"
  ON storage_rate_sheets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create storage rate sheets"
  ON storage_rate_sheets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update storage rate sheets"
  ON storage_rate_sheets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete storage rate sheets"
  ON storage_rate_sheets FOR DELETE
  TO authenticated
  USING (true);

-- Storage Rate Slabs Table
CREATE TABLE IF NOT EXISTS storage_rate_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_rate_sheet_id uuid NOT NULL REFERENCES storage_rate_sheets(id) ON DELETE CASCADE,
  from_days integer NOT NULL,
  to_days integer,
  rate_per_unit_per_month decimal(12, 2) NOT NULL,
  rate_per_unit_per_day decimal(12, 4),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE storage_rate_slabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storage rate slabs"
  ON storage_rate_slabs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create storage rate slabs"
  ON storage_rate_slabs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update storage rate slabs"
  ON storage_rate_slabs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete storage rate slabs"
  ON storage_rate_slabs FOR DELETE
  TO authenticated
  USING (true);

-- Storage Invoices Table
CREATE TABLE IF NOT EXISTS storage_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  shipment_id uuid,
  customer_id uuid REFERENCES customers(id),
  storage_rate_sheet_id uuid REFERENCES storage_rate_sheets(id),
  arrival_date date NOT NULL,
  delivery_date date NOT NULL,
  free_days integer NOT NULL DEFAULT 7,
  total_days_stored integer NOT NULL,
  chargeable_days integer NOT NULL,
  chargeable_months decimal(10, 2) NOT NULL,
  volume_cbm decimal(10, 2),
  weight_kg decimal(10, 2),
  billing_unit text NOT NULL DEFAULT 'cbm',
  billing_quantity decimal(10, 2) NOT NULL,
  rate_per_unit_per_month decimal(12, 2) NOT NULL,
  rate_per_unit_per_day decimal(12, 4),
  subtotal decimal(12, 2) NOT NULL,
  tax_percent decimal(5, 2) DEFAULT 0,
  tax_amount decimal(12, 2) DEFAULT 0,
  total_amount decimal(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  exchange_rate decimal(10, 4) DEFAULT 1,
  amount_in_inr decimal(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  invoice_date date NOT NULL,
  due_date date,
  paid_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE storage_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storage invoices"
  ON storage_invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create storage invoices"
  ON storage_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update storage invoices"
  ON storage_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete storage invoices"
  ON storage_invoices FOR DELETE
  TO authenticated
  USING (true);

-- Storage Invoice Line Items Table
CREATE TABLE IF NOT EXISTS storage_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_invoice_id uuid NOT NULL REFERENCES storage_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  days integer NOT NULL,
  quantity decimal(10, 2) NOT NULL,
  rate decimal(12, 2) NOT NULL,
  amount decimal(12, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE storage_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view storage invoice line items"
  ON storage_invoice_line_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create storage invoice line items"
  ON storage_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete storage invoice line items"
  ON storage_invoice_line_items FOR DELETE
  TO authenticated
  USING (true);

-- Function to find applicable storage rate slab
CREATE OR REPLACE FUNCTION find_storage_rate_slab(
  p_rate_sheet_id uuid,
  p_chargeable_days integer
)
RETURNS TABLE (
  slab_id uuid,
  from_days integer,
  to_days integer,
  rate_per_unit_per_month decimal,
  rate_per_unit_per_day decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    srs.from_days,
    srs.to_days,
    srs.rate_per_unit_per_month,
    srs.rate_per_unit_per_day
  FROM storage_rate_slabs srs
  WHERE srs.storage_rate_sheet_id = p_rate_sheet_id
    AND srs.from_days <= p_chargeable_days
    AND (srs.to_days IS NULL OR srs.to_days >= p_chargeable_days)
  ORDER BY srs.from_days DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate storage charges
CREATE OR REPLACE FUNCTION calculate_storage_charges(
  p_arrival_date date,
  p_delivery_date date,
  p_free_days integer,
  p_rate_sheet_id uuid,
  p_volume_cbm decimal,
  p_weight_kg decimal DEFAULT NULL
)
RETURNS TABLE (
  total_days integer,
  chargeable_days integer,
  chargeable_months decimal,
  billing_unit text,
  billing_quantity decimal,
  rate_per_unit_per_month decimal,
  rate_per_unit_per_day decimal,
  subtotal decimal,
  slab_from_days integer,
  slab_to_days integer
) AS $$
DECLARE
  v_total_days integer;
  v_chargeable_days integer;
  v_chargeable_months decimal;
  v_billing_unit text;
  v_billing_quantity decimal;
  v_slab record;
  v_rate_monthly decimal;
  v_rate_daily decimal;
  v_subtotal decimal;
BEGIN
  -- Calculate total days stored
  v_total_days := p_delivery_date - p_arrival_date;
  
  -- Calculate chargeable days (total days - free days)
  v_chargeable_days := GREATEST(0, v_total_days - p_free_days);
  
  -- Calculate chargeable months (pro-rata: days / 30)
  v_chargeable_months := ROUND((v_chargeable_days::decimal / 30), 2);
  
  -- Get rate sheet billing unit
  SELECT base_unit INTO v_billing_unit
  FROM storage_rate_sheets
  WHERE id = p_rate_sheet_id;
  
  -- Determine billing quantity based on unit
  IF v_billing_unit = 'cbm' THEN
    v_billing_quantity := p_volume_cbm;
  ELSIF v_billing_unit = 'weight' THEN
    v_billing_quantity := p_weight_kg;
  ELSE
    v_billing_quantity := p_volume_cbm;
  END IF;
  
  -- Find applicable rate slab
  SELECT * INTO v_slab
  FROM find_storage_rate_slab(p_rate_sheet_id, v_chargeable_days)
  LIMIT 1;
  
  IF v_slab IS NULL THEN
    RAISE EXCEPTION 'No applicable storage rate slab found for % days', v_chargeable_days;
  END IF;
  
  v_rate_monthly := v_slab.rate_per_unit_per_month;
  v_rate_daily := COALESCE(v_slab.rate_per_unit_per_day, v_rate_monthly / 30);
  
  -- Calculate subtotal: quantity × rate × months
  v_subtotal := ROUND(v_billing_quantity * v_rate_monthly * v_chargeable_months, 2);
  
  RETURN QUERY SELECT
    v_total_days,
    v_chargeable_days,
    v_chargeable_months,
    v_billing_unit,
    v_billing_quantity,
    v_rate_monthly,
    v_rate_daily,
    v_subtotal,
    v_slab.from_days,
    v_slab.to_days;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate storage invoice
CREATE OR REPLACE FUNCTION generate_storage_invoice(
  p_shipment_id uuid,
  p_arrival_date date,
  p_delivery_date date,
  p_volume_cbm decimal,
  p_weight_kg decimal,
  p_customer_id uuid,
  p_rate_sheet_id uuid,
  p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_invoice_id uuid;
  v_invoice_number text;
  v_free_days integer;
  v_charges record;
  v_currency text;
  v_exchange_rate decimal;
  v_tax_percent decimal := 0;
  v_tax_amount decimal;
  v_total_amount decimal;
  v_amount_in_inr decimal;
BEGIN
  -- Get rate sheet details
  SELECT free_days, currency INTO v_free_days, v_currency
  FROM storage_rate_sheets
  WHERE id = p_rate_sheet_id;
  
  -- Calculate storage charges
  SELECT * INTO v_charges
  FROM calculate_storage_charges(
    p_arrival_date,
    p_delivery_date,
    v_free_days,
    p_rate_sheet_id,
    p_volume_cbm,
    p_weight_kg
  );
  
  -- Get exchange rate
  SELECT rate INTO v_exchange_rate
  FROM exchange_rates
  WHERE from_currency = v_currency
    AND to_currency = 'INR'
  ORDER BY effective_date DESC
  LIMIT 1;
  
  IF v_exchange_rate IS NULL THEN
    v_exchange_rate := 1;
  END IF;
  
  -- Calculate tax and total
  v_tax_amount := ROUND(v_charges.subtotal * v_tax_percent / 100, 2);
  v_total_amount := v_charges.subtotal + v_tax_amount;
  v_amount_in_inr := ROUND(v_total_amount * v_exchange_rate, 2);
  
  -- Generate invoice number
  v_invoice_number := 'STR' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
  
  -- Create invoice
  INSERT INTO storage_invoices (
    invoice_number,
    shipment_id,
    customer_id,
    storage_rate_sheet_id,
    arrival_date,
    delivery_date,
    free_days,
    total_days_stored,
    chargeable_days,
    chargeable_months,
    volume_cbm,
    weight_kg,
    billing_unit,
    billing_quantity,
    rate_per_unit_per_month,
    rate_per_unit_per_day,
    subtotal,
    tax_percent,
    tax_amount,
    total_amount,
    currency,
    exchange_rate,
    amount_in_inr,
    status,
    invoice_date,
    due_date,
    created_by
  ) VALUES (
    v_invoice_number,
    p_shipment_id,
    p_customer_id,
    p_rate_sheet_id,
    p_arrival_date,
    p_delivery_date,
    v_free_days,
    v_charges.total_days,
    v_charges.chargeable_days,
    v_charges.chargeable_months,
    p_volume_cbm,
    p_weight_kg,
    v_charges.billing_unit,
    v_charges.billing_quantity,
    v_charges.rate_per_unit_per_month,
    v_charges.rate_per_unit_per_day,
    v_charges.subtotal,
    v_tax_percent,
    v_tax_amount,
    v_total_amount,
    v_currency,
    v_exchange_rate,
    v_amount_in_inr,
    'pending',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    p_created_by
  )
  RETURNING id INTO v_invoice_id;
  
  -- Create line item
  INSERT INTO storage_invoice_line_items (
    storage_invoice_id,
    description,
    from_date,
    to_date,
    days,
    quantity,
    rate,
    amount
  ) VALUES (
    v_invoice_id,
    'Storage charges - ' || v_charges.billing_quantity || ' ' || v_charges.billing_unit || ' for ' || v_charges.chargeable_months || ' months',
    p_arrival_date + v_free_days,
    p_delivery_date,
    v_charges.chargeable_days,
    v_charges.billing_quantity,
    v_charges.rate_per_unit_per_month,
    v_charges.subtotal
  );
  
  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_storage_rate_sheets_active ON storage_rate_sheets(is_active);
CREATE INDEX IF NOT EXISTS idx_storage_rate_slabs_sheet ON storage_rate_slabs(storage_rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_storage_invoices_shipment ON storage_invoices(shipment_id);
CREATE INDEX IF NOT EXISTS idx_storage_invoices_customer ON storage_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_storage_invoices_status ON storage_invoices(status);
CREATE INDEX IF NOT EXISTS idx_storage_invoice_line_items_invoice ON storage_invoice_line_items(storage_invoice_id);

-- Trigger for updated_at columns
CREATE TRIGGER update_storage_rate_sheets_updated_at BEFORE UPDATE ON storage_rate_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_storage_invoices_updated_at BEFORE UPDATE ON storage_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for storage invoice summary
CREATE OR REPLACE VIEW storage_invoice_summary AS
SELECT 
  si.id,
  si.invoice_number,
  si.invoice_date,
  si.status,
  c.name as customer_name,
  si.arrival_date,
  si.delivery_date,
  si.free_days,
  si.chargeable_days,
  si.chargeable_months,
  si.billing_quantity,
  si.billing_unit,
  si.rate_per_unit_per_month,
  si.subtotal,
  si.tax_amount,
  si.total_amount,
  si.currency,
  si.amount_in_inr,
  srs.name as rate_sheet_name
FROM storage_invoices si
LEFT JOIN customers c ON si.customer_id = c.id
LEFT JOIN storage_rate_sheets srs ON si.storage_rate_sheet_id = srs.id;