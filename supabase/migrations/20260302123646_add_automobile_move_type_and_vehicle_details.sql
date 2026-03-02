/*
  # Add Automobile Move Type and Vehicle Details

  ## Overview
  This migration adds support for automobile moves with vehicle details to the leads table.

  ## Changes Made

  ### Leads Table
  - Update move_type constraint to include 'automobile_move'
  - Add `vehicle_types` column (text array) to store selected vehicle types (motorbike, motorcar, both)
  - Add `vehicle_quantities` column (jsonb) to store quantities for each vehicle type
    Example: {"motorbike": 2, "motorcar": 1}

  ## Data Safety
  - Uses conditional logic to safely add columns if they don't exist
  - No data loss
*/

-- Add vehicle_types column to leads table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'vehicle_types'
  ) THEN
    ALTER TABLE leads ADD COLUMN vehicle_types text[];
  END IF;
END $$;

-- Add vehicle_quantities column to leads table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'vehicle_quantities'
  ) THEN
    ALTER TABLE leads ADD COLUMN vehicle_quantities jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update leads table move_type constraint to include automobile_move
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_move_type_check'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT leads_move_type_check;
  END IF;
  
  -- Add new constraint with automobile_move included
  ALTER TABLE leads 
  ADD CONSTRAINT leads_move_type_check 
  CHECK (move_type IN ('local_move', 'office_move', 'inbound_move', 'outbound_move', 'automobile_move'));
END $$;

COMMENT ON COLUMN leads.vehicle_types IS 'Array of vehicle types for automobile moves: motorbike, motorcar';
COMMENT ON COLUMN leads.vehicle_quantities IS 'JSON object storing quantity of each vehicle type, e.g., {"motorbike": 2, "motorcar": 1}';
