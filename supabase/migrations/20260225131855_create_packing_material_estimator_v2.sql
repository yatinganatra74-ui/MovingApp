/*
  # Packing Material Estimator Schema

  ## Overview
  Creates a rule-based packing material estimation system that automatically suggests
  required materials based on item types, dimensions, and attributes.

  ## New Tables

  1. `item_categories` - Item type categorization
  2. `packing_material_rules` - Rules for material suggestions
  3. `packing_material_estimates` - Saved estimates per survey
  4. `survey_item_materials` - Materials assigned to specific items

  ## Functions
  - `estimate_packing_materials()` - Calculate materials for a survey
  - `get_material_suggestions()` - Get suggestions for an item

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create item categories table
CREATE TABLE IF NOT EXISTS item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  description text,
  icon text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert standard item categories
INSERT INTO item_categories (category_name, description, icon) VALUES
  ('Furniture - Seating', 'Sofas, chairs, benches', 'armchair'),
  ('Furniture - Tables', 'Dining tables, coffee tables, desks', 'table'),
  ('Furniture - Storage', 'Wardrobes, cabinets, drawers', 'cabinet'),
  ('Furniture - Beds', 'Beds, mattresses, bed frames', 'bed'),
  ('Electronics', 'TVs, computers, appliances', 'tv'),
  ('Glassware & China', 'Plates, glasses, decorative glass', 'wine'),
  ('Artwork & Mirrors', 'Paintings, frames, mirrors', 'frame'),
  ('Kitchen Items', 'Pots, pans, utensils', 'utensils'),
  ('Books & Documents', 'Books, files, papers', 'book'),
  ('Clothing & Textiles', 'Clothes, curtains, linens', 'shirt'),
  ('Fragile Decoratives', 'Vases, ornaments, collectibles', 'sparkles'),
  ('Outdoor Items', 'Garden furniture, tools', 'tree'),
  ('Appliances - Large', 'Refrigerators, washing machines', 'refrigerator'),
  ('Appliances - Small', 'Microwaves, toasters, blenders', 'microwave'),
  ('Sports Equipment', 'Exercise gear, sports items', 'dumbbell'),
  ('Other', 'Miscellaneous items', 'box')
ON CONFLICT (category_name) DO NOTHING;

-- Create packing material rules table
CREATE TABLE IF NOT EXISTS packing_material_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  item_category_id uuid REFERENCES item_categories(id),
  item_keywords text[] DEFAULT ARRAY[]::text[],
  is_fragile_required boolean DEFAULT false,
  needs_dismantling boolean DEFAULT false,
  volume_min_cbm decimal(10,4) DEFAULT 0,
  volume_max_cbm decimal(10,4) DEFAULT 999999,
  materials_required jsonb DEFAULT '[]'::jsonb,
  priority integer DEFAULT 100,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert comprehensive packing rules
INSERT INTO packing_material_rules (rule_name, item_keywords, is_fragile_required, materials_required, priority) VALUES
  ('Sofa Standard', ARRAY['sofa', 'couch', 'settee', 'loveseat'], false, 
   '[{"material":"Bubble Wrap","quantity_per_item":5,"unit":"meters"},{"material":"Corrugated Cardboard","quantity_per_item":3,"unit":"sheets"},{"material":"Stretch Film","quantity_per_item":2,"unit":"rolls"}]'::jsonb, 10),
  
  ('Chair Standard', ARRAY['chair', 'stool', 'armchair', 'recliner'], false,
   '[{"material":"Bubble Wrap","quantity_per_item":2,"unit":"meters"},{"material":"Stretch Film","quantity_per_item":1,"unit":"rolls"}]'::jsonb, 20),
  
  ('Dining Table', ARRAY['dining table', 'table', 'desk'], false,
   '[{"material":"Bubble Wrap","quantity_per_item":3,"unit":"meters"},{"material":"Corrugated Cardboard","quantity_per_item":2,"unit":"sheets"},{"material":"Furniture Blanket","quantity_per_item":2,"unit":"pieces"}]'::jsonb, 30),
  
  ('Wardrobe/Cabinet', ARRAY['wardrobe', 'cabinet', 'cupboard', 'armoire', 'closet'], false,
   '[{"material":"Corrugated Cardboard","quantity_per_item":4,"unit":"sheets"},{"material":"Stretch Film","quantity_per_item":3,"unit":"rolls"},{"material":"Furniture Blanket","quantity_per_item":2,"unit":"pieces"}]'::jsonb, 40),
  
  ('Bed Frame', ARRAY['bed', 'bed frame', 'headboard', 'footboard'], false,
   '[{"material":"Bubble Wrap","quantity_per_item":4,"unit":"meters"},{"material":"Corrugated Cardboard","quantity_per_item":3,"unit":"sheets"},{"material":"Furniture Blanket","quantity_per_item":2,"unit":"pieces"}]'::jsonb, 50),
  
  ('Mattress', ARRAY['mattress', 'box spring'], false,
   '[{"material":"Mattress Bag","quantity_per_item":1,"unit":"pieces"},{"material":"Stretch Film","quantity_per_item":1,"unit":"rolls"}]'::jsonb, 60),
  
  ('Glassware', ARRAY['glass', 'wine glass', 'champagne', 'tumbler', 'goblet'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":0.5,"unit":"meters"},{"material":"Packing Paper","quantity_per_item":3,"unit":"sheets"},{"material":"Small Carton","quantity_per_item":0.1,"unit":"boxes"}]'::jsonb, 70),
  
  ('Plates & China', ARRAY['plate', 'dish', 'bowl', 'china', 'porcelain', 'ceramic'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":0.3,"unit":"meters"},{"material":"Packing Paper","quantity_per_item":2,"unit":"sheets"},{"material":"Dish Pack Box","quantity_per_item":0.05,"unit":"boxes"}]'::jsonb, 80),
  
  ('TV/Monitor', ARRAY['tv', 'television', 'monitor', 'screen', 'led', 'lcd', 'plasma'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":4,"unit":"meters"},{"material":"TV Box","quantity_per_item":1,"unit":"boxes"},{"material":"Corner Protectors","quantity_per_item":4,"unit":"pieces"}]'::jsonb, 90),
  
  ('Electronics', ARRAY['laptop', 'computer', 'printer', 'speaker', 'stereo', 'dvd'], false,
   '[{"material":"Bubble Wrap","quantity_per_item":2,"unit":"meters"},{"material":"Small Carton","quantity_per_item":1,"unit":"boxes"},{"material":"Packing Paper","quantity_per_item":5,"unit":"sheets"}]'::jsonb, 100),
  
  ('Artwork/Mirrors', ARRAY['painting', 'picture', 'frame', 'mirror', 'artwork', 'canvas'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":3,"unit":"meters"},{"material":"Corner Protectors","quantity_per_item":4,"unit":"pieces"},{"material":"Mirror Box","quantity_per_item":1,"unit":"boxes"},{"material":"Packing Paper","quantity_per_item":5,"unit":"sheets"}]'::jsonb, 110),
  
  ('Books', ARRAY['book', 'books', 'documents', 'files', 'papers'], false,
   '[{"material":"Small Carton","quantity_per_item":0.05,"unit":"boxes"},{"material":"Packing Paper","quantity_per_item":1,"unit":"sheets"}]'::jsonb, 120),
  
  ('Clothing', ARRAY['clothes', 'clothing', 'wardrobe', 'garments', 'dress', 'suit'], false,
   '[{"material":"Wardrobe Box","quantity_per_item":0.1,"unit":"boxes"},{"material":"Packing Paper","quantity_per_item":2,"unit":"sheets"}]'::jsonb, 130),
  
  ('Lamps', ARRAY['lamp', 'lampshade', 'light fixture', 'chandelier'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":3,"unit":"meters"},{"material":"Packing Paper","quantity_per_item":4,"unit":"sheets"},{"material":"Small Carton","quantity_per_item":1,"unit":"boxes"}]'::jsonb, 140),
  
  ('Refrigerator', ARRAY['refrigerator', 'fridge', 'freezer'], false,
   '[{"material":"Furniture Blanket","quantity_per_item":3,"unit":"pieces"},{"material":"Stretch Film","quantity_per_item":2,"unit":"rolls"},{"material":"Appliance Dolly","quantity_per_item":1,"unit":"equipment"}]'::jsonb, 150),
  
  ('Washing Machine', ARRAY['washing machine', 'washer', 'dryer', 'dishwasher'], false,
   '[{"material":"Furniture Blanket","quantity_per_item":2,"unit":"pieces"},{"material":"Stretch Film","quantity_per_item":2,"unit":"rolls"},{"material":"Transit Bolts","quantity_per_item":1,"unit":"set"}]'::jsonb, 160),
  
  ('Microwave/Small Appliances', ARRAY['microwave', 'toaster', 'blender', 'coffee maker', 'kettle'], false,
   '[{"material":"Bubble Wrap","quantity_per_item":2,"unit":"meters"},{"material":"Small Carton","quantity_per_item":1,"unit":"boxes"},{"material":"Packing Paper","quantity_per_item":3,"unit":"sheets"}]'::jsonb, 170),
  
  ('Vases/Decoratives', ARRAY['vase', 'ornament', 'figurine', 'statue', 'decoration'], true,
   '[{"material":"Bubble Wrap","quantity_per_item":2,"unit":"meters"},{"material":"Packing Paper","quantity_per_item":4,"unit":"sheets"},{"material":"Small Carton","quantity_per_item":0.5,"unit":"boxes"}]'::jsonb, 180),
  
  ('General Fragile', ARRAY[]::text[], true,
   '[{"material":"Bubble Wrap","quantity_per_item":2,"unit":"meters"},{"material":"Packing Paper","quantity_per_item":3,"unit":"sheets"}]'::jsonb, 999);

-- Create packing material estimates table
CREATE TABLE IF NOT EXISTS packing_material_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  material_breakdown jsonb DEFAULT '{}'::jsonb,
  total_cost decimal(10,2) DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text
);

-- Create survey item materials table
CREATE TABLE IF NOT EXISTS survey_item_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_item_id uuid REFERENCES survey_items_detailed(id) ON DELETE CASCADE,
  material_type_id uuid REFERENCES material_types(id),
  material_name text,
  quantity_needed decimal(10,2) DEFAULT 0,
  unit text DEFAULT 'pieces',
  auto_suggested boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_material_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_material_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_item_materials ENABLE ROW LEVEL SECURITY;

-- Policies for item_categories
CREATE POLICY "Anyone can view item_categories"
  ON item_categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage item_categories"
  ON item_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for packing_material_rules
CREATE POLICY "Anyone can view packing_material_rules"
  ON packing_material_rules FOR SELECT
  USING (active = true);

CREATE POLICY "Authenticated users can manage packing_material_rules"
  ON packing_material_rules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for packing_material_estimates
CREATE POLICY "Authenticated users can view packing_material_estimates"
  ON packing_material_estimates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage packing_material_estimates"
  ON packing_material_estimates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for survey_item_materials
CREATE POLICY "Authenticated users can manage survey_item_materials"
  ON survey_item_materials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to get material suggestions for an item
CREATE OR REPLACE FUNCTION get_material_suggestions(
  p_item_name text,
  p_is_fragile boolean,
  p_needs_dismantling boolean,
  p_volume_cbm decimal
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_materials jsonb DEFAULT '[]'::jsonb;
  v_rule record;
  v_keyword text;
  v_match boolean;
BEGIN
  FOR v_rule IN 
    SELECT * FROM packing_material_rules
    WHERE active = true
      AND (is_fragile_required = false OR is_fragile_required = p_is_fragile)
      AND (needs_dismantling = false OR needs_dismantling = p_needs_dismantling)
      AND p_volume_cbm >= volume_min_cbm
      AND p_volume_cbm <= volume_max_cbm
    ORDER BY priority ASC
  LOOP
    v_match := false;
    
    IF array_length(v_rule.item_keywords, 1) IS NULL OR array_length(v_rule.item_keywords, 1) = 0 THEN
      v_match := true;
    ELSE
      FOREACH v_keyword IN ARRAY v_rule.item_keywords
      LOOP
        IF LOWER(p_item_name) LIKE '%' || LOWER(v_keyword) || '%' THEN
          v_match := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    IF v_match THEN
      v_materials := v_rule.materials_required;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_materials;
END;
$$;

-- Function to calculate total materials for a survey
CREATE OR REPLACE FUNCTION estimate_survey_materials(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_item record;
  v_materials jsonb;
  v_material record;
  v_totals jsonb DEFAULT '{}'::jsonb;
  v_material_key text;
  v_current_qty decimal;
BEGIN
  FOR v_item IN 
    SELECT * FROM survey_items_detailed
    WHERE survey_id = p_survey_id
  LOOP
    v_materials := get_material_suggestions(
      v_item.item_name,
      v_item.is_fragile,
      v_item.needs_dismantling,
      v_item.volume_cbm
    );
    
    FOR v_material IN SELECT * FROM jsonb_to_recordset(v_materials) 
      AS x(material text, quantity_per_item decimal, unit text)
    LOOP
      v_material_key := v_material.material || ' (' || v_material.unit || ')';
      
      IF v_totals ? v_material_key THEN
        v_current_qty := (v_totals->v_material_key->'quantity')::decimal;
        v_totals := jsonb_set(
          v_totals,
          ARRAY[v_material_key, 'quantity'],
          to_jsonb(v_current_qty + (v_material.quantity_per_item * v_item.quantity))
        );
      ELSE
        v_totals := jsonb_set(
          v_totals,
          ARRAY[v_material_key],
          jsonb_build_object(
            'material', v_material.material,
            'quantity', v_material.quantity_per_item * v_item.quantity,
            'unit', v_material.unit
          )
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_totals;
END;
$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_packing_material_rules_active ON packing_material_rules(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_packing_material_estimates_survey ON packing_material_estimates(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_item_materials_item ON survey_item_materials(survey_item_id);