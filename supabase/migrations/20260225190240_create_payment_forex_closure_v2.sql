/*
  # Payment Forex & Container Closure System
*/

-- Enhance payments with forex
ALTER TABLE shipment_invoice_payments
ADD COLUMN IF NOT EXISTS bank_exchange_rate numeric,
ADD COLUMN IF NOT EXISTS actual_inr_amount numeric,
ADD COLUMN IF NOT EXISTS forex_gain_loss numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS forex_notes text;

-- Forex transactions
CREATE TABLE IF NOT EXISTS forex_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES shipment_invoice_payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES shipment_invoices(id) ON DELETE CASCADE,
  shipment_draft_id uuid REFERENCES shipment_drafts(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  original_currency text NOT NULL,
  original_amount numeric NOT NULL,
  booking_exchange_rate numeric NOT NULL,
  booking_inr_value numeric NOT NULL,
  actual_exchange_rate numeric NOT NULL,
  actual_inr_value numeric NOT NULL,
  forex_gain_loss numeric GENERATED ALWAYS AS (actual_inr_value - booking_inr_value) STORED,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forex_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view forex" ON forex_transactions;
CREATE POLICY "Users can view forex" ON forex_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage forex" ON forex_transactions;
CREATE POLICY "Users can manage forex" ON forex_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Container closure
CREATE TABLE IF NOT EXISTS container_closure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  groupage_container_id uuid REFERENCES groupage_containers(id) ON DELETE CASCADE,
  closure_status text DEFAULT 'open',
  total_shipments integer DEFAULT 0,
  delivered_shipments integer DEFAULT 0,
  total_revenue_usd numeric DEFAULT 0,
  total_revenue_inr numeric DEFAULT 0,
  total_cost_usd numeric DEFAULT 0,
  total_cost_inr numeric DEFAULT 0,
  total_forex_gain_loss numeric DEFAULT 0,
  final_profit_usd numeric DEFAULT 0,
  final_profit_inr numeric DEFAULT 0,
  profit_margin_percent numeric DEFAULT 0,
  is_profit_locked boolean DEFAULT false,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_date date,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_notes text,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE container_closure ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view closure" ON container_closure;
CREATE POLICY "Users can view closure" ON container_closure FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can manage closure" ON container_closure;
CREATE POLICY "Users can manage closure" ON container_closure FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add closure to containers
ALTER TABLE groupage_containers
ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS closed_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Payment with forex
DROP FUNCTION IF EXISTS record_payment_with_forex(uuid, numeric, text, numeric, numeric, date, text) CASCADE;
CREATE FUNCTION record_payment_with_forex(p_invoice_id uuid, p_amount numeric, p_currency text, p_bank_rate numeric, p_actual_inr numeric, p_payment_date date DEFAULT CURRENT_DATE, p_method text DEFAULT 'bank_transfer')
RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_inv record; v_pay_id uuid; v_forex numeric; v_book_inr numeric; v_paid numeric; v_bal numeric; v_status text;
BEGIN
  SELECT * INTO v_inv FROM shipment_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Invoice not found'); END IF;
  IF p_currency = 'INR' THEN p_bank_rate := 1; p_actual_inr := p_amount; v_book_inr := p_amount; v_forex := 0;
  ELSE v_book_inr := p_amount * COALESCE(v_inv.exchange_rate, 1); v_forex := p_actual_inr - v_book_inr; END IF;
  INSERT INTO shipment_invoice_payments (invoice_id, payment_date, amount, currency, payment_method, bank_exchange_rate, actual_inr_amount, forex_gain_loss, recorded_by)
  VALUES (p_invoice_id, p_payment_date, p_amount, p_currency, p_method, p_bank_rate, p_actual_inr, v_forex, auth.uid()) RETURNING id INTO v_pay_id;
  INSERT INTO forex_transactions (payment_id, invoice_id, shipment_draft_id, transaction_type, transaction_date, original_currency, original_amount, booking_exchange_rate, booking_inr_value, actual_exchange_rate, actual_inr_value, created_by)
  VALUES (v_pay_id, p_invoice_id, v_inv.shipment_draft_id, 'payment_receipt', p_payment_date, p_currency, p_amount, v_inv.exchange_rate, v_book_inr, p_bank_rate, p_actual_inr, auth.uid());
  v_paid := COALESCE(v_inv.paid_amount, 0) + p_amount; v_bal := v_inv.total_amount - v_paid;
  v_status := CASE WHEN v_bal <= 0 THEN 'paid' WHEN v_paid > 0 THEN 'partial' ELSE 'unpaid' END;
  UPDATE shipment_invoices SET paid_amount = v_paid, balance_due = v_bal, payment_status = v_status, updated_at = now() WHERE id = p_invoice_id;
  RETURN json_build_object('success', true, 'payment_id', v_pay_id, 'forex_gain_loss', v_forex, 'booking_inr', v_book_inr, 'actual_inr', p_actual_inr, 'paid_amount', v_paid, 'balance_due', v_bal, 'payment_status', v_status);
END; $$;

-- Calculate container financials
DROP FUNCTION IF EXISTS calculate_container_financials(uuid) CASCADE;
CREATE FUNCTION calculate_container_financials(p_container_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_cont record; v_tot_ship integer; v_del_ship integer; v_revenue numeric := 0; v_cost numeric := 0; v_forex numeric := 0; v_profit numeric; v_margin numeric;
BEGIN
  SELECT * INTO v_cont FROM groupage_containers WHERE id = p_container_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Container not found'); END IF;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('delivered', 'completed')) INTO v_tot_ship, v_del_ship FROM shipment_drafts WHERE groupage_container_id = p_container_id;
  SELECT COALESCE(SUM(revenue_base_charges), 0), COALESCE(SUM(cost_base_charges + cost_packing_materials + cost_labor + cost_trucking + cost_storage + cost_insurance + cost_customs + cost_other), 0)
  INTO v_revenue, v_cost FROM shipment_drafts WHERE groupage_container_id = p_container_id;
  SELECT COALESCE(SUM(forex_gain_loss), 0) INTO v_forex FROM forex_transactions ft JOIN shipment_drafts sd ON sd.id = ft.shipment_draft_id WHERE sd.groupage_container_id = p_container_id;
  v_profit := v_revenue - v_cost; v_margin := CASE WHEN v_revenue > 0 THEN (v_profit / v_revenue) * 100 ELSE 0 END;
  RETURN json_build_object('success', true, 'container_number', v_cont.container_number, 'total_shipments', v_tot_ship, 'delivered_shipments', v_del_ship, 'total_revenue', v_revenue, 'total_cost', v_cost, 'forex_gain_loss', v_forex, 'profit', v_profit, 'margin_percent', v_margin, 'can_close', v_tot_ship > 0 AND v_tot_ship = v_del_ship);
END; $$;

-- Close container
DROP FUNCTION IF EXISTS close_container(uuid, text) CASCADE;
CREATE FUNCTION close_container(p_container_id uuid, p_notes text DEFAULT NULL) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_fin json; v_clos_id uuid; v_can boolean;
BEGIN
  v_fin := calculate_container_financials(p_container_id); v_can := (v_fin->>'can_close')::boolean;
  IF NOT v_can THEN RETURN json_build_object('success', false, 'error', 'Not all shipments delivered'); END IF;
  DELETE FROM container_closure WHERE groupage_container_id = p_container_id;
  INSERT INTO container_closure (groupage_container_id, closure_status, total_shipments, delivered_shipments, total_revenue_usd, total_cost_usd, total_forex_gain_loss, final_profit_usd, profit_margin_percent, closure_date, closed_by, closure_notes)
  VALUES (p_container_id, 'closed', (v_fin->>'total_shipments')::integer, (v_fin->>'delivered_shipments')::integer, (v_fin->>'total_revenue')::numeric, (v_fin->>'total_cost')::numeric, (v_fin->>'forex_gain_loss')::numeric, (v_fin->>'profit')::numeric, (v_fin->>'margin_percent')::numeric, CURRENT_DATE, auth.uid(), p_notes)
  RETURNING id INTO v_clos_id;
  UPDATE groupage_containers SET is_closed = true, closed_at = now(), closed_by = auth.uid(), status = 'closed' WHERE id = p_container_id;
  RETURN json_build_object('success', true, 'closure_id', v_clos_id, 'financials', v_fin);
END; $$;

-- Lock profit
DROP FUNCTION IF EXISTS lock_container_profit(uuid) CASCADE;
CREATE FUNCTION lock_container_profit(p_container_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_clos_id uuid;
BEGIN
  SELECT id INTO v_clos_id FROM container_closure WHERE groupage_container_id = p_container_id AND closure_status = 'closed';
  IF v_clos_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Container not closed'); END IF;
  UPDATE container_closure SET is_profit_locked = true, locked_at = now(), locked_by = auth.uid() WHERE id = v_clos_id;
  RETURN json_build_object('success', true, 'message', 'Profit locked');
END; $$;

-- Archive
DROP FUNCTION IF EXISTS archive_container(uuid) CASCADE;
CREATE FUNCTION archive_container(p_container_id uuid) RETURNS json LANGUAGE plpgsql AS $$
DECLARE v_clos_id uuid;
BEGIN
  SELECT id INTO v_clos_id FROM container_closure WHERE groupage_container_id = p_container_id AND closure_status = 'closed' AND is_profit_locked = true;
  IF v_clos_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not closed/locked'); END IF;
  UPDATE container_closure SET closure_status = 'archived', archived_at = now(), archived_by = auth.uid() WHERE id = v_clos_id;
  UPDATE groupage_containers SET status = 'archived' WHERE id = p_container_id;
  RETURN json_build_object('success', true, 'message', 'Archived');
END; $$;

-- Views
CREATE OR REPLACE VIEW container_financial_dashboard AS
SELECT gc.id, gc.container_number, gc.container_type, gc.eta, gc.status as container_status, gc.is_closed,
  COALESCE(cc.closure_status, 'open') as closure_status, cc.is_profit_locked,
  COALESCE(cc.total_shipments, (SELECT COUNT(*) FROM shipment_drafts WHERE groupage_container_id = gc.id)) as total_shipments,
  COALESCE(cc.delivered_shipments, (SELECT COUNT(*) FROM shipment_drafts WHERE groupage_container_id = gc.id AND status IN ('delivered', 'completed'))) as delivered_shipments,
  COALESCE(cc.total_revenue_usd, 0) as total_revenue, COALESCE(cc.total_cost_usd, 0) as total_cost,
  COALESCE(cc.total_forex_gain_loss, 0) as forex_gain_loss, COALESCE(cc.final_profit_usd, 0) as final_profit,
  COALESCE(cc.profit_margin_percent, 0) as profit_margin, cc.closure_date, cc.locked_at, cc.archived_at,
  gc.created_at, gc.updated_at
FROM groupage_containers gc LEFT JOIN container_closure cc ON cc.groupage_container_id = gc.id ORDER BY gc.created_at DESC;

CREATE OR REPLACE VIEW payment_forex_summary AS
SELECT sp.id as payment_id, sp.payment_date, sp.amount as payment_amount, sp.currency, sp.bank_exchange_rate, sp.actual_inr_amount, sp.forex_gain_loss,
  si.invoice_number, si.exchange_rate as invoice_exchange_rate, sd.draft_number, sd.client_name,
  ft.booking_inr_value, ft.actual_inr_value,
  CASE WHEN sp.forex_gain_loss > 0 THEN 'gain' WHEN sp.forex_gain_loss < 0 THEN 'loss' ELSE 'neutral' END as forex_status, sp.created_at
FROM shipment_invoice_payments sp
JOIN shipment_invoices si ON si.id = sp.invoice_id
JOIN shipment_drafts sd ON sd.id = si.shipment_draft_id
LEFT JOIN forex_transactions ft ON ft.payment_id = sp.id
WHERE sp.forex_gain_loss IS NOT NULL ORDER BY sp.payment_date DESC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forex_payment ON forex_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_forex_invoice ON forex_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_forex_shipment ON forex_transactions(shipment_draft_id);
CREATE INDEX IF NOT EXISTS idx_closure_container ON container_closure(groupage_container_id);
CREATE INDEX IF NOT EXISTS idx_closure_status ON container_closure(closure_status);
CREATE INDEX IF NOT EXISTS idx_payments_forex_gl ON shipment_invoice_payments(forex_gain_loss) WHERE forex_gain_loss IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_containers_closed_flag ON groupage_containers(is_closed) WHERE is_closed = true;
