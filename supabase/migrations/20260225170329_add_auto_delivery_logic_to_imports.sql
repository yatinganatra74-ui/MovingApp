/*
  # Add Auto-Delivery Logic to Import Shipments

  1. Schema Changes
    - Add delivery_included boolean field to import_shipments
    - Auto-determined based on Metro/Non-Metro classification
    - Add trucking-related fields for Non-Metro deliveries

  2. Business Logic
    - Metro City → Delivery Included = Yes (No trucking section needed)
    - Non-Metro City → Delivery Included = No (Trucking section appears)
    
  3. Trucking Fields (for Non-Metro)
    - Trucking cost, distance, vendor details
    - Revenue and cost tracking for trucking operations

  4. Notes
    - This implements the auto-logic trigger based on delivery zone type
    - Simplifies data entry by auto-determining delivery inclusion
    - Ensures proper tracking of additional trucking costs for Non-Metro deliveries
*/

-- Add delivery inclusion and trucking fields to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'delivery_included'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN delivery_included boolean DEFAULT false,
    ADD COLUMN requires_trucking boolean DEFAULT false,
    ADD COLUMN trucking_distance_km decimal(10, 2),
    ADD COLUMN trucking_vendor text,
    ADD COLUMN trucking_cost_revenue decimal(12, 2),
    ADD COLUMN trucking_cost_actual decimal(12, 2),
    ADD COLUMN trucking_vehicle_type text,
    ADD COLUMN trucking_from_location text,
    ADD COLUMN trucking_to_location text,
    ADD COLUMN trucking_notes text,
    ADD COLUMN trucking_billable boolean DEFAULT true;
  END IF;
END $$;

-- Create a function to auto-determine delivery inclusion based on zone type
CREATE OR REPLACE FUNCTION auto_determine_delivery_inclusion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_zone_type = 'Metro' THEN
    NEW.delivery_included := true;
    NEW.requires_trucking := false;
  ELSIF NEW.delivery_zone_type = 'Non-Metro' THEN
    NEW.delivery_included := false;
    NEW.requires_trucking := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set delivery inclusion on insert/update
DROP TRIGGER IF EXISTS trigger_auto_delivery_inclusion ON import_shipments;

CREATE TRIGGER trigger_auto_delivery_inclusion
  BEFORE INSERT OR UPDATE OF delivery_zone_type
  ON import_shipments
  FOR EACH ROW
  EXECUTE FUNCTION auto_determine_delivery_inclusion();

-- Comments
COMMENT ON COLUMN import_shipments.delivery_included IS 'Auto: Yes for Metro, No for Non-Metro deliveries';
COMMENT ON COLUMN import_shipments.requires_trucking IS 'Auto: false for Metro, true for Non-Metro';
COMMENT ON COLUMN import_shipments.trucking_distance_km IS 'Distance in kilometers for trucking (Non-Metro only)';
COMMENT ON COLUMN import_shipments.trucking_vendor IS 'Trucking vendor/transporter name';
COMMENT ON COLUMN import_shipments.trucking_cost_revenue IS 'Revenue charged to customer for trucking';
COMMENT ON COLUMN import_shipments.trucking_cost_actual IS 'Actual cost paid to trucking vendor';
COMMENT ON COLUMN import_shipments.trucking_vehicle_type IS 'Type of vehicle used (e.g., 32ft trailer, 20ft truck)';
COMMENT ON COLUMN import_shipments.trucking_from_location IS 'Trucking pickup location (typically port)';
COMMENT ON COLUMN import_shipments.trucking_to_location IS 'Trucking delivery location';
COMMENT ON COLUMN import_shipments.trucking_notes IS 'Additional notes for trucking operations';
COMMENT ON COLUMN import_shipments.trucking_billable IS 'Whether trucking cost is billable to customer';

-- Create index for delivery inclusion queries
CREATE INDEX IF NOT EXISTS idx_import_shipments_delivery_included 
  ON import_shipments(delivery_included);

CREATE INDEX IF NOT EXISTS idx_import_shipments_requires_trucking 
  ON import_shipments(requires_trucking);