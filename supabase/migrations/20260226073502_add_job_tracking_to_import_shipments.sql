/*
  # Add Job Tracking to Import Shipments

  Adds fields to track job creation from inbound shipments:
  - job_created - boolean flag
  - job_id - reference to created job
  - consignee_address - delivery address
*/

-- Add job tracking fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_shipments' AND column_name = 'job_created'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN job_created boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_shipments' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN job_id uuid REFERENCES jobs(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_shipments' AND column_name = 'consignee_address'
  ) THEN
    ALTER TABLE import_shipments ADD COLUMN consignee_address text;
  END IF;
END $$;

-- Create index for job lookups
CREATE INDEX IF NOT EXISTS idx_import_shipments_job_id ON import_shipments(job_id);
CREATE INDEX IF NOT EXISTS idx_import_shipments_agent_id ON import_shipments(agent_id);
CREATE INDEX IF NOT EXISTS idx_import_shipments_job_created ON import_shipments(job_created);
