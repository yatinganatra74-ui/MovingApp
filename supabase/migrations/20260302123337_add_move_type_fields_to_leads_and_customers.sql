/*
  # Add Move Type Fields to Leads and Customers

  ## Overview
  This migration adds proper move type classifications to both leads and customers tables.

  ## Changes Made

  ### Leads Table
  - Update `move_type` column values to use new classification:
    - `local_move` - Local residential moves
    - `office_move` - Office/commercial relocations
    - `inbound_move` - International moves coming in
    - `outbound_move` - International moves going out

  ### Customers Table
  - Add `move_type` column (required field):
    - `individual` - Individual/residential customer
    - `corporate` - Corporate/business customer
  - Set default value to 'individual' for existing records
  - Make the field NOT NULL

  ## Data Safety
  - Uses conditional logic to safely add column if it doesn't exist
  - Sets default value for existing records
  - No data loss
*/

-- Add move_type column to customers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'move_type'
  ) THEN
    ALTER TABLE customers ADD COLUMN move_type text DEFAULT 'individual';
    
    -- Update existing records based on customer_type if it exists
    UPDATE customers 
    SET move_type = CASE 
      WHEN customer_type = 'corporate' THEN 'corporate'
      WHEN customer_type = 'business' THEN 'corporate'
      ELSE 'individual'
    END
    WHERE move_type IS NULL;
    
    -- Make it NOT NULL after setting defaults
    ALTER TABLE customers ALTER COLUMN move_type SET NOT NULL;
  END IF;
END $$;

-- Add constraint to ensure valid move_type values for customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'customers_move_type_check'
  ) THEN
    ALTER TABLE customers 
    ADD CONSTRAINT customers_move_type_check 
    CHECK (move_type IN ('individual', 'corporate'));
  END IF;
END $$;

-- Update leads table move_type constraint if exists
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_move_type_check'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT leads_move_type_check;
  END IF;
  
  -- Add new constraint with updated values
  ALTER TABLE leads 
  ADD CONSTRAINT leads_move_type_check 
  CHECK (move_type IN ('local_move', 'office_move', 'inbound_move', 'outbound_move'));
END $$;

COMMENT ON COLUMN customers.move_type IS 'Type of customer: individual (residential) or corporate (business)';
COMMENT ON COLUMN leads.move_type IS 'Type of move: local_move, office_move, inbound_move, or outbound_move';
