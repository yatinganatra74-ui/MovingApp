/*
  # Create Import Shipment System

  1. New Tables
    - `import_shipments`
      - Core shipment details (shipment no, container, agent, type, dates)
      - Port information and pre-alert status
      - Rate sheet linkage
      - Status tracking
    
    - `import_shipment_cargo`
      - Cargo items linked to import shipments
      - Package details, weights, volumes
      - Commodity descriptions
      - Customer associations

    - `import_shipment_documents`
      - Document tracking for imports
      - Bill of lading, customs docs, certificates
      - Upload timestamps and status

    - `import_shipment_charges`
      - All charges associated with import shipment
      - Linked to rate sheets
      - Revenue and cost tracking
      - Margin calculations

  2. Features
    - Auto-generated shipment numbers with IMP prefix
    - Container linkage for FCL shipments
    - Agent and rate sheet integration
    - Multi-cargo support
    - Document management
    - Comprehensive charge tracking
    - Automated costing from rate sheets

  3. Security
    - Enable RLS on all tables
    - Policies for authenticated users
    - Audit trail with created_by/updated_by

  4. Integration Points
    - Links to agents table
    - Links to rate_sheets table
    - Links to groupage_containers table
    - Links to customers table
    - Links to delivery_zones table
*/

-- Import Shipments Table
CREATE TABLE IF NOT EXISTS import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE NOT NULL,
  container_id uuid REFERENCES groupage_containers(id),
  agent_id uuid,
  rate_sheet_id uuid REFERENCES rate_sheets(id),
  
  shipment_type text NOT NULL CHECK (shipment_type IN ('LCL', 'FCL', 'Air')),
  port_of_loading text,
  port_of_discharge text DEFAULT 'Nhava Sheva',
  
  eta date,
  ata date,
  pre_alert_received boolean DEFAULT false,
  pre_alert_date date,
  
  shipper_name text,
  shipper_address text,
  consignee_name text,
  consignee_address text,
  
  total_packages integer DEFAULT 0,
  total_gross_weight_kg decimal(12, 2) DEFAULT 0,
  total_volume_cbm decimal(12, 2) DEFAULT 0,
  total_chargeable_weight decimal(12, 2) DEFAULT 0,
  
  bl_number text,
  bl_date date,
  vessel_name text,
  voyage_number text,
  
  customs_status text DEFAULT 'pending' CHECK (customs_status IN ('pending', 'in_progress', 'cleared', 'held')),
  customs_cleared_date date,
  
  delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_transit', 'delivered', 'partial')),
  
  total_revenue decimal(12, 2) DEFAULT 0,
  total_cost decimal(12, 2) DEFAULT 0,
  margin_amount decimal(12, 2) DEFAULT 0,
  margin_percentage decimal(8, 2) DEFAULT 0,
  
  internal_notes text,
  customer_notes text,
  
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_transit', 'arrived', 'cleared', 'delivered', 'cancelled')),
  
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Import Shipment Cargo Items
CREATE TABLE IF NOT EXISTS import_shipment_cargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  
  cargo_description text NOT NULL,
  commodity_type text,
  hs_code text,
  
  number_of_packages integer NOT NULL,
  package_type text,
  
  gross_weight_kg decimal(12, 2) NOT NULL,
  net_weight_kg decimal(12, 2),
  volume_cbm decimal(12, 2) NOT NULL,
  chargeable_weight decimal(12, 2),
  
  marks_and_numbers text,
  
  delivery_address text,
  delivery_zone_id uuid REFERENCES delivery_zones(id),
  delivery_instructions text,
  
  cargo_value_usd decimal(12, 2),
  insurance_required boolean DEFAULT false,
  insurance_value decimal(12, 2),
  
  special_handling text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Import Shipment Documents
CREATE TABLE IF NOT EXISTS import_shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  
  document_type text NOT NULL CHECK (document_type IN (
    'bill_of_lading', 'commercial_invoice', 'packing_list', 
    'certificate_of_origin', 'insurance_certificate', 'customs_declaration',
    'import_license', 'inspection_certificate', 'fumigation_certificate',
    'phytosanitary_certificate', 'delivery_order', 'other'
  )),
  
  document_number text,
  document_name text NOT NULL,
  document_url text,
  
  issue_date date,
  expiry_date date,
  
  received_status text DEFAULT 'pending' CHECK (received_status IN ('pending', 'received', 'verified', 'missing')),
  received_date timestamptz,
  
  notes text,
  
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Import Shipment Charges
CREATE TABLE IF NOT EXISTS import_shipment_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_shipment_id uuid REFERENCES import_shipments(id) ON DELETE CASCADE,
  import_cargo_id uuid REFERENCES import_shipment_cargo(id),
  
  charge_category text NOT NULL CHECK (charge_category IN (
    'ocean_freight', 'air_freight', 'customs_clearance', 'port_charges',
    'documentation', 'handling', 'storage', 'delivery', 'insurance', 'other'
  )),
  
  charge_description text NOT NULL,
  charge_code text,
  
  unit_type text CHECK (unit_type IN ('per_shipment', 'per_container', 'per_cbm', 'per_kg', 'per_package', 'percentage')),
  quantity decimal(12, 2) DEFAULT 1,
  
  rate_per_unit decimal(12, 2) DEFAULT 0,
  
  cost_amount decimal(12, 2) DEFAULT 0,
  revenue_amount decimal(12, 2) DEFAULT 0,
  
  currency text DEFAULT 'INR',
  exchange_rate decimal(10, 4) DEFAULT 1,
  
  cost_amount_inr decimal(12, 2) DEFAULT 0,
  revenue_amount_inr decimal(12, 2) DEFAULT 0,
  margin_amount decimal(12, 2) DEFAULT 0,
  
  is_billable boolean DEFAULT true,
  billing_status text DEFAULT 'pending' CHECK (billing_status IN ('pending', 'invoiced', 'paid', 'waived')),
  
  from_rate_sheet boolean DEFAULT false,
  rate_sheet_item_id uuid,
  
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE import_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipment_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_shipment_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_shipments
CREATE POLICY "Users can view all import shipments"
  ON import_shipments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create import shipments"
  ON import_shipments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update import shipments"
  ON import_shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = updated_by);

CREATE POLICY "Users can delete import shipments"
  ON import_shipments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for import_shipment_cargo
CREATE POLICY "Users can view all cargo items"
  ON import_shipment_cargo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create cargo items"
  ON import_shipment_cargo FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update cargo items"
  ON import_shipment_cargo FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete cargo items"
  ON import_shipment_cargo FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for import_shipment_documents
CREATE POLICY "Users can view all documents"
  ON import_shipment_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload documents"
  ON import_shipment_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update documents"
  ON import_shipment_documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete documents"
  ON import_shipment_documents FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for import_shipment_charges
CREATE POLICY "Users can view all charges"
  ON import_shipment_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create charges"
  ON import_shipment_charges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update charges"
  ON import_shipment_charges FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete charges"
  ON import_shipment_charges FOR DELETE
  TO authenticated
  USING (true);

-- Function to generate import shipment number
CREATE OR REPLACE FUNCTION generate_import_shipment_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  new_shipment_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(shipment_number FROM 'IMP-(\d+)') AS integer)), 0) + 1
  INTO next_number
  FROM import_shipments
  WHERE shipment_number LIKE 'IMP-%';
  
  new_shipment_number := 'IMP-' || LPAD(next_number::text, 6, '0');
  
  RETURN new_shipment_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_import_shipment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_import_shipments_updated_at
  BEFORE UPDATE ON import_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_import_shipment_updated_at();

CREATE TRIGGER update_import_shipment_cargo_updated_at
  BEFORE UPDATE ON import_shipment_cargo
  FOR EACH ROW
  EXECUTE FUNCTION update_import_shipment_updated_at();

CREATE TRIGGER update_import_shipment_charges_updated_at
  BEFORE UPDATE ON import_shipment_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_import_shipment_updated_at();

-- Function to calculate shipment totals
CREATE OR REPLACE FUNCTION calculate_import_shipment_totals(p_shipment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE import_shipments
  SET 
    total_packages = (
      SELECT COALESCE(SUM(number_of_packages), 0)
      FROM import_shipment_cargo
      WHERE import_shipment_id = p_shipment_id
    ),
    total_gross_weight_kg = (
      SELECT COALESCE(SUM(gross_weight_kg), 0)
      FROM import_shipment_cargo
      WHERE import_shipment_id = p_shipment_id
    ),
    total_volume_cbm = (
      SELECT COALESCE(SUM(volume_cbm), 0)
      FROM import_shipment_cargo
      WHERE import_shipment_id = p_shipment_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(cost_amount_inr), 0)
      FROM import_shipment_charges
      WHERE import_shipment_id = p_shipment_id
    ),
    total_revenue = (
      SELECT COALESCE(SUM(revenue_amount_inr), 0)
      FROM import_shipment_charges
      WHERE import_shipment_id = p_shipment_id AND is_billable = true
    )
  WHERE id = p_shipment_id;
  
  UPDATE import_shipments
  SET 
    margin_amount = total_revenue - total_cost,
    margin_percentage = CASE 
      WHEN total_cost > 0 THEN ((total_revenue - total_cost) / total_cost) * 100
      ELSE 0
    END
  WHERE id = p_shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_shipments_agent ON import_shipments(agent_id);
CREATE INDEX IF NOT EXISTS idx_import_shipments_container ON import_shipments(container_id);
CREATE INDEX IF NOT EXISTS idx_import_shipments_status ON import_shipments(status);
CREATE INDEX IF NOT EXISTS idx_import_shipments_eta ON import_shipments(eta);
CREATE INDEX IF NOT EXISTS idx_import_shipment_cargo_shipment ON import_shipment_cargo(import_shipment_id);
CREATE INDEX IF NOT EXISTS idx_import_shipment_cargo_customer ON import_shipment_cargo(customer_id);
CREATE INDEX IF NOT EXISTS idx_import_shipment_documents_shipment ON import_shipment_documents(import_shipment_id);
CREATE INDEX IF NOT EXISTS idx_import_shipment_charges_shipment ON import_shipment_charges(import_shipment_id);

-- Comments
COMMENT ON TABLE import_shipments IS 'Import shipments tracking with container, agent, and rate sheet linkage';
COMMENT ON TABLE import_shipment_cargo IS 'Cargo items within import shipments with customer associations';
COMMENT ON TABLE import_shipment_documents IS 'Document management for import shipments';
COMMENT ON TABLE import_shipment_charges IS 'All charges (cost and revenue) for import shipments with margin tracking';
COMMENT ON COLUMN import_shipments.pre_alert_received IS 'Whether pre-alert notification has been received from agent';
COMMENT ON COLUMN import_shipment_charges.from_rate_sheet IS 'Indicates if charge was auto-applied from rate sheet';