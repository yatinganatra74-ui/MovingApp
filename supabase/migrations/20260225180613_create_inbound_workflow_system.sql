/*
  # Create Full Inbound Operation Workflow System

  ## Overview
  Complete workflow management from pre-alert to profit finalization for inbound shipments.

  ## New Tables

  ### 1. `workflow_stages`
  Defines all possible stages in the inbound workflow
  - `id` (uuid, primary key)
  - `stage_name` (text) - Stage identifier
  - `display_name` (text) - User-friendly name
  - `stage_order` (integer) - Sequence number
  - `description` (text) - Stage description
  - `is_active` (boolean) - Whether stage is in use

  ### 2. `shipment_workflow_status`
  Tracks current workflow status for each shipment
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `current_stage` (text) - Current workflow stage
  - `overall_status` (text) - Overall shipment status
  - `is_completed` (boolean) - Workflow completion flag
  - `completion_date` (timestamptz) - When workflow completed
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `workflow_stage_history`
  Audit trail of stage transitions
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `stage_name` (text) - Stage entered
  - `entered_at` (timestamptz) - Entry timestamp
  - `completed_at` (timestamptz) - Completion timestamp
  - `duration_hours` (numeric) - Time spent in stage
  - `completed_by` (uuid) - User who completed
  - `notes` (text) - Stage notes

  ### 4. `document_checklist`
  Required documents for each workflow stage
  - `id` (uuid, primary key)
  - `stage_name` (text) - Associated stage
  - `document_name` (text) - Document type
  - `is_mandatory` (boolean) - Required flag
  - `display_order` (integer) - Sort order

  ### 5. `shipment_documents`
  Actual document uploads and tracking
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `document_type` (text) - Document category
  - `document_name` (text) - File name
  - `file_url` (text) - Storage URL
  - `uploaded_by` (uuid) - User who uploaded
  - `uploaded_at` (timestamptz)
  - `stage_name` (text) - Associated stage
  - `is_verified` (boolean) - Verification status
  - `verified_by` (uuid)
  - `verified_at` (timestamptz)

  ### 6. `stage_tasks`
  Action items for each workflow stage
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `stage_name` (text) - Associated stage
  - `task_description` (text) - What needs to be done
  - `is_completed` (boolean) - Completion status
  - `completed_by` (uuid)
  - `completed_at` (timestamptz)
  - `priority` (text) - high/medium/low
  - `due_date` (date)

  ### 7. `container_arrival_tracking`
  Container arrival and gate-in details
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `container_number` (text)
  - `vessel_eta` (date) - Expected arrival
  - `actual_arrival_date` (timestamptz) - Actual arrival
  - `port_of_discharge` (text)
  - `free_time_days` (integer) - Detention free days
  - `free_time_expires` (date) - Detention start date
  - `detention_per_day` (numeric) - Daily detention cost
  - `gate_in_warehouse` (timestamptz) - Warehouse gate-in time
  - `demurrage_cost` (numeric) - Port charges
  - `detention_cost` (numeric) - Container detention
  - `status` (text) - at_port/in_transit/at_warehouse

  ### 8. `customs_clearance_tracking`
  Customs clearance process tracking
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `customs_broker` (text)
  - `entry_number` (text) - Bill of Entry number
  - `entry_date` (date)
  - `assessment_date` (date)
  - `duty_amount` (numeric)
  - `igst_amount` (numeric)
  - `other_charges` (numeric)
  - `total_customs_cost` (numeric)
  - `payment_date` (date)
  - `out_of_charge_date` (date) - OOC date
  - `clearance_status` (text) - pending/assessed/paid/cleared
  - `cha_charges` (numeric) - Clearing agent fees
  - `examination_required` (boolean)
  - `examination_date` (date)

  ### 9. `delivery_coordination`
  Final delivery tracking
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `delivery_type` (text) - ex_warehouse/door_delivery
  - `delivery_scheduled_date` (date)
  - `delivery_actual_date` (date)
  - `delivery_address` (text)
  - `contact_person` (text)
  - `contact_phone` (text)
  - `vehicle_number` (text)
  - `driver_name` (text)
  - `driver_phone` (text)
  - `pod_received` (boolean) - Proof of delivery
  - `pod_file_url` (text)
  - `delivery_notes` (text)
  - `delivery_status` (text) - scheduled/in_transit/delivered

  ### 10. `profit_finalization`
  Final profit calculation and closure
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `initial_revenue_inr` (numeric) - Quoted revenue
  - `final_revenue_inr` (numeric) - Actual revenue
  - `initial_cost_inr` (numeric) - Estimated cost
  - `final_cost_inr` (numeric) - Actual cost
  - `initial_profit_inr` (numeric) - Estimated profit
  - `final_profit_inr` (numeric) - Actual profit
  - `variance_amount` (numeric) - Difference
  - `variance_percent` (numeric) - % variance
  - `finalized_by` (uuid)
  - `finalized_at` (timestamptz)
  - `closure_notes` (text)
  - `is_invoiced` (boolean)
  - `invoice_number` (text)
  - `invoice_date` (date)

  ### 11. `workflow_notifications`
  Stage-based notifications and alerts
  - `id` (uuid, primary key)
  - `import_shipment_id` (uuid, foreign key)
  - `stage_name` (text)
  - `notification_type` (text) - info/warning/critical
  - `message` (text)
  - `created_at` (timestamptz)
  - `is_read` (boolean)
  - `read_by` (uuid)
  - `read_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Policies for authenticated users
  - Audit trail for all changes
*/

-- Create workflow_stages table
CREATE TABLE IF NOT EXISTS workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  stage_order integer NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow stages"
  ON workflow_stages FOR SELECT
  TO authenticated
  USING (true);

-- Create shipment_workflow_status table
CREATE TABLE IF NOT EXISTS shipment_workflow_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  current_stage text NOT NULL,
  overall_status text DEFAULT 'in_progress',
  is_completed boolean DEFAULT false,
  completion_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(import_shipment_id)
);

ALTER TABLE shipment_workflow_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipment workflow"
  ON shipment_workflow_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert shipment workflow"
  ON shipment_workflow_status FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipment workflow"
  ON shipment_workflow_status FOR UPDATE
  TO authenticated
  USING (true);

-- Create workflow_stage_history table
CREATE TABLE IF NOT EXISTS workflow_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  entered_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_hours numeric,
  completed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stage history"
  ON workflow_stage_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert stage history"
  ON workflow_stage_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update stage history"
  ON workflow_stage_history FOR UPDATE
  TO authenticated
  USING (true);

-- Create document_checklist table
CREATE TABLE IF NOT EXISTS document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name text NOT NULL,
  document_name text NOT NULL,
  is_mandatory boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document checklist"
  ON document_checklist FOR SELECT
  TO authenticated
  USING (true);

-- Create shipment_documents table
CREATE TABLE IF NOT EXISTS shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text NOT NULL,
  file_url text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  stage_name text,
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  notes text
);

ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipment documents"
  ON shipment_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert shipment documents"
  ON shipment_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update shipment documents"
  ON shipment_documents FOR UPDATE
  TO authenticated
  USING (true);

-- Create stage_tasks table
CREATE TABLE IF NOT EXISTS stage_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  task_description text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  priority text DEFAULT 'medium',
  due_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stage_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stage tasks"
  ON stage_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert stage tasks"
  ON stage_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update stage tasks"
  ON stage_tasks FOR UPDATE
  TO authenticated
  USING (true);

-- Create container_arrival_tracking table
CREATE TABLE IF NOT EXISTS container_arrival_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  container_number text,
  vessel_eta date,
  actual_arrival_date timestamptz,
  port_of_discharge text,
  free_time_days integer DEFAULT 7,
  free_time_expires date,
  detention_per_day numeric DEFAULT 0,
  gate_in_warehouse timestamptz,
  demurrage_cost numeric DEFAULT 0,
  detention_cost numeric DEFAULT 0,
  status text DEFAULT 'at_port',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE container_arrival_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view container arrival"
  ON container_arrival_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert container arrival"
  ON container_arrival_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update container arrival"
  ON container_arrival_tracking FOR UPDATE
  TO authenticated
  USING (true);

-- Create customs_clearance_tracking table
CREATE TABLE IF NOT EXISTS customs_clearance_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  customs_broker text,
  entry_number text,
  entry_date date,
  assessment_date date,
  duty_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  other_charges numeric DEFAULT 0,
  total_customs_cost numeric DEFAULT 0,
  payment_date date,
  out_of_charge_date date,
  clearance_status text DEFAULT 'pending',
  cha_charges numeric DEFAULT 0,
  examination_required boolean DEFAULT false,
  examination_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customs_clearance_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customs clearance"
  ON customs_clearance_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customs clearance"
  ON customs_clearance_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customs clearance"
  ON customs_clearance_tracking FOR UPDATE
  TO authenticated
  USING (true);

-- Create delivery_coordination table
CREATE TABLE IF NOT EXISTS delivery_coordination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  delivery_type text DEFAULT 'ex_warehouse',
  delivery_scheduled_date date,
  delivery_actual_date date,
  delivery_address text,
  contact_person text,
  contact_phone text,
  vehicle_number text,
  driver_name text,
  driver_phone text,
  pod_received boolean DEFAULT false,
  pod_file_url text,
  delivery_notes text,
  delivery_status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_coordination ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view delivery coordination"
  ON delivery_coordination FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert delivery coordination"
  ON delivery_coordination FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update delivery coordination"
  ON delivery_coordination FOR UPDATE
  TO authenticated
  USING (true);

-- Create profit_finalization table
CREATE TABLE IF NOT EXISTS profit_finalization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  initial_revenue_inr numeric DEFAULT 0,
  final_revenue_inr numeric DEFAULT 0,
  initial_cost_inr numeric DEFAULT 0,
  final_cost_inr numeric DEFAULT 0,
  initial_profit_inr numeric DEFAULT 0,
  final_profit_inr numeric DEFAULT 0,
  variance_amount numeric DEFAULT 0,
  variance_percent numeric DEFAULT 0,
  finalized_by uuid REFERENCES auth.users(id),
  finalized_at timestamptz,
  closure_notes text,
  is_invoiced boolean DEFAULT false,
  invoice_number text,
  invoice_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(import_shipment_id)
);

ALTER TABLE profit_finalization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profit finalization"
  ON profit_finalization FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert profit finalization"
  ON profit_finalization FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update profit finalization"
  ON profit_finalization FOR UPDATE
  TO authenticated
  USING (true);

-- Create workflow_notifications table
CREATE TABLE IF NOT EXISTS workflow_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  stage_name text,
  notification_type text DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  read_by uuid REFERENCES auth.users(id),
  read_at timestamptz
);

ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications"
  ON workflow_notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert notifications"
  ON workflow_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update notifications"
  ON workflow_notifications FOR UPDATE
  TO authenticated
  USING (true);

-- Insert default workflow stages
INSERT INTO workflow_stages (stage_name, display_name, stage_order, description) VALUES
  ('pre_alert', 'Pre-Alert Received', 1, 'Initial shipment information received'),
  ('vessel_departed', 'Vessel Departed', 2, 'Vessel has departed from origin port'),
  ('in_transit', 'In Transit', 3, 'Shipment is in transit'),
  ('vessel_arrived', 'Vessel Arrived', 4, 'Vessel arrived at destination port'),
  ('container_discharged', 'Container Discharged', 5, 'Container unloaded from vessel'),
  ('documents_received', 'Documents Received', 6, 'Original documents received'),
  ('customs_filed', 'Customs Entry Filed', 7, 'Bill of entry filed with customs'),
  ('customs_assessed', 'Customs Assessed', 8, 'Duty assessment completed'),
  ('duty_paid', 'Duty Paid', 9, 'Customs duty and taxes paid'),
  ('customs_cleared', 'Customs Cleared', 10, 'Out of charge received'),
  ('warehouse_received', 'Warehouse Gate-In', 11, 'Cargo received at warehouse'),
  ('delivery_scheduled', 'Delivery Scheduled', 12, 'Delivery appointment confirmed'),
  ('out_for_delivery', 'Out for Delivery', 13, 'Cargo dispatched to customer'),
  ('delivered', 'Delivered', 14, 'Cargo delivered to customer'),
  ('pod_received', 'POD Received', 15, 'Proof of delivery received'),
  ('closed', 'Shipment Closed', 16, 'All activities completed, profit finalized')
ON CONFLICT (stage_name) DO NOTHING;

-- Insert default document checklist
INSERT INTO document_checklist (stage_name, document_name, is_mandatory, display_order) VALUES
  ('pre_alert', 'Pre-Alert Email', true, 1),
  ('pre_alert', 'Packing List', true, 2),
  ('pre_alert', 'Commercial Invoice', true, 3),
  ('documents_received', 'Original Bill of Lading', true, 1),
  ('documents_received', 'Certificate of Origin', false, 2),
  ('documents_received', 'Insurance Certificate', false, 3),
  ('documents_received', 'Quality Certificate', false, 4),
  ('customs_filed', 'Bill of Entry', true, 1),
  ('customs_filed', 'GATT Valuation', true, 2),
  ('customs_assessed', 'Assessment Order', true, 1),
  ('duty_paid', 'Payment Challan', true, 1),
  ('customs_cleared', 'Out of Charge Order', true, 1),
  ('warehouse_received', 'Gate In Report', true, 1),
  ('warehouse_received', 'Physical Inspection Report', false, 2),
  ('delivered', 'Delivery Challan', true, 1),
  ('pod_received', 'Signed POD', true, 1),
  ('pod_received', 'Customer Acknowledgment', false, 2),
  ('closed', 'Final Invoice', true, 1),
  ('closed', 'Payment Receipt', true, 2)
ON CONFLICT DO NOTHING;

-- Create function to auto-create workflow status on shipment creation
CREATE OR REPLACE FUNCTION create_shipment_workflow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO shipment_workflow_status (import_shipment_id, current_stage, overall_status)
  VALUES (NEW.id, 'pre_alert', 'in_progress');
  
  INSERT INTO workflow_stage_history (import_shipment_id, stage_name, entered_at)
  VALUES (NEW.id, 'pre_alert', now());
  
  INSERT INTO workflow_notifications (import_shipment_id, stage_name, notification_type, message)
  VALUES (NEW.id, 'pre_alert', 'info', 'New shipment created - Pre-alert stage initiated');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_import_shipment_created ON import_shipments;
CREATE TRIGGER on_import_shipment_created
  AFTER INSERT ON import_shipments
  FOR EACH ROW
  EXECUTE FUNCTION create_shipment_workflow();

-- Create function to update workflow stage
CREATE OR REPLACE FUNCTION update_workflow_stage(
  p_shipment_id uuid,
  p_new_stage text,
  p_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_current_stage text;
  v_stage_history_id uuid;
  v_result json;
BEGIN
  SELECT current_stage INTO v_current_stage
  FROM shipment_workflow_status
  WHERE import_shipment_id = p_shipment_id;
  
  IF v_current_stage IS NULL THEN
    RAISE EXCEPTION 'Shipment workflow not found';
  END IF;
  
  UPDATE workflow_stage_history
  SET completed_at = now(),
      completed_by = p_user_id,
      notes = p_notes,
      duration_hours = EXTRACT(EPOCH FROM (now() - entered_at)) / 3600
  WHERE import_shipment_id = p_shipment_id
    AND stage_name = v_current_stage
    AND completed_at IS NULL;
  
  UPDATE shipment_workflow_status
  SET current_stage = p_new_stage,
      updated_at = now(),
      is_completed = CASE WHEN p_new_stage = 'closed' THEN true ELSE false END,
      completion_date = CASE WHEN p_new_stage = 'closed' THEN now() ELSE NULL END
  WHERE import_shipment_id = p_shipment_id;
  
  INSERT INTO workflow_stage_history (import_shipment_id, stage_name, entered_at)
  VALUES (p_shipment_id, p_new_stage, now())
  RETURNING id INTO v_stage_history_id;
  
  INSERT INTO workflow_notifications (
    import_shipment_id,
    stage_name,
    notification_type,
    message
  )
  VALUES (
    p_shipment_id,
    p_new_stage,
    'info',
    'Stage updated to: ' || p_new_stage
  );
  
  v_result := json_build_object(
    'success', true,
    'previous_stage', v_current_stage,
    'new_stage', p_new_stage,
    'updated_at', now()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
