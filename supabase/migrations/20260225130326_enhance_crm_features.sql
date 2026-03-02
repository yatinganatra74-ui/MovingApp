/*
  # Enhanced CRM Features for Customer & Job Management

  ## New Features
  1. Multiple addresses per customer (pickup, delivery, billing)
  2. Document storage for customers and jobs
  3. Automatic job numbering with sequences
  4. Job status tracking with history/audit trail
  5. Contact persons for customers

  ## New Tables

  1. `customer_addresses` - Multiple addresses per customer
     - `id` (uuid, primary key)
     - `customer_id` (uuid, foreign key)
     - `address_type` (text) - pickup, delivery, billing, office
     - `address_line1` (text)
     - `address_line2` (text)
     - `city` (text)
     - `state` (text)
     - `postal_code` (text)
     - `country` (text)
     - `is_primary` (boolean)
     - `created_at` (timestamptz)

  2. `customer_contacts` - Contact persons for customers
     - `id` (uuid, primary key)
     - `customer_id` (uuid, foreign key)
     - `contact_name` (text)
     - `contact_phone` (text)
     - `contact_email` (text)
     - `designation` (text)
     - `is_primary` (boolean)
     - `created_at` (timestamptz)

  3. `documents` - Document storage and tracking
     - `id` (uuid, primary key)
     - `entity_type` (text) - customer, job, quote, invoice
     - `entity_id` (uuid)
     - `document_type` (text) - passport, invoice, packing_list, etc.
     - `document_name` (text)
     - `file_path` (text)
     - `file_size` (bigint)
     - `mime_type` (text)
     - `uploaded_by` (uuid)
     - `uploaded_at` (timestamptz)
     - `notes` (text)

  4. `job_status_history` - Audit trail for job status changes
     - `id` (uuid, primary key)
     - `job_id` (uuid, foreign key)
     - `old_status` (text)
     - `new_status` (text)
     - `changed_by` (uuid)
     - `changed_at` (timestamptz)
     - `notes` (text)

  5. `job_sequences` - Auto-incrementing job numbers
     - `id` (uuid, primary key)
     - `year` (integer)
     - `month` (integer)
     - `sequence_number` (integer)
     - `last_job_number` (text)

  ## Modifications
  - Add more fields to customers table
  - Add tracking fields to jobs table

  ## Security
  - Enable RLS on all tables
  - Policies for authenticated users
*/

-- Create customer addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  address_type text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create customer contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  designation text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  document_type text NOT NULL,
  document_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  notes text
);

-- Create job status history table
CREATE TABLE IF NOT EXISTS job_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);

-- Create job sequences table
CREATE TABLE IF NOT EXISTS job_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  sequence_number integer DEFAULT 0,
  last_job_number text,
  UNIQUE(year, month)
);

-- Add additional fields to customers table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'customer_type'
  ) THEN
    ALTER TABLE customers ADD COLUMN customer_type text DEFAULT 'individual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tax_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN tax_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'notes'
  ) THEN
    ALTER TABLE customers ADD COLUMN notes text;
  END IF;
END $$;

-- Add tracking fields to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'pickup_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN pickup_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'delivery_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN delivery_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'actual_pickup_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_pickup_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'actual_delivery_date'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_delivery_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE jobs ADD COLUMN priority text DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_to uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sequences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can manage customer_addresses"
  ON customer_addresses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage customer_contacts"
  ON customer_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view job_status_history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create job_status_history"
  ON job_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage job_sequences"
  ON job_sequences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to generate job number
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_year integer;
  current_month integer;
  seq_num integer;
  job_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  
  INSERT INTO job_sequences (year, month, sequence_number)
  VALUES (current_year, current_month, 1)
  ON CONFLICT (year, month)
  DO UPDATE SET sequence_number = job_sequences.sequence_number + 1
  RETURNING sequence_number INTO seq_num;
  
  job_num := 'JOB' || current_year || LPAD(current_month::text, 2, '0') || '-' || LPAD(seq_num::text, 4, '0');
  
  UPDATE job_sequences
  SET last_job_number = job_num
  WHERE year = current_year AND month = current_month;
  
  RETURN job_num;
END;
$$;

-- Create trigger function for job status history
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_status_history (job_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for job status changes
DROP TRIGGER IF EXISTS job_status_change_trigger ON jobs;
CREATE TRIGGER job_status_change_trigger
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);