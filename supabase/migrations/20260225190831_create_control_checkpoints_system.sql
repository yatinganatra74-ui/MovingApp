/*
  # Control Checkpoints & Workflow Validation System
  
  ## Purpose
  
  Enforce business rules and prevent workflow progression when critical requirements aren't met.
  
  ## Checkpoints Required
  
  ### 1. Exchange Rate Lock
  **Blocks:** Invoice generation, profit calculation
  **Requirement:** Exchange rate must be locked before proceeding
  **Reason:** Prevent currency fluctuation impact on financials
  
  ### 2. Container Costs Entry
  **Blocks:** Container closure, profit finalization
  **Requirement:** All container costs must be entered
  **Reason:** Accurate profit calculation requires complete cost data
  
  ### 3. Storage Review
  **Blocks:** Final delivery, invoice generation
  **Requirement:** Storage charges must be reviewed and confirmed
  **Reason:** Ensure all storage costs captured before billing
  
  ### 4. Minimum Margin
  **Blocks:** Invoice generation (soft block)
  **Requirement:** Profit margin must meet minimum threshold
  **Override:** Admin can approve below-minimum margins
  **Reason:** Protect business profitability
  
  ### 5. Trucking Cost (Non-Metro)
  **Blocks:** Delivery confirmation
  **Requirement:** Trucking costs required for non-metro deliveries
  **Reason:** Non-metro deliveries always incur trucking expenses
  
  ## Tables Created
  
  1. workflow_checkpoints - Checkpoint definitions
  2. checkpoint_validations - Validation results per shipment
  3. checkpoint_overrides - Admin override records
  4. system_settings - Configuration (minimum margins, metro cities)
  
  ## Validation Logic
  
  Each checkpoint validates specific conditions:
  - Returns pass/fail status
  - Provides blocking/warning severity
  - Records validation timestamp
  - Tracks who validated
  - Allows admin overrides with reason
  
  ## Workflow Integration
  
  Before allowing progression to next stage:
  1. Run all applicable checkpoints
  2. Check for blocking failures
  3. Allow admin override if configured
  4. Record validation results
  5. Proceed or show blockers
*/

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view settings" ON system_settings;
CREATE POLICY "Users can view settings" ON system_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;
CREATE POLICY "Admins can manage settings" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('minimum_profit_margin', '{"percent": 10, "currency": "USD"}', 'Minimum profit margin percentage required'),
  ('metro_cities', '{"cities": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad"]}', 'List of metro cities (no mandatory trucking)'),
  ('checkpoint_config', '{"exchange_rate_lock_required": true, "container_costs_required": true, "storage_review_required": true, "trucking_cost_required_non_metro": true}', 'Global checkpoint configuration')
ON CONFLICT (setting_key) DO NOTHING;

-- Workflow checkpoints table
CREATE TABLE IF NOT EXISTS workflow_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_code text UNIQUE NOT NULL,
  checkpoint_name text NOT NULL,
  description text,
  severity text DEFAULT 'blocking' CHECK (severity IN ('blocking', 'warning', 'info')),
  is_active boolean DEFAULT true,
  applies_to text[] DEFAULT ARRAY['shipment'],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view checkpoints" ON workflow_checkpoints;
CREATE POLICY "Users can view checkpoints" ON workflow_checkpoints FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage checkpoints" ON workflow_checkpoints;
CREATE POLICY "Admins can manage checkpoints" ON workflow_checkpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert checkpoint definitions
INSERT INTO workflow_checkpoints (checkpoint_code, checkpoint_name, description, severity, applies_to) VALUES
  ('EXCHANGE_RATE_LOCK', 'Exchange Rate Locked', 'Exchange rate must be locked before invoice generation', 'blocking', ARRAY['shipment', 'invoice']),
  ('CONTAINER_COSTS_ENTERED', 'Container Costs Entered', 'All container costs must be entered before closure', 'blocking', ARRAY['container']),
  ('STORAGE_REVIEWED', 'Storage Charges Reviewed', 'Storage charges must be reviewed before final delivery', 'blocking', ARRAY['shipment']),
  ('MINIMUM_MARGIN', 'Minimum Profit Margin', 'Profit margin must meet minimum threshold', 'warning', ARRAY['shipment', 'invoice']),
  ('TRUCKING_COST_NON_METRO', 'Trucking Cost for Non-Metro', 'Trucking costs required for non-metro deliveries', 'blocking', ARRAY['shipment', 'delivery'])
ON CONFLICT (checkpoint_code) DO NOTHING;

-- Checkpoint validations table
CREATE TABLE IF NOT EXISTS checkpoint_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_code text NOT NULL REFERENCES workflow_checkpoints(checkpoint_code) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('shipment', 'container', 'invoice', 'delivery')),
  entity_id uuid NOT NULL,
  
  validation_status text DEFAULT 'pending' CHECK (validation_status IN ('pending', 'pass', 'fail', 'overridden')),
  is_blocking boolean DEFAULT false,
  
  validation_message text,
  validation_details jsonb,
  
  validated_at timestamptz DEFAULT now(),
  validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE checkpoint_validations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view validations" ON checkpoint_validations;
CREATE POLICY "Users can view validations" ON checkpoint_validations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can create validations" ON checkpoint_validations;
CREATE POLICY "Users can create validations" ON checkpoint_validations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update validations" ON checkpoint_validations;
CREATE POLICY "Users can update validations" ON checkpoint_validations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Checkpoint overrides table
CREATE TABLE IF NOT EXISTS checkpoint_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id uuid REFERENCES checkpoint_validations(id) ON DELETE CASCADE,
  checkpoint_code text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  
  override_reason text NOT NULL,
  override_notes text,
  
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  overridden_at timestamptz DEFAULT now(),
  
  requires_approval boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz
);

ALTER TABLE checkpoint_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view overrides" ON checkpoint_overrides;
CREATE POLICY "Users can view overrides" ON checkpoint_overrides FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage overrides" ON checkpoint_overrides;
CREATE POLICY "Admins can manage overrides" ON checkpoint_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add checkpoint fields to shipment_drafts
ALTER TABLE shipment_drafts
ADD COLUMN IF NOT EXISTS exchange_rate_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exchange_rate_locked_at timestamptz,
ADD COLUMN IF NOT EXISTS exchange_rate_locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS storage_reviewed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS storage_reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS storage_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS checkpoints_passed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_checkpoints jsonb DEFAULT '[]'::jsonb;

-- Add checkpoint fields to groupage_containers
ALTER TABLE groupage_containers
ADD COLUMN IF NOT EXISTS costs_entered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS costs_entered_at timestamptz,
ADD COLUMN IF NOT EXISTS costs_entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Function: Check exchange rate lock
DROP FUNCTION IF EXISTS check_exchange_rate_lock(uuid) CASCADE;
CREATE FUNCTION check_exchange_rate_lock(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_ship record;
  v_status text;
  v_msg text;
BEGIN
  SELECT * INTO v_ship FROM shipment_drafts WHERE id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('pass', false, 'message', 'Shipment not found'); END IF;
  
  IF v_ship.exchange_rate_locked = true THEN
    v_status := 'pass';
    v_msg := 'Exchange rate is locked';
  ELSE
    v_status := 'fail';
    v_msg := 'Exchange rate must be locked before proceeding';
  END IF;
  
  INSERT INTO checkpoint_validations (checkpoint_code, entity_type, entity_id, validation_status, is_blocking, validation_message, validated_by)
  VALUES ('EXCHANGE_RATE_LOCK', 'shipment', p_shipment_id, v_status, true, v_msg, auth.uid());
  
  RETURN json_build_object('pass', v_status = 'pass', 'blocking', true, 'message', v_msg);
END; $$;

-- Function: Check container costs entered
DROP FUNCTION IF EXISTS check_container_costs(uuid) CASCADE;
CREATE FUNCTION check_container_costs(p_container_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_cont record;
  v_status text;
  v_msg text;
BEGIN
  SELECT * INTO v_cont FROM groupage_containers WHERE id = p_container_id;
  IF NOT FOUND THEN RETURN json_build_object('pass', false, 'message', 'Container not found'); END IF;
  
  IF v_cont.costs_entered = true AND v_cont.total_cost > 0 THEN
    v_status := 'pass';
    v_msg := 'Container costs have been entered';
  ELSE
    v_status := 'fail';
    v_msg := 'Container costs must be entered before closure';
  END IF;
  
  INSERT INTO checkpoint_validations (checkpoint_code, entity_type, entity_id, validation_status, is_blocking, validation_message, validated_by)
  VALUES ('CONTAINER_COSTS_ENTERED', 'container', p_container_id, v_status, true, v_msg, auth.uid());
  
  RETURN json_build_object('pass', v_status = 'pass', 'blocking', true, 'message', v_msg);
END; $$;

-- Function: Check storage review
DROP FUNCTION IF EXISTS check_storage_review(uuid) CASCADE;
CREATE FUNCTION check_storage_review(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_ship record;
  v_has_storage boolean;
  v_status text;
  v_msg text;
BEGIN
  SELECT * INTO v_ship FROM shipment_drafts WHERE id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('pass', false, 'message', 'Shipment not found'); END IF;
  
  v_has_storage := COALESCE(v_ship.storage_days, 0) > 0 OR COALESCE(v_ship.cost_storage, 0) > 0;
  
  IF NOT v_has_storage THEN
    v_status := 'pass';
    v_msg := 'No storage charges to review';
  ELSIF v_ship.storage_reviewed = true THEN
    v_status := 'pass';
    v_msg := 'Storage charges have been reviewed';
  ELSE
    v_status := 'fail';
    v_msg := 'Storage charges must be reviewed before delivery';
  END IF;
  
  INSERT INTO checkpoint_validations (checkpoint_code, entity_type, entity_id, validation_status, is_blocking, validation_message, validated_by)
  VALUES ('STORAGE_REVIEWED', 'shipment', p_shipment_id, v_status, true, v_msg, auth.uid());
  
  RETURN json_build_object('pass', v_status = 'pass', 'blocking', true, 'message', v_msg, 'has_storage', v_has_storage);
END; $$;

-- Function: Check minimum margin
DROP FUNCTION IF EXISTS check_minimum_margin(uuid) CASCADE;
CREATE FUNCTION check_minimum_margin(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_ship record;
  v_min_margin numeric;
  v_actual_margin numeric;
  v_status text;
  v_msg text;
BEGIN
  SELECT * INTO v_ship FROM shipment_drafts WHERE id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('pass', false, 'message', 'Shipment not found'); END IF;
  
  SELECT (setting_value->>'percent')::numeric INTO v_min_margin FROM system_settings WHERE setting_key = 'minimum_profit_margin';
  v_min_margin := COALESCE(v_min_margin, 10);
  
  v_actual_margin := COALESCE(v_ship.profit_margin_percent, 0);
  
  IF v_actual_margin >= v_min_margin THEN
    v_status := 'pass';
    v_msg := format('Margin %.2f%% meets minimum %.2f%%', v_actual_margin, v_min_margin);
  ELSE
    v_status := 'fail';
    v_msg := format('Margin %.2f%% below minimum %.2f%% - requires admin override', v_actual_margin, v_min_margin);
  END IF;
  
  INSERT INTO checkpoint_validations (checkpoint_code, entity_type, entity_id, validation_status, is_blocking, validation_message, validated_by, validation_details)
  VALUES ('MINIMUM_MARGIN', 'shipment', p_shipment_id, v_status, false, v_msg, auth.uid(), 
    json_build_object('actual_margin', v_actual_margin, 'minimum_margin', v_min_margin)::jsonb);
  
  RETURN json_build_object('pass', v_status = 'pass', 'blocking', false, 'message', v_msg, 'actual_margin', v_actual_margin, 'minimum_margin', v_min_margin, 'requires_override', v_status = 'fail');
END; $$;

-- Function: Check trucking cost for non-metro
DROP FUNCTION IF EXISTS check_trucking_cost_non_metro(uuid) CASCADE;
CREATE FUNCTION check_trucking_cost_non_metro(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_ship record;
  v_metro_cities jsonb;
  v_is_metro boolean;
  v_has_trucking boolean;
  v_status text;
  v_msg text;
BEGIN
  SELECT * INTO v_ship FROM shipment_drafts WHERE id = p_shipment_id;
  IF NOT FOUND THEN RETURN json_build_object('pass', false, 'message', 'Shipment not found'); END IF;
  
  SELECT setting_value->'cities' INTO v_metro_cities FROM system_settings WHERE setting_key = 'metro_cities';
  v_is_metro := v_metro_cities @> to_jsonb(v_ship.destination_city);
  
  v_has_trucking := COALESCE(v_ship.cost_trucking, 0) > 0;
  
  IF v_is_metro THEN
    v_status := 'pass';
    v_msg := format('%s is a metro city - trucking cost optional', v_ship.destination_city);
  ELSIF v_has_trucking THEN
    v_status := 'pass';
    v_msg := 'Trucking cost entered for non-metro delivery';
  ELSE
    v_status := 'fail';
    v_msg := format('%s is non-metro - trucking cost required', v_ship.destination_city);
  END IF;
  
  INSERT INTO checkpoint_validations (checkpoint_code, entity_type, entity_id, validation_status, is_blocking, validation_message, validated_by, validation_details)
  VALUES ('TRUCKING_COST_NON_METRO', 'shipment', p_shipment_id, v_status, true, v_msg, auth.uid(),
    json_build_object('destination', v_ship.destination_city, 'is_metro', v_is_metro, 'has_trucking', v_has_trucking)::jsonb);
  
  RETURN json_build_object('pass', v_status = 'pass', 'blocking', true, 'message', v_msg, 'is_metro', v_is_metro, 'requires_trucking', NOT v_is_metro);
END; $$;

-- Function: Run all checkpoints for shipment
DROP FUNCTION IF EXISTS validate_shipment_checkpoints(uuid) CASCADE;
CREATE FUNCTION validate_shipment_checkpoints(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_exchange json;
  v_storage json;
  v_margin json;
  v_trucking json;
  v_blocking_failures text[] := ARRAY[]::text[];
  v_warnings text[] := ARRAY[]::text[];
  v_can_proceed boolean := true;
BEGIN
  v_exchange := check_exchange_rate_lock(p_shipment_id);
  IF NOT (v_exchange->>'pass')::boolean THEN
    v_blocking_failures := array_append(v_blocking_failures, v_exchange->>'message');
    v_can_proceed := false;
  END IF;
  
  v_storage := check_storage_review(p_shipment_id);
  IF NOT (v_storage->>'pass')::boolean THEN
    v_blocking_failures := array_append(v_blocking_failures, v_storage->>'message');
    v_can_proceed := false;
  END IF;
  
  v_margin := check_minimum_margin(p_shipment_id);
  IF NOT (v_margin->>'pass')::boolean THEN
    v_warnings := array_append(v_warnings, v_margin->>'message');
  END IF;
  
  v_trucking := check_trucking_cost_non_metro(p_shipment_id);
  IF NOT (v_trucking->>'pass')::boolean AND (v_trucking->>'blocking')::boolean THEN
    v_blocking_failures := array_append(v_blocking_failures, v_trucking->>'message');
    v_can_proceed := false;
  END IF;
  
  UPDATE shipment_drafts SET
    checkpoints_passed = v_can_proceed,
    blocked_checkpoints = to_jsonb(v_blocking_failures)
  WHERE id = p_shipment_id;
  
  RETURN json_build_object(
    'can_proceed', v_can_proceed,
    'blocking_failures', v_blocking_failures,
    'warnings', v_warnings,
    'exchange_rate', v_exchange,
    'storage', v_storage,
    'margin', v_margin,
    'trucking', v_trucking
  );
END; $$;

-- Function: Lock exchange rate
DROP FUNCTION IF EXISTS lock_exchange_rate(uuid) CASCADE;
CREATE FUNCTION lock_exchange_rate(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
BEGIN
  UPDATE shipment_drafts SET
    exchange_rate_locked = true,
    exchange_rate_locked_at = now(),
    exchange_rate_locked_by = auth.uid()
  WHERE id = p_shipment_id AND exchange_rate IS NOT NULL AND exchange_rate > 0;
  
  IF NOT FOUND THEN    RETURN json_build_object('success', false, 'message', 'Cannot lock - exchange rate not set');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Exchange rate locked successfully');
END; $$;

-- Function: Mark storage reviewed
DROP FUNCTION IF EXISTS mark_storage_reviewed(uuid) CASCADE;
CREATE FUNCTION mark_storage_reviewed(p_shipment_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
BEGIN
  UPDATE shipment_drafts SET
    storage_reviewed = true,
    storage_reviewed_at = now(),
    storage_reviewed_by = auth.uid()
  WHERE id = p_shipment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Shipment not found');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Storage charges reviewed');
END; $$;

-- Function: Mark container costs entered
DROP FUNCTION IF EXISTS mark_container_costs_entered(uuid) CASCADE;
CREATE FUNCTION mark_container_costs_entered(p_container_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
BEGIN
  UPDATE groupage_containers SET
    costs_entered = true,
    costs_entered_at = now(),
    costs_entered_by = auth.uid()
  WHERE id = p_container_id AND total_cost > 0;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cannot mark - costs not entered or zero');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Container costs marked as entered');
END; $$;

-- Function: Create admin override
DROP FUNCTION IF EXISTS create_checkpoint_override(uuid, text, text, text) CASCADE;
CREATE FUNCTION create_checkpoint_override(
  p_entity_id uuid,
  p_checkpoint_code text,
  p_override_reason text,
  p_override_notes text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  v_validation_id uuid;
  v_override_id uuid;
BEGIN
  SELECT id INTO v_validation_id FROM checkpoint_validations
  WHERE entity_id = p_entity_id AND checkpoint_code = p_checkpoint_code
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_validation_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No validation found to override');
  END IF;
  
  INSERT INTO checkpoint_overrides (
    validation_id, checkpoint_code, entity_type, entity_id,
    override_reason, override_notes, overridden_by
  )
  SELECT 
    v_validation_id, checkpoint_code, entity_type, entity_id,
    p_override_reason, p_override_notes, auth.uid()
  FROM checkpoint_validations WHERE id = v_validation_id
  RETURNING id INTO v_override_id;
  
  UPDATE checkpoint_validations SET validation_status = 'overridden' WHERE id = v_validation_id;
  
  RETURN json_build_object('success', true, 'override_id', v_override_id, 'message', 'Override created successfully');
END; $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_validations_entity ON checkpoint_validations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validations_checkpoint ON checkpoint_validations(checkpoint_code);
CREATE INDEX IF NOT EXISTS idx_validations_status ON checkpoint_validations(validation_status);
CREATE INDEX IF NOT EXISTS idx_overrides_entity ON checkpoint_overrides(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_overrides_checkpoint ON checkpoint_overrides(checkpoint_code);
CREATE INDEX IF NOT EXISTS idx_shipments_checkpoints ON shipment_drafts(checkpoints_passed);
CREATE INDEX IF NOT EXISTS idx_shipments_rate_locked ON shipment_drafts(exchange_rate_locked);
CREATE INDEX IF NOT EXISTS idx_shipments_storage_reviewed ON shipment_drafts(storage_reviewed);
CREATE INDEX IF NOT EXISTS idx_containers_costs_entered ON groupage_containers(costs_entered);
