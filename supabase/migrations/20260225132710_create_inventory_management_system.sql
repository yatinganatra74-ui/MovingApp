/*
  # Inventory Management System

  ## Overview
  Complete inventory tracking system for packing materials with stock management,
  reorder levels, automatic alerts, and purchase order suggestions.

  ## New Tables

  1. `packing_materials_inventory` - Master inventory table
     - `id` (uuid, primary key)
     - `material_name` (text) - Name of packing material
     - `material_category` (text) - Category (cartons, wrapping, tape, etc.)
     - `unit` (text) - Unit of measurement
     - `current_stock` (decimal) - Current stock level
     - `reorder_level` (decimal) - Minimum stock level before reorder
     - `reorder_quantity` (decimal) - Standard reorder quantity
     - `unit_cost` (decimal) - Cost per unit
     - `supplier_name` (text) - Primary supplier
     - `supplier_contact` (text) - Supplier contact info
     - `storage_location` (text) - Where material is stored
     - `active` (boolean) - Is material still in use

  2. `stock_transactions` - All stock movements
     - `id` (uuid, primary key)
     - `material_id` (uuid) - Reference to packing_materials_inventory
     - `transaction_type` (text) - IN, OUT, ADJUSTMENT
     - `quantity` (decimal) - Quantity moved
     - `transaction_date` (timestamptz) - When transaction occurred
     - `reference_type` (text) - JOB, PURCHASE, ADJUSTMENT, SURVEY
     - `reference_id` (uuid) - Related job/survey/purchase ID
     - `unit_cost` (decimal) - Cost at time of transaction
     - `notes` (text) - Additional information
     - `created_by` (uuid) - User who created transaction

  3. `purchase_orders` - Material purchase orders
     - `id` (uuid, primary key)
     - `po_number` (text) - Purchase order number
     - `supplier_name` (text) - Supplier name
     - `order_date` (timestamptz) - When order was placed
     - `expected_delivery_date` (timestamptz) - Expected delivery
     - `actual_delivery_date` (timestamptz) - Actual delivery
     - `status` (text) - DRAFT, SENT, RECEIVED, CANCELLED
     - `total_amount` (decimal) - Total order amount
     - `notes` (text) - Order notes
     - `created_by` (uuid) - User who created order

  4. `purchase_order_items` - Line items for purchase orders
     - `id` (uuid, primary key)
     - `po_id` (uuid) - Reference to purchase_orders
     - `material_id` (uuid) - Reference to packing_materials_inventory
     - `quantity` (decimal) - Quantity ordered
     - `unit_cost` (decimal) - Cost per unit
     - `total_cost` (decimal) - Quantity × unit_cost

  5. `low_stock_alerts` - Active low stock alerts
     - `id` (uuid, primary key)
     - `material_id` (uuid) - Reference to packing_materials_inventory
     - `current_stock` (decimal) - Stock level when alert created
     - `reorder_level` (decimal) - Reorder threshold
     - `suggested_order_quantity` (decimal) - Suggested reorder amount
     - `alert_date` (timestamptz) - When alert was created
     - `acknowledged` (boolean) - Has alert been seen
     - `acknowledged_by` (uuid) - User who acknowledged
     - `acknowledged_at` (timestamptz) - When acknowledged

  ## Functions
  - `record_stock_transaction()` - Records stock movement and updates inventory
  - `check_reorder_levels()` - Checks all materials and creates alerts
  - `generate_suggested_po()` - Creates suggested purchase order for low stock items
  - `allocate_materials_to_job()` - Allocates materials from estimate to job
  - `process_po_receipt()` - Processes incoming purchase order

  ## Views
  - `inventory_status` - Current inventory with alerts
  - `stock_movement_summary` - Stock movements by material
  - `pending_purchase_orders` - All pending POs with items

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create packing materials inventory table
CREATE TABLE IF NOT EXISTS packing_materials_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL UNIQUE,
  material_category text NOT NULL CHECK (material_category IN ('cartons', 'wrapping', 'tape', 'protection', 'furniture_covers', 'supplies', 'equipment', 'other')),
  unit text NOT NULL,
  current_stock decimal(10,2) DEFAULT 0 CHECK (current_stock >= 0),
  reorder_level decimal(10,2) DEFAULT 10,
  reorder_quantity decimal(10,2) DEFAULT 50,
  unit_cost decimal(10,2) DEFAULT 0,
  supplier_name text,
  supplier_contact text,
  storage_location text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stock transactions table
CREATE TABLE IF NOT EXISTS stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES packing_materials_inventory(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity decimal(10,2) NOT NULL,
  transaction_date timestamptz DEFAULT now(),
  reference_type text CHECK (reference_type IN ('JOB', 'PURCHASE', 'ADJUSTMENT', 'SURVEY', 'RETURN')),
  reference_id uuid,
  unit_cost decimal(10,2),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_name text NOT NULL,
  order_date timestamptz DEFAULT now(),
  expected_delivery_date timestamptz,
  actual_delivery_date timestamptz,
  status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')),
  total_amount decimal(10,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchase order items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES packing_materials_inventory(id),
  quantity decimal(10,2) NOT NULL CHECK (quantity > 0),
  unit_cost decimal(10,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost decimal(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at timestamptz DEFAULT now()
);

-- Create low stock alerts table
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES packing_materials_inventory(id) ON DELETE CASCADE,
  current_stock decimal(10,2) NOT NULL,
  reorder_level decimal(10,2) NOT NULL,
  suggested_order_quantity decimal(10,2) NOT NULL,
  alert_date timestamptz DEFAULT now(),
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Insert initial inventory items
INSERT INTO packing_materials_inventory 
  (material_name, material_category, unit, current_stock, reorder_level, reorder_quantity, unit_cost, supplier_name) 
VALUES
  ('Standard Carton (Small)', 'cartons', 'boxes', 100, 50, 200, 2.50, 'PackPro Supplies'),
  ('Standard Carton (Medium)', 'cartons', 'boxes', 150, 75, 300, 3.00, 'PackPro Supplies'),
  ('Standard Carton (Large)', 'cartons', 'boxes', 100, 50, 200, 3.50, 'PackPro Supplies'),
  ('Wardrobe Carton', 'cartons', 'boxes', 20, 10, 50, 15.00, 'PackPro Supplies'),
  ('TV Box (Various Sizes)', 'cartons', 'boxes', 30, 15, 50, 8.00, 'PackPro Supplies'),
  ('Bubble Wrap Roll (50m)', 'wrapping', 'rolls', 50, 20, 100, 12.00, 'Wrap Solutions'),
  ('Stretch Film Roll', 'wrapping', 'rolls', 40, 20, 80, 8.50, 'Wrap Solutions'),
  ('Packing Paper Bundle (25kg)', 'wrapping', 'bundles', 25, 10, 50, 18.00, 'Wrap Solutions'),
  ('Packing Tape (50m)', 'tape', 'rolls', 200, 50, 300, 1.50, 'PackPro Supplies'),
  ('Masking Tape', 'tape', 'rolls', 100, 30, 150, 1.20, 'PackPro Supplies'),
  ('Furniture Blanket', 'furniture_covers', 'pieces', 80, 30, 100, 8.00, 'Move Guard'),
  ('Mattress Bag (Single)', 'protection', 'pieces', 40, 15, 60, 3.50, 'Move Guard'),
  ('Mattress Bag (Double)', 'protection', 'pieces', 40, 15, 60, 4.50, 'Move Guard'),
  ('Mattress Bag (King)', 'protection', 'pieces', 30, 10, 50, 5.50, 'Move Guard'),
  ('Corner Protector', 'protection', 'pieces', 100, 40, 200, 0.80, 'Move Guard'),
  ('Rope (100m)', 'supplies', 'rolls', 15, 5, 30, 12.00, 'General Supplies'),
  ('Labels & Markers Set', 'supplies', 'sets', 50, 20, 100, 5.00, 'Office Depot'),
  ('Hand Truck', 'equipment', 'units', 8, 2, 5, 150.00, 'Equipment Pro'),
  ('Furniture Dolly', 'equipment', 'units', 6, 2, 4, 120.00, 'Equipment Pro'),
  ('Straps & Ties Set', 'supplies', 'sets', 30, 10, 50, 15.00, 'Move Guard')
ON CONFLICT (material_name) DO NOTHING;

-- Function to record stock transaction and update inventory
CREATE OR REPLACE FUNCTION record_stock_transaction(
  p_material_id uuid,
  p_transaction_type text,
  p_quantity decimal,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_unit_cost decimal DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id uuid;
  v_quantity_change decimal;
BEGIN
  v_quantity_change := CASE 
    WHEN p_transaction_type = 'IN' THEN p_quantity
    WHEN p_transaction_type = 'OUT' THEN -p_quantity
    ELSE p_quantity
  END;
  
  INSERT INTO stock_transactions (
    material_id, transaction_type, quantity, reference_type, 
    reference_id, unit_cost, notes, created_by
  ) VALUES (
    p_material_id, p_transaction_type, p_quantity, p_reference_type,
    p_reference_id, p_unit_cost, p_notes, p_created_by
  ) RETURNING id INTO v_transaction_id;
  
  UPDATE packing_materials_inventory
  SET 
    current_stock = current_stock + v_quantity_change,
    updated_at = now()
  WHERE id = p_material_id;
  
  PERFORM check_reorder_levels();
  
  RETURN v_transaction_id;
END;
$$;

-- Function to check reorder levels and create alerts
CREATE OR REPLACE FUNCTION check_reorder_levels()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO low_stock_alerts (material_id, current_stock, reorder_level, suggested_order_quantity)
  SELECT 
    id,
    current_stock,
    reorder_level,
    reorder_quantity
  FROM packing_materials_inventory
  WHERE active = true
    AND current_stock <= reorder_level
    AND NOT EXISTS (
      SELECT 1 FROM low_stock_alerts lsa
      WHERE lsa.material_id = packing_materials_inventory.id
        AND lsa.acknowledged = false
        AND lsa.alert_date > now() - interval '7 days'
    );
END;
$$;

-- Function to generate suggested purchase order
CREATE OR REPLACE FUNCTION generate_suggested_po(p_created_by uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_po_id uuid;
  v_po_number text;
  v_total decimal DEFAULT 0;
  v_supplier text;
  v_alert record;
BEGIN
  v_po_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 1000)::text, 3, '0');
  
  SELECT DISTINCT pmi.supplier_name INTO v_supplier
  FROM low_stock_alerts lsa
  JOIN packing_materials_inventory pmi ON lsa.material_id = pmi.id
  WHERE lsa.acknowledged = false
  LIMIT 1;
  
  IF v_supplier IS NULL THEN
    v_supplier := 'General Supplier';
  END IF;
  
  INSERT INTO purchase_orders (po_number, supplier_name, status, created_by)
  VALUES (v_po_number, v_supplier, 'DRAFT', p_created_by)
  RETURNING id INTO v_po_id;
  
  FOR v_alert IN 
    SELECT lsa.material_id, lsa.suggested_order_quantity, pmi.unit_cost
    FROM low_stock_alerts lsa
    JOIN packing_materials_inventory pmi ON lsa.material_id = pmi.id
    WHERE lsa.acknowledged = false
      AND pmi.supplier_name = v_supplier
  LOOP
    INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_cost)
    VALUES (v_po_id, v_alert.material_id, v_alert.suggested_order_quantity, v_alert.unit_cost);
    
    v_total := v_total + (v_alert.suggested_order_quantity * v_alert.unit_cost);
  END LOOP;
  
  UPDATE purchase_orders
  SET total_amount = v_total
  WHERE id = v_po_id;
  
  RETURN v_po_id;
END;
$$;

-- Function to process purchase order receipt
CREATE OR REPLACE FUNCTION process_po_receipt(
  p_po_id uuid,
  p_actual_delivery_date timestamptz DEFAULT now(),
  p_received_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN 
    SELECT material_id, quantity, unit_cost
    FROM purchase_order_items
    WHERE po_id = p_po_id
  LOOP
    PERFORM record_stock_transaction(
      v_item.material_id,
      'IN',
      v_item.quantity,
      'PURCHASE',
      p_po_id,
      v_item.unit_cost,
      'PO Receipt',
      p_received_by
    );
  END LOOP;
  
  UPDATE purchase_orders
  SET 
    status = 'RECEIVED',
    actual_delivery_date = p_actual_delivery_date,
    updated_at = now()
  WHERE id = p_po_id;
  
  UPDATE low_stock_alerts
  SET acknowledged = true, acknowledged_by = p_received_by, acknowledged_at = now()
  WHERE material_id IN (
    SELECT material_id FROM purchase_order_items WHERE po_id = p_po_id
  ) AND acknowledged = false;
END;
$$;

-- Create inventory status view
CREATE OR REPLACE VIEW inventory_status AS
SELECT 
  pmi.id,
  pmi.material_name,
  pmi.material_category,
  pmi.unit,
  pmi.current_stock,
  pmi.reorder_level,
  pmi.reorder_quantity,
  pmi.unit_cost,
  pmi.current_stock * pmi.unit_cost as stock_value,
  pmi.supplier_name,
  pmi.storage_location,
  CASE 
    WHEN pmi.current_stock <= pmi.reorder_level THEN 'LOW'
    WHEN pmi.current_stock <= (pmi.reorder_level * 1.5) THEN 'MEDIUM'
    ELSE 'GOOD'
  END as stock_status,
  EXISTS (
    SELECT 1 FROM low_stock_alerts lsa 
    WHERE lsa.material_id = pmi.id AND lsa.acknowledged = false
  ) as has_active_alert,
  pmi.active
FROM packing_materials_inventory pmi;

-- Create stock movement summary view
CREATE OR REPLACE VIEW stock_movement_summary AS
SELECT 
  pmi.material_name,
  pmi.material_category,
  pmi.unit,
  COUNT(st.id) as transaction_count,
  SUM(CASE WHEN st.transaction_type = 'IN' THEN st.quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN st.transaction_type = 'OUT' THEN st.quantity ELSE 0 END) as total_out,
  SUM(CASE WHEN st.transaction_type = 'ADJUSTMENT' THEN st.quantity ELSE 0 END) as total_adjustments,
  pmi.current_stock
FROM packing_materials_inventory pmi
LEFT JOIN stock_transactions st ON pmi.id = st.material_id
GROUP BY pmi.id, pmi.material_name, pmi.material_category, pmi.unit, pmi.current_stock;

-- Create pending purchase orders view
CREATE OR REPLACE VIEW pending_purchase_orders AS
SELECT 
  po.id as po_id,
  po.po_number,
  po.supplier_name,
  po.order_date,
  po.expected_delivery_date,
  po.status,
  po.total_amount,
  COUNT(poi.id) as item_count,
  json_agg(json_build_object(
    'material_name', pmi.material_name,
    'quantity', poi.quantity,
    'unit_cost', poi.unit_cost,
    'total_cost', poi.total_cost
  )) as items
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
LEFT JOIN packing_materials_inventory pmi ON poi.material_id = pmi.id
WHERE po.status IN ('DRAFT', 'SENT')
GROUP BY po.id, po.po_number, po.supplier_name, po.order_date, po.expected_delivery_date, po.status, po.total_amount;

-- Enable RLS
ALTER TABLE packing_materials_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view inventory"
  ON packing_materials_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage inventory"
  ON packing_materials_inventory FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view stock_transactions"
  ON stock_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stock_transactions"
  ON stock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view purchase_orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage purchase_orders"
  ON purchase_orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view purchase_order_items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage purchase_order_items"
  ON purchase_order_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view low_stock_alerts"
  ON low_stock_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can acknowledge alerts"
  ON low_stock_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material ON stock_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_date ON stock_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_reference ON stock_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_material ON purchase_order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_acknowledged ON low_stock_alerts(acknowledged) WHERE acknowledged = false;
CREATE INDEX IF NOT EXISTS idx_inventory_category ON packing_materials_inventory(material_category) WHERE active = true;

-- Grant access to views
GRANT SELECT ON inventory_status TO authenticated;
GRANT SELECT ON stock_movement_summary TO authenticated;
GRANT SELECT ON pending_purchase_orders TO authenticated;