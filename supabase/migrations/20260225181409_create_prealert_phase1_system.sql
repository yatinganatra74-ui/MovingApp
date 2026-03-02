/*
  # Create Pre-Alert Phase 1 System

  ## Overview
  Complete Phase 1 implementation for pre-alert processing and container/shipment linking.

  ## New Tables

  ### 1. `pre_alerts`
  Pre-alert information from overseas agents

  ### 2. `import_container_allocations`
  Link import_shipments to containers with CBM allocation

  ## Enhancements

  ### Containers Table
  Add pre-alert related fields

  ### Import Shipments Table
  Add draft mode and status tracking
*/

-- Add new columns to containers table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'agent_name') THEN
    ALTER TABLE containers ADD COLUMN agent_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'origin_country') THEN
    ALTER TABLE containers ADD COLUMN origin_country text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'eta_nhava_sheva') THEN
    ALTER TABLE containers ADD COLUMN eta_nhava_sheva date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'estimated_total_cbm') THEN
    ALTER TABLE containers ADD COLUMN estimated_total_cbm numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'estimated_container_cost') THEN
    ALTER TABLE containers ADD COLUMN estimated_container_cost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'actual_container_cost') THEN
    ALTER TABLE containers ADD COLUMN actual_container_cost numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'vessel_name') THEN
    ALTER TABLE containers ADD COLUMN vessel_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'voyage_number') THEN
    ALTER TABLE containers ADD COLUMN voyage_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'port_of_loading') THEN
    ALTER TABLE containers ADD COLUMN port_of_loading text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'shipping_line') THEN
    ALTER TABLE containers ADD COLUMN shipping_line text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'notes') THEN
    ALTER TABLE containers ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'created_by') THEN
    ALTER TABLE containers ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'created_at') THEN
    ALTER TABLE containers ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'updated_at') THEN
    ALTER TABLE containers ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create pre_alerts table
CREATE TABLE IF NOT EXISTS pre_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid REFERENCES containers(id) ON DELETE SET NULL,
  alert_date date DEFAULT CURRENT_DATE,
  agent_name text NOT NULL,
  agent_email text,
  bl_number text,
  total_packages integer DEFAULT 0,
  total_cbm numeric DEFAULT 0,
  total_weight_kg numeric DEFAULT 0,
  commodity_description text,
  special_instructions text,
  bl_copy_url text,
  packing_list_url text,
  invoice_copy_url text,
  status text DEFAULT 'received',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE pre_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pre_alerts"
  ON pre_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert pre_alerts"
  ON pre_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update pre_alerts"
  ON pre_alerts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete pre_alerts"
  ON pre_alerts FOR DELETE
  TO authenticated
  USING (true);

-- Create import_container_allocations table
CREATE TABLE IF NOT EXISTS import_container_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid REFERENCES containers(id) ON DELETE CASCADE,
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  allocated_cbm numeric DEFAULT 0,
  allocated_weight_kg numeric DEFAULT 0,
  allocation_percentage numeric DEFAULT 0,
  is_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(container_id, import_shipment_id)
);

ALTER TABLE import_container_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view import_container_allocations"
  ON import_container_allocations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert import_container_allocations"
  ON import_container_allocations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update import_container_allocations"
  ON import_container_allocations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete import_container_allocations"
  ON import_container_allocations FOR DELETE
  TO authenticated
  USING (true);

-- Add columns to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'import_shipments' AND column_name = 'shipment_status') THEN
    ALTER TABLE import_shipments ADD COLUMN shipment_status text DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'import_shipments' AND column_name = 'pre_alert_id') THEN
    ALTER TABLE import_shipments ADD COLUMN pre_alert_id uuid REFERENCES pre_alerts(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'import_shipments' AND column_name = 'is_draft') THEN
    ALTER TABLE import_shipments ADD COLUMN is_draft boolean DEFAULT true;
  END IF;
END $$;

-- Function: Create container from pre-alert
CREATE OR REPLACE FUNCTION create_container_from_prealert(
  p_container_number text,
  p_agent_name text,
  p_origin_country text,
  p_eta date,
  p_container_type text,
  p_estimated_cbm numeric,
  p_estimated_cost numeric,
  p_user_id uuid
)
RETURNS json AS $$
DECLARE
  v_container_id uuid;
  v_result json;
BEGIN
  SELECT id INTO v_container_id
  FROM containers
  WHERE container_number = p_container_number;
  
  IF v_container_id IS NOT NULL THEN
    UPDATE containers
    SET agent_name = p_agent_name,
        origin_country = p_origin_country,
        eta_nhava_sheva = p_eta,
        container_type = p_container_type,
        estimated_total_cbm = p_estimated_cbm,
        estimated_container_cost = p_estimated_cost,
        updated_at = now(),
        status = 'expected'
    WHERE id = v_container_id;
  ELSE
    INSERT INTO containers (
      container_number,
      agent_name,
      origin_country,
      eta_nhava_sheva,
      container_type,
      estimated_total_cbm,
      estimated_container_cost,
      status,
      created_by,
      capacity
    )
    VALUES (
      p_container_number,
      p_agent_name,
      p_origin_country,
      p_eta,
      p_container_type,
      p_estimated_cbm,
      p_estimated_cost,
      'expected',
      p_user_id,
      p_estimated_cbm
    )
    RETURNING id INTO v_container_id;
  END IF;
  
  v_result := json_build_object(
    'success', true,
    'container_id', v_container_id,
    'container_number', p_container_number,
    'status', 'expected'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Link import shipment to container
CREATE OR REPLACE FUNCTION link_import_to_container(
  p_container_id uuid,
  p_shipment_id uuid,
  p_allocated_cbm numeric DEFAULT 0,
  p_allocated_weight numeric DEFAULT 0
)
RETURNS json AS $$
DECLARE
  v_container_total_cbm numeric;
  v_used_cbm numeric;
  v_allocation_pct numeric;
  v_result json;
BEGIN
  SELECT estimated_total_cbm INTO v_container_total_cbm
  FROM containers
  WHERE id = p_container_id;
  
  IF v_container_total_cbm IS NULL THEN
    v_result := json_build_object(
      'success', false,
      'error', 'Container not found'
    );
    RETURN v_result;
  END IF;
  
  SELECT COALESCE(SUM(allocated_cbm), 0) INTO v_used_cbm
  FROM import_container_allocations
  WHERE container_id = p_container_id
    AND import_shipment_id != p_shipment_id;
  
  IF (v_used_cbm + p_allocated_cbm) > v_container_total_cbm THEN
    v_result := json_build_object(
      'success', false,
      'error', 'Insufficient container space',
      'available_cbm', v_container_total_cbm - v_used_cbm,
      'requested_cbm', p_allocated_cbm
    );
    RETURN v_result;
  END IF;
  
  IF v_container_total_cbm > 0 THEN
    v_allocation_pct := (p_allocated_cbm / v_container_total_cbm) * 100;
  ELSE
    v_allocation_pct := 0;
  END IF;
  
  INSERT INTO import_container_allocations (
    container_id,
    import_shipment_id,
    allocated_cbm,
    allocated_weight_kg,
    allocation_percentage,
    is_confirmed
  )
  VALUES (
    p_container_id,
    p_shipment_id,
    p_allocated_cbm,
    p_allocated_weight,
    v_allocation_pct,
    false
  )
  ON CONFLICT (container_id, import_shipment_id)
  DO UPDATE SET
    allocated_cbm = p_allocated_cbm,
    allocated_weight_kg = p_allocated_weight,
    allocation_percentage = v_allocation_pct,
    updated_at = now();
  
  v_result := json_build_object(
    'success', true,
    'allocated_cbm', p_allocated_cbm,
    'allocation_percentage', v_allocation_pct,
    'remaining_cbm', v_container_total_cbm - v_used_cbm - p_allocated_cbm
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Confirm shipment (exit draft mode)
CREATE OR REPLACE FUNCTION confirm_import_shipment(
  p_shipment_id uuid
)
RETURNS json AS $$
DECLARE
  v_result json;
  v_workflow_exists boolean;
BEGIN
  UPDATE import_shipments
  SET is_draft = false,
      shipment_status = 'confirmed',
      updated_at = now()
  WHERE id = p_shipment_id;
  
  UPDATE import_container_allocations
  SET is_confirmed = true,
      updated_at = now()
  WHERE import_shipment_id = p_shipment_id;
  
  SELECT EXISTS(
    SELECT 1 FROM shipment_workflow_status WHERE import_shipment_id = p_shipment_id
  ) INTO v_workflow_exists;
  
  IF v_workflow_exists THEN
    UPDATE workflow_stage_history
    SET completed_at = now(),
        duration_hours = EXTRACT(EPOCH FROM (now() - entered_at)) / 3600
    WHERE import_shipment_id = p_shipment_id
      AND stage_name = 'pre_alert'
      AND completed_at IS NULL;
    
    UPDATE shipment_workflow_status
    SET current_stage = 'vessel_departed',
        updated_at = now()
    WHERE import_shipment_id = p_shipment_id;
    
    INSERT INTO workflow_stage_history (
      import_shipment_id,
      stage_name,
      entered_at
    )
    VALUES (
      p_shipment_id,
      'vessel_departed',
      now()
    );
    
    INSERT INTO workflow_notifications (
      import_shipment_id,
      stage_name,
      notification_type,
      message
    )
    VALUES (
      p_shipment_id,
      'vessel_departed',
      'info',
      'Shipment confirmed - vessel departed'
    );
  END IF;
  
  v_result := json_build_object(
    'success', true,
    'shipment_id', p_shipment_id,
    'status', 'confirmed',
    'workflow_updated', v_workflow_exists
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create view for container utilization
CREATE OR REPLACE VIEW import_container_utilization AS
SELECT
  c.id as container_id,
  c.container_number,
  c.container_type,
  c.agent_name,
  c.origin_country,
  c.eta_nhava_sheva,
  c.estimated_total_cbm,
  c.estimated_container_cost,
  c.status,
  COALESCE(SUM(ica.allocated_cbm), 0) as used_cbm,
  c.estimated_total_cbm - COALESCE(SUM(ica.allocated_cbm), 0) as available_cbm,
  CASE
    WHEN c.estimated_total_cbm > 0 THEN
      ROUND((COALESCE(SUM(ica.allocated_cbm), 0) / c.estimated_total_cbm * 100)::numeric, 2)
    ELSE 0
  END as utilization_percentage,
  COUNT(ica.id) as shipment_count,
  COUNT(CASE WHEN ica.is_confirmed THEN 1 END) as confirmed_shipments,
  COUNT(CASE WHEN NOT ica.is_confirmed THEN 1 END) as draft_shipments
FROM containers c
LEFT JOIN import_container_allocations ica ON c.id = ica.container_id
GROUP BY c.id, c.container_number, c.container_type, c.agent_name, c.origin_country, 
         c.eta_nhava_sheva, c.estimated_total_cbm, c.estimated_container_cost, c.status;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_containers_status_eta ON containers(status, eta_nhava_sheva);
CREATE INDEX IF NOT EXISTS idx_pre_alerts_status ON pre_alerts(status);
CREATE INDEX IF NOT EXISTS idx_pre_alerts_container ON pre_alerts(container_id);
CREATE INDEX IF NOT EXISTS idx_import_container_alloc_container ON import_container_allocations(container_id);
CREATE INDEX IF NOT EXISTS idx_import_container_alloc_shipment ON import_container_allocations(import_shipment_id);
CREATE INDEX IF NOT EXISTS idx_import_shipments_draft_status ON import_shipments(is_draft, shipment_status);

-- Initialize existing records
UPDATE import_shipments
SET shipment_status = COALESCE(shipment_status, 'confirmed'),
    is_draft = COALESCE(is_draft, false)
WHERE shipment_status IS NULL OR is_draft IS NULL;
