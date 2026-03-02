/*
  # Shipment Billing System - Phase 6
  
  Complete billing with agent and local client invoicing
*/

-- Miscellaneous charges
CREATE TABLE IF NOT EXISTS miscellaneous_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  charge_type text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  quantity numeric DEFAULT 1,
  unit_price numeric,
  is_billable boolean DEFAULT true,
  bill_to text,
  charge_category text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE miscellaneous_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view misc charges" ON miscellaneous_charges;
CREATE POLICY "Users can view misc charges" ON miscellaneous_charges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage misc charges" ON miscellaneous_charges;
CREATE POLICY "Users can manage misc charges" ON miscellaneous_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Shipment invoices
CREATE TABLE IF NOT EXISTS shipment_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  invoice_type text NOT NULL,
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  bill_to_name text NOT NULL,
  bill_to_address text,
  bill_to_contact text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  payment_terms text,
  currency text NOT NULL,
  exchange_rate numeric,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  total_inr numeric,
  paid_amount numeric DEFAULT 0,
  balance_due numeric,
  payment_status text DEFAULT 'unpaid',
  invoice_status text DEFAULT 'draft',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view shipment invoices" ON shipment_invoices;
CREATE POLICY "Users can view shipment invoices" ON shipment_invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage shipment invoices" ON shipment_invoices;
CREATE POLICY "Users can manage shipment invoices" ON shipment_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoice line items
CREATE TABLE IF NOT EXISTS shipment_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES shipment_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  item_type text NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view invoice items" ON shipment_invoice_items;
CREATE POLICY "Users can view invoice items" ON shipment_invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage invoice items" ON shipment_invoice_items;
CREATE POLICY "Users can manage invoice items" ON shipment_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Invoice payments
CREATE TABLE IF NOT EXISTS shipment_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES shipment_invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  currency text NOT NULL,
  payment_method text,
  transaction_reference text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view invoice payments" ON shipment_invoice_payments;
CREATE POLICY "Users can view invoice payments" ON shipment_invoice_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage invoice payments" ON shipment_invoice_payments;
CREATE POLICY "Users can manage invoice payments" ON shipment_invoice_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Functions
DROP FUNCTION IF EXISTS generate_shipment_invoice_number(text) CASCADE;
CREATE FUNCTION generate_shipment_invoice_number(p_type text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_prefix text; v_seq integer; v_num text;
BEGIN
  v_prefix := CASE WHEN p_type = 'agent' THEN 'AGT' ELSE 'LOC' END;
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 INTO v_seq
  FROM shipment_invoices WHERE invoice_number LIKE v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-%';
  v_num := v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_num;
END; $$;

DROP FUNCTION IF EXISTS get_inr_rate(text) CASCADE;
CREATE FUNCTION get_inr_rate(p_currency text) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE v_rate numeric;
BEGIN
  IF p_currency = 'INR' THEN RETURN 1; END IF;
  SELECT rate INTO v_rate FROM exchange_rates WHERE from_currency = p_currency AND to_currency = 'INR' ORDER BY effective_date DESC LIMIT 1;
  IF v_rate IS NULL THEN
    v_rate := CASE p_currency WHEN 'USD' THEN 83.0 WHEN 'EUR' THEN 90.0 WHEN 'GBP' THEN 105.0 WHEN 'AED' THEN 22.6 ELSE 1.0 END;
  END IF;
  RETURN v_rate;
END; $$;

DROP FUNCTION IF EXISTS create_agent_invoice(uuid) CASCADE;
CREATE FUNCTION create_agent_invoice(p_shipment_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_ship record; v_inv_id uuid; v_inv_num text; v_curr text; v_rate numeric; v_sub numeric := 0; v_line integer := 0; v_ch record;
BEGIN
  SELECT sd.*, rs.currency_code INTO v_ship FROM shipment_drafts sd LEFT JOIN rate_sheets rs ON rs.id = sd.rate_sheet_id WHERE sd.id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Shipment not found'); END IF;
  v_curr := COALESCE(v_ship.currency_code, 'USD'); v_rate := get_inr_rate(v_curr); v_inv_num := generate_shipment_invoice_number('agent');
  INSERT INTO shipment_invoices (invoice_number, invoice_type, shipment_draft_id, bill_to_name, currency, exchange_rate, due_date, payment_terms, created_by)
  VALUES (v_inv_num, 'agent', p_shipment_id, COALESCE(v_ship.agent_name, 'Agent'), v_curr, v_rate, CURRENT_DATE + 30, 'Net 30', auth.uid()) RETURNING id INTO v_inv_id;
  IF COALESCE(v_ship.revenue_base_charges, 0) > 0 THEN v_line := v_line + 1;
    INSERT INTO shipment_invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount)
    VALUES (v_inv_id, v_line, 'base', 'Base Transportation Charges', 1, v_ship.revenue_base_charges, v_ship.revenue_base_charges); v_sub := v_sub + v_ship.revenue_base_charges;
  END IF;
  IF COALESCE(v_ship.final_storage_cost, 0) > 0 THEN v_line := v_line + 1;
    INSERT INTO shipment_invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount)
    VALUES (v_inv_id, v_line, 'storage', 'Storage Charges', 1, v_ship.final_storage_cost, v_ship.final_storage_cost); v_sub := v_sub + v_ship.final_storage_cost;
  END IF;
  FOR v_ch IN SELECT * FROM miscellaneous_charges WHERE shipment_draft_id = p_shipment_id AND is_billable = true AND bill_to IN ('agent', 'both') AND currency = v_curr LOOP
    v_line := v_line + 1;
    INSERT INTO shipment_invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount)
    VALUES (v_inv_id, v_line, 'misc', v_ch.description, v_ch.quantity, v_ch.unit_price, v_ch.amount); v_sub := v_sub + v_ch.amount;
  END LOOP;
  UPDATE shipment_invoices SET subtotal = v_sub, total_amount = v_sub, total_inr = v_sub * v_rate, balance_due = v_sub WHERE id = v_inv_id;
  RETURN json_build_object('success', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num, 'currency', v_curr, 'total', v_sub, 'inr', v_sub * v_rate);
END; $$;

DROP FUNCTION IF EXISTS create_local_invoice(uuid) CASCADE;
CREATE FUNCTION create_local_invoice(p_shipment_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_ship record; v_inv_id uuid; v_inv_num text; v_sub numeric := 0; v_line integer := 0; v_tax_rate numeric := 18; v_tax numeric; v_total numeric; v_ch record;
BEGIN
  SELECT * INTO v_ship FROM shipment_drafts WHERE id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Shipment not found'); END IF;
  v_inv_num := generate_shipment_invoice_number('local_client');
  INSERT INTO shipment_invoices (invoice_number, invoice_type, shipment_draft_id, bill_to_name, currency, exchange_rate, due_date, payment_terms, tax_rate, created_by)
  VALUES (v_inv_num, 'local_client', p_shipment_id, COALESCE(v_ship.client_name, 'Client'), 'INR', 1, CURRENT_DATE + 15, 'Net 15', v_tax_rate, auth.uid()) RETURNING id INTO v_inv_id;
  FOR v_ch IN SELECT * FROM miscellaneous_charges WHERE shipment_draft_id = p_shipment_id AND is_billable = true AND bill_to IN ('client', 'both') AND currency = 'INR' LOOP
    v_line := v_line + 1;
    INSERT INTO shipment_invoice_items (invoice_id, line_number, item_type, description, quantity, unit_price, amount)
    VALUES (v_inv_id, v_line, v_ch.charge_type, v_ch.description, v_ch.quantity, v_ch.unit_price, v_ch.amount); v_sub := v_sub + v_ch.amount;
  END LOOP;
  IF v_sub = 0 THEN DELETE FROM shipment_invoices WHERE id = v_inv_id; RETURN json_build_object('success', false, 'error', 'No charges'); END IF;
  v_tax := v_sub * v_tax_rate / 100; v_total := v_sub + v_tax;
  UPDATE shipment_invoices SET subtotal = v_sub, tax_amount = v_tax, total_amount = v_total, total_inr = v_total, balance_due = v_total WHERE id = v_inv_id;
  RETURN json_build_object('success', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_num, 'subtotal', v_sub, 'tax', v_tax, 'total', v_total);
END; $$;

DROP FUNCTION IF EXISTS add_invoice_payment(uuid, numeric, text, date, text) CASCADE;
CREATE FUNCTION add_invoice_payment(p_inv_id uuid, p_amt numeric, p_curr text, p_date date DEFAULT CURRENT_DATE, p_method text DEFAULT NULL) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_inv record; v_pay_id uuid; v_paid numeric; v_bal numeric; v_status text;
BEGIN
  SELECT * INTO v_inv FROM shipment_invoices WHERE id = p_inv_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Invoice not found'); END IF;
  INSERT INTO shipment_invoice_payments (invoice_id, payment_date, amount, currency, payment_method, recorded_by)
  VALUES (p_inv_id, p_date, p_amt, p_curr, p_method, auth.uid()) RETURNING id INTO v_pay_id;
  v_paid := COALESCE(v_inv.paid_amount, 0) + p_amt; v_bal := v_inv.total_amount - v_paid;
  v_status := CASE WHEN v_bal <= 0 THEN 'paid' WHEN v_paid > 0 THEN 'partial' ELSE 'unpaid' END;
  UPDATE shipment_invoices SET paid_amount = v_paid, balance_due = v_bal, payment_status = v_status, updated_at = now() WHERE id = p_inv_id;
  RETURN json_build_object('success', true, 'payment_id', v_pay_id, 'paid', v_paid, 'balance', v_bal, 'status', v_status);
END; $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_invoices_shipment ON shipment_invoices(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_shipment_invoices_type ON shipment_invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_shipment_invoices_status ON shipment_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_shipment_invoice_items_invoice ON shipment_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_shipment_invoice_payments_invoice ON shipment_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_misc_charges_shipment ON miscellaneous_charges(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_misc_charges_billable ON miscellaneous_charges(is_billable) WHERE is_billable = true;
