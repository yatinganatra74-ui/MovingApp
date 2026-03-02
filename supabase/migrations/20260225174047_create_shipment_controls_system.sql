/*
  # Shipment Controls and Document Management System

  1. Control Fields
    - Approval status and workflow
    - Revenue lock mechanism
    - Document tracking
    - Invoice generation status
    
  2. Document Storage
    - BL (Bill of Lading)
    - Commercial Invoice
    - Other documents
    - File metadata
    
  3. Workflow States
    - draft: Initial state, editable
    - revenue_locked: Exchange rate locked
    - approved: Ready for execution
    - in_execution: Active shipment
    - completed: Finished
    - cancelled: Cancelled
    
  4. Agent Invoice
    - Track if invoice generated
    - Invoice reference
    - Generation date
*/

-- Add control fields to import_shipments
DO $$
BEGIN
  -- Approval workflow
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN approval_status text DEFAULT 'draft';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN approved_at timestamptz;
  END IF;
  
  -- Document tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'bl_document_url'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN bl_document_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'invoice_document_url'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN invoice_document_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'documents_uploaded_at'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN documents_uploaded_at timestamptz;
  END IF;
  
  -- Agent invoice tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'agent_invoice_generated'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN agent_invoice_generated boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'agent_invoice_number'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN agent_invoice_number text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'agent_invoice_generated_at'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN agent_invoice_generated_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'agent_invoice_generated_by'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN agent_invoice_generated_by uuid REFERENCES auth.users(id);
  END IF;
  
  -- Revenue lock tracking (additional fields)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'revenue_locked_by'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN revenue_locked_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create shipment_documents table for multiple document uploads
CREATE TABLE IF NOT EXISTS shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES import_shipments(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shipment documents"
  ON shipment_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shipment documents"
  ON shipment_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update own shipment documents"
  ON shipment_documents FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Authenticated users can delete own shipment documents"
  ON shipment_documents FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Function to lock revenue (locks exchange rate)
CREATE OR REPLACE FUNCTION lock_shipment_revenue(
  shipment_id uuid,
  user_id uuid
)
RETURNS json AS $$
DECLARE
  current_rate decimal(10, 4);
  result json;
BEGIN
  -- Get current exchange rate
  SELECT exchange_rate INTO current_rate
  FROM import_shipments
  WHERE id = shipment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Shipment not found');
  END IF;
  
  -- Lock the exchange rate
  UPDATE import_shipments
  SET 
    exchange_rate_locked = true,
    exchange_rate_locked_at = now(),
    revenue_locked_by = user_id
  WHERE id = shipment_id;
  
  result := json_build_object(
    'success', true,
    'locked_rate', current_rate,
    'locked_at', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to approve shipment
CREATE OR REPLACE FUNCTION approve_shipment(
  shipment_id uuid,
  user_id uuid
)
RETURNS json AS $$
DECLARE
  current_status text;
  result json;
BEGIN
  -- Get current status
  SELECT approval_status INTO current_status
  FROM import_shipments
  WHERE id = shipment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Shipment not found');
  END IF;
  
  -- Check if revenue is locked
  IF NOT EXISTS (
    SELECT 1 FROM import_shipments 
    WHERE id = shipment_id AND exchange_rate_locked = true
  ) THEN
    RETURN json_build_object('error', 'Revenue must be locked before approval');
  END IF;
  
  -- Approve the shipment
  UPDATE import_shipments
  SET 
    approval_status = 'approved',
    approved_by = user_id,
    approved_at = now(),
    status = 'approved'
  WHERE id = shipment_id;
  
  result := json_build_object(
    'success', true,
    'approval_status', 'approved',
    'approved_at', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate agent invoice number
CREATE OR REPLACE FUNCTION generate_agent_invoice(
  shipment_id uuid,
  user_id uuid
)
RETURNS json AS $$
DECLARE
  shipment_record RECORD;
  invoice_number text;
  agent_name text;
  result json;
BEGIN
  -- Get shipment details
  SELECT s.*, a.name as agent_name INTO shipment_record
  FROM import_shipments s
  LEFT JOIN customers a ON s.agent_id = a.id
  WHERE s.id = shipment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Shipment not found');
  END IF;
  
  -- Check if approved
  IF shipment_record.approval_status != 'approved' THEN
    RETURN json_build_object('error', 'Shipment must be approved before generating invoice');
  END IF;
  
  -- Check if already generated
  IF shipment_record.agent_invoice_generated THEN
    RETURN json_build_object('error', 'Agent invoice already generated', 'invoice_number', shipment_record.agent_invoice_number);
  END IF;
  
  -- Generate invoice number: AGI-YYYYMM-XXXX
  invoice_number := 'AGI-' || TO_CHAR(now(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::text, 4, '0');
  
  -- Mark as generated
  UPDATE import_shipments
  SET 
    agent_invoice_generated = true,
    agent_invoice_number = invoice_number,
    agent_invoice_generated_at = now(),
    agent_invoice_generated_by = user_id
  WHERE id = shipment_id;
  
  result := json_build_object(
    'success', true,
    'invoice_number', invoice_number,
    'agent_name', shipment_record.agent_name,
    'generated_at', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_import_shipments_approval_status 
  ON import_shipments(approval_status);

CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment_id 
  ON shipment_documents(shipment_id);

CREATE INDEX IF NOT EXISTS idx_shipment_documents_type 
  ON shipment_documents(document_type);

-- Comments
COMMENT ON COLUMN import_shipments.approval_status IS 'Workflow status: draft, approved, in_execution, completed, cancelled';
COMMENT ON COLUMN import_shipments.approved_by IS 'User who approved the shipment';
COMMENT ON COLUMN import_shipments.approved_at IS 'Timestamp of approval';
COMMENT ON COLUMN import_shipments.revenue_locked_by IS 'User who locked the revenue/exchange rate';
COMMENT ON COLUMN import_shipments.bl_document_url IS 'Bill of Lading document URL';
COMMENT ON COLUMN import_shipments.invoice_document_url IS 'Commercial Invoice document URL';
COMMENT ON COLUMN import_shipments.documents_uploaded_at IS 'Timestamp of document upload';
COMMENT ON COLUMN import_shipments.agent_invoice_generated IS 'Whether agent invoice has been generated';
COMMENT ON COLUMN import_shipments.agent_invoice_number IS 'Generated agent invoice number';
COMMENT ON COLUMN import_shipments.agent_invoice_generated_at IS 'Timestamp of invoice generation';
COMMENT ON COLUMN import_shipments.agent_invoice_generated_by IS 'User who generated the invoice';

COMMENT ON TABLE shipment_documents IS 'Stores multiple documents per shipment (BL, invoices, customs, etc.)';
COMMENT ON FUNCTION lock_shipment_revenue IS 'Locks exchange rate to prevent changes';
COMMENT ON FUNCTION approve_shipment IS 'Approves shipment and moves to execution phase';
COMMENT ON FUNCTION generate_agent_invoice IS 'Generates agent invoice number for monthly billing';