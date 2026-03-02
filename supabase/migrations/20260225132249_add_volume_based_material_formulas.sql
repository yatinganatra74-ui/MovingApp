/*
  # Volume-Based Material Calculation Formulas

  ## Overview
  Adds formula-based material calculations using total volume (CBM) and item counts
  to provide more accurate estimates for consumable materials like cartons, tape,
  bubble wrap, and other packing supplies.

  ## New Table

  1. `material_calculation_formulas` - Formula-based material calculations
     - `id` (uuid, primary key)
     - `material_name` (text) - Name of the material
     - `formula_type` (text) - cbm_based, item_count_based, fragile_count_based
     - `multiplier` (decimal) - Multiplier for the formula
     - `divisor` (decimal) - Divisor for the formula
     - `base_quantity` (decimal) - Base quantity to add
     - `unit` (text) - Unit of measurement
     - `description` (text) - Human-readable formula description
     - `active` (boolean)

  ## Updated Functions
  - Enhanced `estimate_survey_materials()` to include volume-based calculations

  ## Example Formulas
  - Cartons Required = Total CBM × 0.8
  - Bubble Roll = Fragile Items × 2 meters
  - Tape Rolls = Total Cartons ÷ 10
  - Stretch Film = Total CBM × 0.5
  - Packing Paper = Fragile Items × 5 sheets

  ## Security
  - RLS enabled
  - Authenticated user policies
*/

-- Create material calculation formulas table
CREATE TABLE IF NOT EXISTS material_calculation_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL UNIQUE,
  formula_type text NOT NULL CHECK (formula_type IN ('cbm_based', 'item_count_based', 'fragile_count_based', 'carton_based')),
  multiplier decimal(10,4) DEFAULT 1,
  divisor decimal(10,4) DEFAULT 1,
  base_quantity decimal(10,2) DEFAULT 0,
  unit text NOT NULL,
  description text,
  priority integer DEFAULT 100,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert standard material formulas
INSERT INTO material_calculation_formulas 
  (material_name, formula_type, multiplier, divisor, unit, description, priority) 
VALUES
  ('Standard Cartons', 'cbm_based', 0.8, 1, 'boxes', 'Total CBM × 0.8 = Number of standard cartons needed', 10),
  ('Bubble Wrap Roll', 'fragile_count_based', 2, 1, 'meters', 'Fragile Items × 2 meters = Total bubble wrap needed', 20),
  ('Packing Tape', 'carton_based', 1, 10, 'rolls', 'Total Cartons ÷ 10 = Tape rolls needed', 30),
  ('Stretch Film', 'cbm_based', 0.5, 1, 'rolls', 'Total CBM × 0.5 = Stretch film rolls needed', 40),
  ('Packing Paper Bundle', 'fragile_count_based', 5, 1, 'sheets', 'Fragile Items × 5 sheets = Packing paper needed', 50),
  ('Furniture Covers', 'cbm_based', 0.3, 1, 'pieces', 'Total CBM × 0.3 = Furniture covers needed', 60),
  ('Labels & Markers', 'carton_based', 1, 5, 'sets', 'Total Cartons ÷ 5 = Label sets needed', 70),
  ('Corner Protectors', 'cbm_based', 0.4, 1, 'pieces', 'Total CBM × 0.4 = Corner protectors needed', 80),
  ('Rope/Twine', 'cbm_based', 0.2, 1, 'meters', 'Total CBM × 0.2 = Rope needed for securing', 90),
  ('Mattress Bags', 'item_count_based', 0.05, 1, 'pieces', 'Estimates based on typical mattress count (5% of items)', 100);

-- Enable RLS
ALTER TABLE material_calculation_formulas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view material_calculation_formulas"
  ON material_calculation_formulas FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated users can manage material_calculation_formulas"
  ON material_calculation_formulas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enhanced function to calculate volume-based materials
CREATE OR REPLACE FUNCTION calculate_formula_based_materials(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_cbm decimal;
  v_total_items integer;
  v_fragile_items integer;
  v_formula record;
  v_materials jsonb DEFAULT '{}'::jsonb;
  v_material_key text;
  v_calculated_qty decimal;
  v_carton_count decimal DEFAULT 0;
BEGIN
  SELECT 
    COALESCE(SUM(volume_cbm), 0),
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(CASE WHEN is_fragile THEN quantity ELSE 0 END), 0)
  INTO v_total_cbm, v_total_items, v_fragile_items
  FROM survey_items_detailed
  WHERE survey_id = p_survey_id;
  
  FOR v_formula IN 
    SELECT * FROM material_calculation_formulas
    WHERE active = true
    ORDER BY priority ASC
  LOOP
    v_calculated_qty := 0;
    
    CASE v_formula.formula_type
      WHEN 'cbm_based' THEN
        v_calculated_qty := (v_total_cbm * v_formula.multiplier / v_formula.divisor) + v_formula.base_quantity;
        
      WHEN 'item_count_based' THEN
        v_calculated_qty := (v_total_items * v_formula.multiplier / v_formula.divisor) + v_formula.base_quantity;
        
      WHEN 'fragile_count_based' THEN
        v_calculated_qty := (v_fragile_items * v_formula.multiplier / v_formula.divisor) + v_formula.base_quantity;
        
      WHEN 'carton_based' THEN
        IF v_carton_count = 0 THEN
          v_carton_count := v_total_cbm * 0.8;
        END IF;
        v_calculated_qty := (v_carton_count * v_formula.multiplier / v_formula.divisor) + v_formula.base_quantity;
    END CASE;
    
    IF v_formula.material_name = 'Standard Cartons' THEN
      v_carton_count := v_calculated_qty;
    END IF;
    
    IF v_calculated_qty > 0 THEN
      v_material_key := v_formula.material_name || ' (' || v_formula.unit || ')';
      
      v_materials := jsonb_set(
        v_materials,
        ARRAY[v_material_key],
        jsonb_build_object(
          'material', v_formula.material_name,
          'quantity', ROUND(v_calculated_qty, 2),
          'unit', v_formula.unit,
          'formula', v_formula.description,
          'type', 'formula_based'
        )
      );
    END IF;
  END LOOP;
  
  RETURN v_materials;
END;
$$;

-- Enhanced master estimation function combining item-based and formula-based
CREATE OR REPLACE FUNCTION estimate_survey_materials_complete(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_materials jsonb;
  v_formula_materials jsonb;
  v_combined jsonb DEFAULT '{}'::jsonb;
  v_key text;
  v_value jsonb;
BEGIN
  v_item_materials := estimate_survey_materials(p_survey_id);
  v_formula_materials := calculate_formula_based_materials(p_survey_id);
  
  v_combined := v_item_materials;
  
  FOR v_key, v_value IN SELECT * FROM jsonb_each(v_formula_materials)
  LOOP
    IF NOT (v_combined ? v_key) THEN
      v_combined := jsonb_set(
        v_combined,
        ARRAY[v_key],
        v_value
      );
    END IF;
  END LOOP;
  
  RETURN v_combined;
END;
$$;

-- Create view for survey material summary
CREATE OR REPLACE VIEW survey_material_summary AS
SELECT 
  s.id as survey_id,
  s.customer_id,
  c.name as customer_name,
  s.total_volume_cbm,
  s.total_items_count,
  (SELECT COUNT(*) FROM survey_items_detailed sid WHERE sid.survey_id = s.id AND sid.is_fragile = true) as fragile_items_count,
  ROUND(s.total_volume_cbm * 0.8, 0) as estimated_cartons,
  ROUND((SELECT COUNT(*) FROM survey_items_detailed sid WHERE sid.survey_id = s.id AND sid.is_fragile = true) * 2, 0) as estimated_bubble_wrap_meters,
  ROUND(s.total_volume_cbm * 0.8 / 10, 0) as estimated_tape_rolls,
  s.created_at
FROM surveys s
LEFT JOIN customers c ON s.customer_id = c.id;

-- Grant access to view
GRANT SELECT ON survey_material_summary TO authenticated;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_material_formulas_active ON material_calculation_formulas(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_material_formulas_type ON material_calculation_formulas(formula_type);