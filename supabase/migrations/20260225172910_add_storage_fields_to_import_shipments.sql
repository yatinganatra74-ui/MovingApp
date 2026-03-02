/*
  # Add Storage Fields to Import Shipments

  1. Storage Fields
    - Links to storage_rate_sheets for free days
    - Storage start date (auto from ATA + 1)
    - Delivery date (manual)
    - Chargeable days calculation
    - Storage amount calculation
    - Billable to agent flag
    
  2. Auto-Calculation
    - Storage start = ATA + 1 day
    - Total days = Delivery Date - Storage Start (or Current Date if no delivery)
    - Chargeable days = Total Days - Free Days
    - Find applicable slab
    - Amount = Chargeable Days × Rate × CBM
*/

-- Add storage fields to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'storage_rate_sheet_id'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN storage_rate_sheet_id uuid REFERENCES storage_rate_sheets(id),
    ADD COLUMN storage_free_days integer DEFAULT 0,
    ADD COLUMN storage_start_date date,
    ADD COLUMN storage_delivery_date date,
    ADD COLUMN storage_total_days integer DEFAULT 0,
    ADD COLUMN storage_chargeable_days integer DEFAULT 0,
    ADD COLUMN storage_rate_slab_id uuid REFERENCES storage_rate_slabs(id),
    ADD COLUMN storage_rate_per_day_per_cbm decimal(10, 2),
    ADD COLUMN storage_amount_inr decimal(12, 2) DEFAULT 0,
    ADD COLUMN storage_billable_to_agent boolean DEFAULT false,
    ADD COLUMN storage_notes text,
    ADD COLUMN storage_last_calculated timestamptz;
  END IF;
END $$;

-- Function to calculate storage charges for import shipment
CREATE OR REPLACE FUNCTION calculate_import_storage_charges(shipment_id uuid)
RETURNS void AS $$
DECLARE
  shipment_record RECORD;
  rate_sheet_record RECORD;
  slab_record RECORD;
  storage_start date;
  storage_end date;
  total_days integer;
  free_days integer;
  chargeable_days integer;
  storage_amount decimal(12, 2);
  rate_per_day decimal(10, 2);
BEGIN
  SELECT * INTO shipment_record
  FROM import_shipments
  WHERE id = shipment_id;
  
  IF NOT FOUND OR shipment_record.ata IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate storage start date (ATA + 1 day)
  storage_start := shipment_record.ata + INTERVAL '1 day';
  
  -- Determine storage end date
  IF shipment_record.storage_delivery_date IS NOT NULL THEN
    storage_end := shipment_record.storage_delivery_date;
  ELSE
    storage_end := CURRENT_DATE;
  END IF;
  
  -- Calculate total days
  total_days := storage_end - storage_start;
  IF total_days < 0 THEN
    total_days := 0;
  END IF;
  
  -- Get storage rate sheet and free days
  free_days := 0;
  IF shipment_record.storage_rate_sheet_id IS NOT NULL THEN
    SELECT * INTO rate_sheet_record
    FROM storage_rate_sheets
    WHERE id = shipment_record.storage_rate_sheet_id;
    
    IF FOUND THEN
      free_days := COALESCE(rate_sheet_record.free_days, 0);
    END IF;
  END IF;
  
  -- Override with manual free days if set
  IF shipment_record.storage_free_days IS NOT NULL AND shipment_record.storage_free_days > 0 THEN
    free_days := shipment_record.storage_free_days;
  END IF;
  
  -- Calculate chargeable days
  chargeable_days := total_days - free_days;
  IF chargeable_days < 0 THEN
    chargeable_days := 0;
  END IF;
  
  -- Find applicable storage slab
  IF shipment_record.storage_rate_sheet_id IS NOT NULL THEN
    SELECT * INTO slab_record
    FROM storage_rate_slabs
    WHERE storage_rate_sheet_id = shipment_record.storage_rate_sheet_id
      AND from_days <= total_days
      AND (to_days IS NULL OR to_days >= total_days)
    ORDER BY from_days DESC
    LIMIT 1;
    
    IF FOUND THEN
      rate_per_day := COALESCE(slab_record.rate_per_unit_per_day, 0);
      
      -- Calculate storage amount (Chargeable Days × Rate × CBM)
      storage_amount := chargeable_days * rate_per_day * COALESCE(shipment_record.total_volume_cbm, 0);
      
      -- Update shipment
      UPDATE import_shipments
      SET 
        storage_start_date = storage_start,
        storage_free_days = free_days,
        storage_total_days = total_days,
        storage_chargeable_days = chargeable_days,
        storage_rate_slab_id = slab_record.id,
        storage_rate_per_day_per_cbm = rate_per_day,
        storage_amount_inr = storage_amount,
        storage_last_calculated = now()
      WHERE id = shipment_id;
    END IF;
  ELSE
    -- No rate sheet, just update dates and days
    UPDATE import_shipments
    SET 
      storage_start_date = storage_start,
      storage_free_days = free_days,
      storage_total_days = total_days,
      storage_chargeable_days = chargeable_days,
      storage_amount_inr = 0,
      storage_last_calculated = now()
    WHERE id = shipment_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate storage when relevant dates change
CREATE OR REPLACE FUNCTION trigger_recalculate_import_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ata IS NOT NULL AND 
     (OLD.ata IS NULL OR 
      OLD.ata != NEW.ata OR 
      OLD.storage_delivery_date IS DISTINCT FROM NEW.storage_delivery_date OR
      OLD.storage_rate_sheet_id IS DISTINCT FROM NEW.storage_rate_sheet_id OR
      OLD.storage_free_days IS DISTINCT FROM NEW.storage_free_days) THEN
    PERFORM calculate_import_storage_charges(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_import_shipment_storage_calc ON import_shipments;

CREATE TRIGGER trigger_import_shipment_storage_calc
  AFTER INSERT OR UPDATE OF ata, storage_delivery_date, storage_rate_sheet_id, storage_free_days
  ON import_shipments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_import_storage();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_shipments_storage_rate_sheet 
  ON import_shipments(storage_rate_sheet_id);

CREATE INDEX IF NOT EXISTS idx_import_shipments_storage_billing 
  ON import_shipments(storage_billable_to_agent, storage_chargeable_days);

-- Comments
COMMENT ON COLUMN import_shipments.storage_rate_sheet_id IS 'Link to storage rate sheet for free days and rate slabs';
COMMENT ON COLUMN import_shipments.storage_free_days IS 'Free storage days (from rate sheet or manual override)';
COMMENT ON COLUMN import_shipments.storage_start_date IS 'Auto-calculated: ATA + 1 day';
COMMENT ON COLUMN import_shipments.storage_delivery_date IS 'Manual entry: actual delivery date (if known)';
COMMENT ON COLUMN import_shipments.storage_total_days IS 'Total days in storage: Delivery Date - Storage Start Date';
COMMENT ON COLUMN import_shipments.storage_chargeable_days IS 'Chargeable Days: Total Days - Free Days (must be >= 0)';
COMMENT ON COLUMN import_shipments.storage_rate_slab_id IS 'Auto-selected slab based on total days';
COMMENT ON COLUMN import_shipments.storage_rate_per_day_per_cbm IS 'Rate per day per CBM from selected slab';
COMMENT ON COLUMN import_shipments.storage_amount_inr IS 'Auto-calculated: Chargeable Days × Rate × CBM';
COMMENT ON COLUMN import_shipments.storage_billable_to_agent IS 'If true, charge agent for storage (links to monthly invoicing)';
COMMENT ON COLUMN import_shipments.storage_last_calculated IS 'Timestamp of last storage calculation';

COMMENT ON FUNCTION calculate_import_storage_charges IS 'Auto-calculates storage charges for import shipment based on dates, free days, and rate slabs';