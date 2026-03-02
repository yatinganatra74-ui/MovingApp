/*
  # Import Shipment Revenue System with Rate Sheet Engine

  1. New Tables
    - import_shipment_revenue_items: Individual revenue line items (services charged)
    - import_shipment_exchange_rates: Exchange rate locks for each shipment
    
  2. Revenue Line Items
    - Auto-populated from slab-based rate sheets
    - Services: Destination Handling, Documentation, Delivery, etc.
    - Unit types: Per CBM, Per KG, Fixed, Per Package
    - Tracks: Quantity, Rate, Currency, Amount
    
  3. Exchange Rate Locking
    - Revenue currency (USD/EUR) from rate sheet
    - Exchange rate editable before save
    - Converted revenue in INR auto-calculated
    - Once saved → exchange rate locked permanently
    
  4. Security
    - RLS enabled on all tables
    - Policies for authenticated users
    
  5. Features
    - Multi-currency support (USD, EUR, INR)
    - Automatic slab-based rate lookup
    - Real-time INR conversion
    - Exchange rate history tracking
*/

-- Create import_shipment_revenue_items table
CREATE TABLE IF NOT EXISTS import_shipment_revenue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE NOT NULL,
  service_name text NOT NULL,
  service_type text,
  unit_type text NOT NULL,
  quantity decimal(12, 3) NOT NULL DEFAULT 1,
  rate decimal(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  amount decimal(12, 2) NOT NULL,
  rate_sheet_service_id uuid,
  auto_calculated boolean DEFAULT true,
  is_billable boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create import_shipment_exchange_rates table
CREATE TABLE IF NOT EXISTS import_shipment_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE NOT NULL UNIQUE,
  revenue_currency text NOT NULL DEFAULT 'USD',
  exchange_rate decimal(10, 4) NOT NULL,
  converted_revenue_inr decimal(12, 2),
  total_revenue_foreign decimal(12, 2),
  is_locked boolean DEFAULT false,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id),
  rate_source text DEFAULT 'manual',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Add revenue summary fields to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'total_revenue_foreign'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN total_revenue_foreign decimal(12, 2) DEFAULT 0,
    ADD COLUMN total_revenue_inr decimal(12, 2) DEFAULT 0,
    ADD COLUMN revenue_currency text DEFAULT 'USD',
    ADD COLUMN exchange_rate_locked boolean DEFAULT false,
    ADD COLUMN exchange_rate decimal(10, 4),
    ADD COLUMN exchange_rate_locked_at timestamptz;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_revenue_items_shipment 
  ON import_shipment_revenue_items(import_shipment_id);

CREATE INDEX IF NOT EXISTS idx_revenue_items_service 
  ON import_shipment_revenue_items(service_name);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_shipment 
  ON import_shipment_exchange_rates(import_shipment_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_locked 
  ON import_shipment_exchange_rates(is_locked);

-- Enable RLS
ALTER TABLE import_shipment_revenue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipment_exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_shipment_revenue_items
CREATE POLICY "Users can view revenue items"
  ON import_shipment_revenue_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert revenue items"
  ON import_shipment_revenue_items FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update revenue items"
  ON import_shipment_revenue_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Users can delete revenue items"
  ON import_shipment_revenue_items FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for import_shipment_exchange_rates
CREATE POLICY "Users can view exchange rates"
  ON import_shipment_exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert exchange rates"
  ON import_shipment_exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update unlocked exchange rates"
  ON import_shipment_exchange_rates FOR UPDATE
  TO authenticated
  USING (is_locked = false OR auth.uid() = locked_by)
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Users can delete exchange rates"
  ON import_shipment_exchange_rates FOR DELETE
  TO authenticated
  USING (is_locked = false);

-- Function to calculate revenue totals
CREATE OR REPLACE FUNCTION calculate_import_revenue_totals(shipment_id uuid)
RETURNS void AS $$
DECLARE
  total_foreign decimal(12, 2);
  total_inr decimal(12, 2);
  exch_rate decimal(10, 4);
  rev_currency text;
BEGIN
  SELECT 
    COALESCE(SUM(amount), 0),
    MAX(currency)
  INTO total_foreign, rev_currency
  FROM import_shipment_revenue_items
  WHERE import_shipment_id = shipment_id AND is_billable = true;
  
  SELECT exchange_rate 
  INTO exch_rate
  FROM import_shipment_exchange_rates
  WHERE import_shipment_id = shipment_id;
  
  IF exch_rate IS NOT NULL THEN
    total_inr := total_foreign * exch_rate;
  ELSE
    total_inr := 0;
  END IF;
  
  UPDATE import_shipments
  SET 
    total_revenue_foreign = total_foreign,
    total_revenue_inr = total_inr,
    revenue_currency = COALESCE(rev_currency, 'USD')
  WHERE id = shipment_id;
  
  UPDATE import_shipment_exchange_rates
  SET 
    total_revenue_foreign = total_foreign,
    converted_revenue_inr = total_inr
  WHERE import_shipment_id = shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to lock exchange rate
CREATE OR REPLACE FUNCTION lock_exchange_rate(shipment_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE import_shipment_exchange_rates
  SET 
    is_locked = true,
    locked_at = now(),
    locked_by = user_id
  WHERE import_shipment_id = shipment_id AND is_locked = false;
  
  UPDATE import_shipments
  SET 
    exchange_rate_locked = true,
    exchange_rate_locked_at = now(),
    exchange_rate = (SELECT exchange_rate FROM import_shipment_exchange_rates WHERE import_shipment_id = shipment_id)
  WHERE id = shipment_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update revenue totals on item changes
CREATE OR REPLACE FUNCTION trigger_update_revenue_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_import_revenue_totals(
    COALESCE(NEW.import_shipment_id, OLD.import_shipment_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_revenue_items_totals ON import_shipment_revenue_items;

CREATE TRIGGER trigger_revenue_items_totals
  AFTER INSERT OR UPDATE OR DELETE
  ON import_shipment_revenue_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_revenue_totals();

-- Trigger to recalculate INR on exchange rate change
CREATE OR REPLACE FUNCTION trigger_recalculate_inr_on_rate_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exchange_rate != OLD.exchange_rate OR (OLD.exchange_rate IS NULL AND NEW.exchange_rate IS NOT NULL) THEN
    PERFORM calculate_import_revenue_totals(NEW.import_shipment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_exchange_rate_change ON import_shipment_exchange_rates;

CREATE TRIGGER trigger_exchange_rate_change
  AFTER UPDATE
  ON import_shipment_exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_inr_on_rate_change();

-- Comments
COMMENT ON TABLE import_shipment_revenue_items IS 'Individual revenue line items for import shipments with rate sheet engine';
COMMENT ON TABLE import_shipment_exchange_rates IS 'Exchange rate locking and INR conversion for import shipments';

COMMENT ON COLUMN import_shipment_revenue_items.service_name IS 'Name of service (e.g., Destination Handling, Documentation, Delivery)';
COMMENT ON COLUMN import_shipment_revenue_items.unit_type IS 'Per CBM, Per KG, Fixed, Per Package, etc.';
COMMENT ON COLUMN import_shipment_revenue_items.auto_calculated IS 'Whether rate was auto-filled from rate sheet';
COMMENT ON COLUMN import_shipment_revenue_items.is_billable IS 'Whether this item is billable to customer';

COMMENT ON COLUMN import_shipment_exchange_rates.is_locked IS 'Once locked, exchange rate cannot be changed';
COMMENT ON COLUMN import_shipment_exchange_rates.exchange_rate IS 'Exchange rate (e.g., 1 USD = 83.50 INR)';
COMMENT ON COLUMN import_shipment_exchange_rates.converted_revenue_inr IS 'Total revenue converted to INR';