/*
  # Container Cost Allocation Functions

  1. Container Cost Allocation Logic
    - Total Container CBM (from groupage_containers.total_capacity_cbm)
    - Shipment CBM (sum of cargo items)
    - Allocation % = (Shipment CBM / Total Container CBM) × 100
    - Allocated Container Cost = Container Cost × (Allocation % / 100)
    
  2. Functions
    - calculate_container_allocation: Auto-calculates based on CBM
    - override_container_allocation: Admin override capability
    - reset_container_allocation: Reset to auto-calculated
    
  3. Triggers
    - Auto-recalculate when cargo items change
    - Auto-recalculate when container is selected/changed
    
  4. Business Rules
    - Read-only by default (auto-calculated)
    - Updates automatically when cargo changes
    - Admin can override if needed
*/

-- Ensure allocation fields exist in import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'container_total_cost_inr'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN container_total_cost_inr decimal(12, 2);
  END IF;
END $$;

-- Function to calculate container cost allocation
CREATE OR REPLACE FUNCTION calculate_container_allocation(shipment_id uuid)
RETURNS void AS $$
DECLARE
  shipment_record RECORD;
  container_record RECORD;
  shipment_cbm decimal(10, 2);
  container_cbm decimal(10, 2);
  allocation_pct decimal(5, 2);
  allocated_cost decimal(12, 2);
BEGIN
  SELECT * INTO shipment_record
  FROM import_shipments
  WHERE id = shipment_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Only calculate if allocation is not overridden
  IF shipment_record.is_allocation_overridden = true THEN
    RETURN;
  END IF;
  
  -- Get container details
  SELECT * INTO container_record
  FROM groupage_containers
  WHERE id = shipment_record.container_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate shipment CBM from cargo items
  SELECT COALESCE(SUM(volume_cbm), 0) INTO shipment_cbm
  FROM import_shipment_cargo
  WHERE import_shipment_id = shipment_id;
  
  -- Get container CBM (using total_capacity_cbm field)
  container_cbm := COALESCE(container_record.total_capacity_cbm, 60);
  
  -- Calculate allocation percentage
  IF container_cbm > 0 THEN
    allocation_pct := (shipment_cbm / container_cbm) * 100;
  ELSE
    allocation_pct := 0;
  END IF;
  
  -- Calculate allocated cost using total_container_cost_inr field
  allocated_cost := COALESCE(container_record.total_container_cost_inr, 0) * (allocation_pct / 100);
  
  -- Update shipment
  UPDATE import_shipments
  SET 
    container_total_cbm = container_cbm,
    shipment_total_cbm = shipment_cbm,
    allocation_percentage = allocation_pct,
    container_total_cost_inr = container_record.total_container_cost_inr,
    allocated_container_cost_inr = allocated_cost
  WHERE id = shipment_id;
  
END;
$$ LANGUAGE plpgsql;

-- Function to override container allocation (admin only)
CREATE OR REPLACE FUNCTION override_container_allocation(
  shipment_id uuid,
  new_allocated_cost decimal(12, 2),
  override_reason text,
  admin_user_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE import_shipments
  SET 
    allocated_container_cost_inr = new_allocated_cost,
    container_cost_override = new_allocated_cost,
    is_allocation_overridden = true,
    allocation_override_by = admin_user_id,
    allocation_override_at = now(),
    allocation_override_reason = override_reason
  WHERE id = shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset allocation to auto-calculated
CREATE OR REPLACE FUNCTION reset_container_allocation(shipment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE import_shipments
  SET 
    is_allocation_overridden = false,
    container_cost_override = NULL,
    allocation_override_by = NULL,
    allocation_override_at = NULL,
    allocation_override_reason = NULL
  WHERE id = shipment_id;
  
  -- Recalculate
  PERFORM calculate_container_allocation(shipment_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate allocation when cargo changes
CREATE OR REPLACE FUNCTION trigger_recalculate_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate for the shipment
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_container_allocation(OLD.import_shipment_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_container_allocation(NEW.import_shipment_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cargo_allocation_recalc ON import_shipment_cargo;

CREATE TRIGGER trigger_cargo_allocation_recalc
  AFTER INSERT OR UPDATE OR DELETE
  ON import_shipment_cargo
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_allocation();

-- Trigger to calculate allocation when container is selected
CREATE OR REPLACE FUNCTION trigger_calculate_allocation_on_container()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if container changed and allocation is not overridden
  IF NEW.container_id IS NOT NULL AND 
     (OLD.container_id IS NULL OR OLD.container_id != NEW.container_id) AND
     COALESCE(NEW.is_allocation_overridden, false) = false THEN
    PERFORM calculate_container_allocation(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_shipment_container_allocation ON import_shipments;

CREATE TRIGGER trigger_shipment_container_allocation
  AFTER INSERT OR UPDATE OF container_id
  ON import_shipments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_allocation_on_container();

-- Update existing containers with example costs if they don't have them
UPDATE groupage_containers
SET total_container_cost_inr = 
  CASE 
    WHEN container_type = '20ft' THEN 150000
    WHEN container_type = '40ft' THEN 250000
    WHEN container_type = '40ft HC' THEN 275000
    ELSE 200000
  END
WHERE total_container_cost_inr IS NULL OR total_container_cost_inr = 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_container_allocation 
  ON import_shipments(container_id, allocation_percentage);

CREATE INDEX IF NOT EXISTS idx_shipments_allocation_override 
  ON import_shipments(is_allocation_overridden, allocation_override_by);

-- Comments
COMMENT ON COLUMN import_shipments.container_total_cbm IS 'Total CBM capacity of the container (auto-pulled from container)';
COMMENT ON COLUMN import_shipments.shipment_total_cbm IS 'Total CBM of this shipment cargo items (auto-calculated from cargo)';
COMMENT ON COLUMN import_shipments.allocation_percentage IS 'Percentage of container used: (Shipment CBM / Container CBM) × 100';
COMMENT ON COLUMN import_shipments.container_total_cost_inr IS 'Total cost of the container in INR (auto-pulled from container)';
COMMENT ON COLUMN import_shipments.allocated_container_cost_inr IS 'Cost allocated to this shipment: Container Cost × (Allocation % / 100)';
COMMENT ON COLUMN import_shipments.is_allocation_overridden IS 'True if admin manually overrode the allocation';
COMMENT ON COLUMN import_shipments.container_cost_override IS 'Manual override value set by admin';
COMMENT ON COLUMN import_shipments.allocation_override_by IS 'Admin user who overrode the allocation';
COMMENT ON COLUMN import_shipments.allocation_override_at IS 'Timestamp when allocation was overridden';
COMMENT ON COLUMN import_shipments.allocation_override_reason IS 'Reason for manual override';

COMMENT ON COLUMN groupage_containers.total_container_cost_inr IS 'Total cost of the container in INR (used for cost allocation)';
COMMENT ON COLUMN groupage_containers.cost_breakdown IS 'JSON breakdown of cost components (freight, customs, handling, etc)';
COMMENT ON COLUMN groupage_containers.total_capacity_cbm IS 'Total CBM capacity of the container';

COMMENT ON FUNCTION calculate_container_allocation IS 'Auto-calculates container cost allocation based on CBM percentage';
COMMENT ON FUNCTION override_container_allocation IS 'Allows admin to manually override container cost allocation';
COMMENT ON FUNCTION reset_container_allocation IS 'Resets allocation back to auto-calculated mode';