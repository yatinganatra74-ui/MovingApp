/*
  # Enhanced Survey Management System

  ## Overview
  Extends the existing survey system with room-based tracking, dimensions, and automatic volume calculations.

  ## New Tables

  1. `survey_rooms` - Predefined room categories
  2. `survey_items_detailed` - Enhanced item tracking with dimensions
  3. `survey_videos` - Video survey recordings
  4. `survey_video_tags` - Timestamp-based video annotations

  ## Enhancements to Existing Tables
  - Add fields to `surveys` table
  - Keep existing `survey_items` for compatibility

  ## Security
  - RLS enabled on all tables
  - Authenticated user policies
*/

-- Create survey rooms lookup table
CREATE TABLE IF NOT EXISTS survey_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name text NOT NULL UNIQUE,
  room_category text DEFAULT 'residential',
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert standard rooms
INSERT INTO survey_rooms (room_name, room_category, display_order) VALUES
  ('Living Room', 'residential', 1),
  ('Dining Room', 'residential', 2),
  ('Kitchen', 'residential', 3),
  ('Master Bedroom', 'residential', 4),
  ('Bedroom 2', 'residential', 5),
  ('Bedroom 3', 'residential', 6),
  ('Bedroom 4', 'residential', 7),
  ('Bathroom', 'residential', 8),
  ('Garage', 'residential', 9),
  ('Garden/Outdoor', 'residential', 10),
  ('Basement', 'residential', 11),
  ('Attic', 'residential', 12),
  ('Study/Office', 'residential', 13),
  ('Laundry Room', 'residential', 14),
  ('Hallway', 'residential', 15),
  ('Storage Room', 'residential', 16),
  ('Balcony/Patio', 'residential', 17),
  ('Office Space', 'commercial', 18),
  ('Conference Room', 'commercial', 19),
  ('Reception', 'commercial', 20),
  ('Storage Unit', 'storage', 21),
  ('Other', 'residential', 99)
ON CONFLICT (room_name) DO NOTHING;

-- Create enhanced survey items table with detailed dimensions
CREATE TABLE IF NOT EXISTS survey_items_detailed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  room_id uuid REFERENCES survey_rooms(id),
  custom_room_name text,
  item_name text NOT NULL,
  quantity integer DEFAULT 1,
  length_cm decimal(10,2) DEFAULT 0,
  width_cm decimal(10,2) DEFAULT 0,
  height_cm decimal(10,2) DEFAULT 0,
  volume_cbm decimal(10,4) DEFAULT 0,
  is_fragile boolean DEFAULT false,
  needs_dismantling boolean DEFAULT false,
  special_handling text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create survey videos table
CREATE TABLE IF NOT EXISTS survey_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  video_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  notes text
);

-- Create survey video tags table
CREATE TABLE IF NOT EXISTS survey_video_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES survey_videos(id) ON DELETE CASCADE NOT NULL,
  timestamp_seconds integer NOT NULL,
  tag_type text DEFAULT 'item',
  room_id uuid REFERENCES survey_rooms(id),
  item_name text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Add fields to surveys table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'total_volume_cbm'
  ) THEN
    ALTER TABLE surveys ADD COLUMN total_volume_cbm decimal(10,4) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'total_items_count'
  ) THEN
    ALTER TABLE surveys ADD COLUMN total_items_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'surveyor_name'
  ) THEN
    ALTER TABLE surveys ADD COLUMN surveyor_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'survey_mode'
  ) THEN
    ALTER TABLE surveys ADD COLUMN survey_mode text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE surveys ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE survey_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_items_detailed ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_video_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for survey_rooms
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view survey_rooms" ON survey_rooms;
  DROP POLICY IF EXISTS "Authenticated users can manage survey_rooms" ON survey_rooms;
END $$;

CREATE POLICY "Anyone can view survey_rooms"
  ON survey_rooms FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage survey_rooms"
  ON survey_rooms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for survey_items_detailed
CREATE POLICY "Authenticated users can view survey_items_detailed"
  ON survey_items_detailed FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create survey_items_detailed"
  ON survey_items_detailed FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update survey_items_detailed"
  ON survey_items_detailed FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete survey_items_detailed"
  ON survey_items_detailed FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for survey_videos
CREATE POLICY "Authenticated users can view survey_videos"
  ON survey_videos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload survey_videos"
  ON survey_videos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update survey_videos"
  ON survey_videos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete survey_videos"
  ON survey_videos FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for survey_video_tags
CREATE POLICY "Authenticated users can manage survey_video_tags"
  ON survey_video_tags FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to calculate volume in cubic meters
CREATE OR REPLACE FUNCTION calculate_item_volume_detailed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.volume_cbm := (NEW.length_cm * NEW.width_cm * NEW.height_cm * NEW.quantity) / 1000000.0;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-calculate volume
DROP TRIGGER IF EXISTS calculate_volume_trigger_detailed ON survey_items_detailed;
CREATE TRIGGER calculate_volume_trigger_detailed
  BEFORE INSERT OR UPDATE ON survey_items_detailed
  FOR EACH ROW
  EXECUTE FUNCTION calculate_item_volume_detailed();

-- Function to update survey totals from detailed items
CREATE OR REPLACE FUNCTION update_survey_totals_detailed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  survey_uuid uuid;
  total_vol decimal;
  total_qty integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    survey_uuid := OLD.survey_id;
  ELSE
    survey_uuid := NEW.survey_id;
  END IF;

  SELECT 
    COALESCE(SUM(volume_cbm), 0),
    COALESCE(SUM(quantity), 0)
  INTO total_vol, total_qty
  FROM survey_items_detailed
  WHERE survey_id = survey_uuid;

  UPDATE surveys
  SET 
    total_volume_cbm = total_vol,
    total_items_count = total_qty
  WHERE id = survey_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update survey totals
DROP TRIGGER IF EXISTS update_survey_totals_trigger_detailed ON survey_items_detailed;
CREATE TRIGGER update_survey_totals_trigger_detailed
  AFTER INSERT OR UPDATE OR DELETE ON survey_items_detailed
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_totals_detailed();

-- Function to get survey summary by room
CREATE OR REPLACE FUNCTION get_survey_room_summary(survey_uuid uuid)
RETURNS TABLE (
  room_name text,
  total_items bigint,
  total_volume decimal,
  fragile_items bigint,
  dismantling_items bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(sr.room_name, si.custom_room_name, 'Uncategorized') as room_name,
    COUNT(si.id) as total_items,
    COALESCE(SUM(si.volume_cbm), 0) as total_volume,
    COUNT(CASE WHEN si.is_fragile THEN 1 END) as fragile_items,
    COUNT(CASE WHEN si.needs_dismantling THEN 1 END) as dismantling_items
  FROM survey_items_detailed si
  LEFT JOIN survey_rooms sr ON si.room_id = sr.id
  WHERE si.survey_id = survey_uuid
  GROUP BY COALESCE(sr.room_name, si.custom_room_name, 'Uncategorized')
  ORDER BY room_name;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_survey_items_detailed_survey_id ON survey_items_detailed(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_items_detailed_room_id ON survey_items_detailed(room_id);
CREATE INDEX IF NOT EXISTS idx_survey_videos_survey_id ON survey_videos(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_video_tags_video_id ON survey_video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_survey_rooms_active ON survey_rooms(active) WHERE active = true;