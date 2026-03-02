/*
  # Advanced Features System

  ## Overview
  Advanced features including AI video surveys, barcode tracking, GPS tracking,
  WhatsApp notifications, payment gateway, shipping line integration, customs
  automation, and insurance API integration.

  ## New Tables
  - video_surveys: AI-powered video survey storage
  - barcode_tracking: Carton barcode tracking system  
  - barcode_scan_history: Scan history for tracking
  - gps_tracking: Real-time GPS tracking
  - notification_queue: WhatsApp & notification queue
  - payment_transactions: Payment gateway transactions
  - shipping_line_bookings: Shipping line integration
  - customs_documents: Customs documentation
  - insurance_policies: Insurance integration
  - insurance_claims: Insurance claim tracking

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create video surveys table
CREATE TABLE IF NOT EXISTS video_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  video_duration integer,
  analysis_status text DEFAULT 'PENDING' CHECK (analysis_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  ai_detected_items jsonb,
  ai_confidence_score decimal(5,2),
  transcription text,
  uploaded_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create barcode tracking table
CREATE TABLE IF NOT EXISTS barcode_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE NOT NULL,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  carton_type text,
  contents_description text,
  room_origin text,
  weight_kg decimal(10,2),
  volume_cbm decimal(10,3),
  packed_by uuid REFERENCES auth.users(id),
  packed_at timestamptz DEFAULT now(),
  current_status text DEFAULT 'PACKED' CHECK (current_status IN ('PACKED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'STORED', 'DAMAGED')),
  current_location text,
  qr_code_url text,
  customer_id uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create barcode scan history table
CREATE TABLE IF NOT EXISTS barcode_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_id uuid NOT NULL REFERENCES barcode_tracking(id) ON DELETE CASCADE,
  scan_type text NOT NULL CHECK (scan_type IN ('PACK', 'LOAD', 'UNLOAD', 'DELIVER', 'WAREHOUSE_IN', 'WAREHOUSE_OUT', 'INSPECT')),
  scanned_by uuid REFERENCES auth.users(id),
  scanned_at timestamptz DEFAULT now(),
  location text,
  gps_latitude decimal(10,8),
  gps_longitude decimal(11,8),
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create GPS tracking table
CREATE TABLE IF NOT EXISTS gps_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  driver_id uuid REFERENCES crew_members(id),
  latitude decimal(10,8) NOT NULL,
  longitude decimal(11,8) NOT NULL,
  speed_kmh decimal(6,2),
  heading decimal(5,2),
  altitude decimal(8,2),
  accuracy decimal(6,2),
  tracking_status text DEFAULT 'ACTIVE' CHECK (tracking_status IN ('ACTIVE', 'PAUSED', 'STOPPED', 'COMPLETED')),
  battery_level integer CHECK (battery_level BETWEEN 0 AND 100),
  gps_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL CHECK (notification_type IN ('WHATSAPP', 'SMS', 'EMAIL', 'PUSH')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('CUSTOMER', 'CREW', 'ADMIN')),
  recipient_id uuid,
  recipient_phone text,
  recipient_email text,
  message_template text,
  message_content text NOT NULL,
  variables jsonb,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ')),
  scheduled_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  reference_type text CHECK (reference_type IN ('JOB', 'QUOTE', 'INVOICE', 'SURVEY', 'PAYMENT', 'SHIPMENT')),
  reference_id uuid,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  customer_id uuid NOT NULL REFERENCES customers(id),
  payment_gateway text NOT NULL CHECK (payment_gateway IN ('STRIPE', 'PAYPAL', 'RAZORPAY', 'SQUARE', 'MANUAL')),
  transaction_id text,
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'USD',
  payment_method text CHECK (payment_method IN ('CARD', 'BANK_TRANSFER', 'WALLET', 'UPI', 'CASH', 'CHECK')),
  payment_status text DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')),
  gateway_response jsonb,
  customer_email text,
  card_last4 text,
  receipt_url text,
  refund_reason text,
  initiated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create shipping line bookings table
CREATE TABLE IF NOT EXISTS shipping_line_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  shipping_line text NOT NULL,
  booking_number text,
  container_number text,
  container_type text CHECK (container_type IN ('20FT', '40FT', '40HC', '45FT')),
  vessel_name text,
  voyage_number text,
  port_of_loading text NOT NULL,
  port_of_discharge text NOT NULL,
  etd date,
  eta date,
  atd date,
  ata date,
  booking_status text DEFAULT 'REQUESTED' CHECK (booking_status IN ('REQUESTED', 'CONFIRMED', 'LOADED', 'SAILING', 'ARRIVED', 'DISCHARGED', 'CANCELLED')),
  bl_number text,
  seal_number text,
  freight_charges decimal(10,2),
  api_response jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customs documents table
CREATE TABLE IF NOT EXISTS customs_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN', 'CUSTOMS_DECLARATION', 'IMPORT_PERMIT', 'EXPORT_PERMIT')),
  document_number text,
  document_url text,
  status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLEARED')),
  issuing_authority text,
  issue_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  customs_value decimal(10,2),
  hs_codes jsonb,
  duty_amount decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  clearance_date date,
  clearance_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create insurance policies table
CREATE TABLE IF NOT EXISTS insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  policy_provider text NOT NULL,
  policy_number text,
  policy_type text NOT NULL CHECK (policy_type IN ('MARINE', 'TRANSIT', 'WAREHOUSE', 'COMPREHENSIVE', 'LIABILITY')),
  coverage_amount decimal(10,2) NOT NULL CHECK (coverage_amount > 0),
  premium_amount decimal(10,2) NOT NULL CHECK (premium_amount >= 0),
  policy_start_date date DEFAULT CURRENT_DATE,
  policy_end_date date,
  policy_status text DEFAULT 'QUOTED' CHECK (policy_status IN ('QUOTED', 'ACTIVE', 'EXPIRED', 'CLAIMED', 'CANCELLED')),
  items_covered jsonb,
  exclusions jsonb,
  certificate_url text,
  api_reference text,
  deductible_amount decimal(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create insurance claims table
CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  claim_number text,
  claim_type text NOT NULL CHECK (claim_type IN ('DAMAGE', 'LOSS', 'THEFT', 'DELAY', 'OTHER')),
  claim_amount decimal(10,2) NOT NULL CHECK (claim_amount > 0),
  approved_amount decimal(10,2),
  claim_status text DEFAULT 'FILED' CHECK (claim_status IN ('FILED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CLOSED')),
  incident_date date NOT NULL,
  incident_description text NOT NULL,
  supporting_documents jsonb,
  assessor_notes text,
  filed_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  payment_date date,
  created_at timestamptz DEFAULT now()
);

-- Function to generate unique barcode
CREATE OR REPLACE FUNCTION generate_barcode(p_job_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_number text;
  v_barcode_count integer;
  v_barcode text;
BEGIN
  SELECT job_number INTO v_job_number
  FROM jobs
  WHERE id = p_job_id;
  
  SELECT COUNT(*) INTO v_barcode_count
  FROM barcode_tracking
  WHERE job_id = p_job_id;
  
  v_barcode := v_job_number || '-' || lpad((v_barcode_count + 1)::text, 4, '0');
  
  RETURN v_barcode;
END;
$$;

-- Function to track barcode scan
CREATE OR REPLACE FUNCTION track_barcode_scan(
  p_barcode text,
  p_scan_type text,
  p_scanned_by uuid,
  p_location text DEFAULT NULL,
  p_gps_lat decimal DEFAULT NULL,
  p_gps_lon decimal DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_barcode_id uuid;
  v_scan_id uuid;
  v_new_status text;
  v_current_status text;
BEGIN
  SELECT id, current_status INTO v_barcode_id, v_current_status
  FROM barcode_tracking
  WHERE barcode = p_barcode;
  
  IF v_barcode_id IS NULL THEN
    RAISE EXCEPTION 'Barcode not found: %', p_barcode;
  END IF;
  
  v_new_status := CASE p_scan_type
    WHEN 'PACK' THEN 'PACKED'
    WHEN 'LOAD' THEN 'LOADED'
    WHEN 'UNLOAD' THEN 'IN_TRANSIT'
    WHEN 'DELIVER' THEN 'DELIVERED'
    WHEN 'WAREHOUSE_IN' THEN 'STORED'
    ELSE v_current_status
  END;
  
  INSERT INTO barcode_scan_history (
    barcode_id, scan_type, scanned_by, location,
    gps_latitude, gps_longitude, notes
  ) VALUES (
    v_barcode_id, p_scan_type, p_scanned_by, p_location,
    p_gps_lat, p_gps_lon, p_notes
  ) RETURNING id INTO v_scan_id;
  
  UPDATE barcode_tracking
  SET 
    current_status = v_new_status,
    current_location = COALESCE(p_location, current_location),
    updated_at = now()
  WHERE id = v_barcode_id;
  
  RETURN v_scan_id;
END;
$$;

-- Function to send notification
CREATE OR REPLACE FUNCTION send_notification(
  p_notification_type text,
  p_recipient_type text,
  p_recipient_id uuid,
  p_message text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_notification_id uuid;
  v_phone text;
  v_email text;
BEGIN
  IF p_recipient_type = 'CUSTOMER' THEN
    SELECT phone, email INTO v_phone, v_email
    FROM customers WHERE id = p_recipient_id;
  ELSIF p_recipient_type = 'CREW' THEN
    SELECT phone, email INTO v_phone, v_email
    FROM crew_members WHERE id = p_recipient_id;
  END IF;
  
  INSERT INTO notification_queue (
    notification_type, recipient_type, recipient_id,
    recipient_phone, recipient_email, message_content,
    reference_type, reference_id
  ) VALUES (
    p_notification_type, p_recipient_type, p_recipient_id,
    v_phone, v_email, p_message,
    p_reference_type, p_reference_id
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to calculate insurance premium
CREATE OR REPLACE FUNCTION calculate_insurance_premium(
  p_coverage_amount decimal,
  p_policy_type text,
  p_duration_days integer DEFAULT 30
)
RETURNS decimal
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate decimal;
  v_premium decimal;
BEGIN
  v_rate := CASE p_policy_type
    WHEN 'MARINE' THEN 0.015
    WHEN 'TRANSIT' THEN 0.01
    WHEN 'WAREHOUSE' THEN 0.005
    WHEN 'COMPREHENSIVE' THEN 0.02
    ELSE 0.01
  END;
  
  v_premium := p_coverage_amount * v_rate * (p_duration_days / 30.0);
  
  RETURN ROUND(v_premium, 2);
END;
$$;

-- Create active shipments view
CREATE OR REPLACE VIEW active_shipments AS
SELECT 
  slb.id,
  slb.job_id,
  j.job_number,
  c.name as customer_name,
  slb.shipping_line,
  slb.booking_number,
  slb.container_number,
  slb.vessel_name,
  slb.port_of_loading,
  slb.port_of_discharge,
  slb.etd,
  slb.eta,
  slb.booking_status,
  CASE 
    WHEN slb.booking_status IN ('SAILING', 'LOADED') AND slb.eta IS NOT NULL THEN 
      slb.eta::date - CURRENT_DATE
    ELSE NULL
  END as days_to_arrival
FROM shipping_line_bookings slb
JOIN jobs j ON slb.job_id = j.id
JOIN customers c ON j.customer_id = c.id
WHERE slb.booking_status NOT IN ('DISCHARGED', 'CANCELLED')
ORDER BY slb.etd;

-- Create pending notifications view
CREATE OR REPLACE VIEW pending_notifications AS
SELECT 
  nq.id,
  nq.notification_type,
  nq.recipient_type,
  nq.recipient_phone,
  nq.recipient_email,
  nq.message_content,
  nq.status,
  nq.scheduled_at,
  nq.retry_count,
  CASE 
    WHEN nq.recipient_type = 'CUSTOMER' THEN c.name
    WHEN nq.recipient_type = 'CREW' THEN cm.name
    ELSE NULL
  END as recipient_name
FROM notification_queue nq
LEFT JOIN customers c ON nq.recipient_id = c.id AND nq.recipient_type = 'CUSTOMER'
LEFT JOIN crew_members cm ON nq.recipient_id = cm.id AND nq.recipient_type = 'CREW'
WHERE nq.status IN ('PENDING', 'FAILED')
  AND nq.scheduled_at <= now()
  AND nq.retry_count < 3
ORDER BY nq.scheduled_at;

-- Create payment summary view
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
  pt.customer_id,
  c.name as customer_name,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN pt.payment_status = 'COMPLETED' THEN pt.amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN pt.payment_status = 'PENDING' THEN pt.amount ELSE 0 END) as total_pending,
  SUM(CASE WHEN pt.payment_status = 'FAILED' THEN pt.amount ELSE 0 END) as total_failed,
  MAX(pt.completed_at) as last_payment_date
FROM payment_transactions pt
JOIN customers c ON pt.customer_id = c.id
GROUP BY pt.customer_id, c.name;

-- Create customs pending view
CREATE OR REPLACE VIEW customs_pending AS
SELECT 
  cd.id,
  cd.job_id,
  j.job_number,
  c.name as customer_name,
  cd.document_type,
  cd.document_number,
  cd.status,
  cd.issue_date,
  cd.customs_value,
  cd.duty_amount + cd.tax_amount as total_charges,
  CURRENT_DATE - cd.issue_date as days_pending
FROM customs_documents cd
JOIN jobs j ON cd.job_id = j.id
JOIN customers c ON j.customer_id = c.id
WHERE cd.status NOT IN ('CLEARED', 'REJECTED')
ORDER BY cd.issue_date;

-- Enable RLS
ALTER TABLE video_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_line_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customs_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view video_surveys"
  ON video_surveys FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage video_surveys"
  ON video_surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view barcode_tracking"
  ON barcode_tracking FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage barcode_tracking"
  ON barcode_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view barcode_scan_history"
  ON barcode_scan_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create barcode_scan_history"
  ON barcode_scan_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view gps_tracking"
  ON gps_tracking FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage gps_tracking"
  ON gps_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view notification_queue"
  ON notification_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage notification_queue"
  ON notification_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view payment_transactions"
  ON payment_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage payment_transactions"
  ON payment_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view shipping_line_bookings"
  ON shipping_line_bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage shipping_line_bookings"
  ON shipping_line_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view customs_documents"
  ON customs_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage customs_documents"
  ON customs_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view insurance_policies"
  ON insurance_policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage insurance_policies"
  ON insurance_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view insurance_claims"
  ON insurance_claims FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage insurance_claims"
  ON insurance_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_surveys_survey ON video_surveys(survey_id);
CREATE INDEX IF NOT EXISTS idx_barcode_tracking_job ON barcode_tracking(job_id);
CREATE INDEX IF NOT EXISTS idx_barcode_tracking_barcode ON barcode_tracking(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_history_barcode ON barcode_scan_history(barcode_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_job ON gps_tracking(job_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_timestamp ON gps_tracking(gps_timestamp);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer ON payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_shipping_bookings_job ON shipping_line_bookings(job_id);
CREATE INDEX IF NOT EXISTS idx_customs_documents_job ON customs_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_job ON insurance_policies(job_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);

-- Grant access to views
GRANT SELECT ON active_shipments TO authenticated;
GRANT SELECT ON pending_notifications TO authenticated;
GRANT SELECT ON payment_summary TO authenticated;
GRANT SELECT ON customs_pending TO authenticated;