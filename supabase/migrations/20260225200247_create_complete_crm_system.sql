/*
  # Complete CRM System with Multi-Tenant Support

  ## Overview
  This migration creates a comprehensive CRM system with:
  - Lead management and scoring
  - Multi-tenant support (company isolation)
  - Communication tracking
  - Conversion workflows (Lead → Customer → Quote → Job)
  - Customer lifetime value tracking
  - Task and follow-up management

  ## New Tables

  1. `leads` - Lead capture and management
     - `id` (uuid, primary key)
     - `company_id` (uuid) - multi-tenant support
     - `lead_source` (text) - website, referral, phone, email, social
     - `status` (text) - new, contacted, qualified, unqualified, converted
     - `contact_name` (text)
     - `company_name` (text)
     - `email` (text)
     - `phone` (text)
     - `address` (text)
     - `city` (text)
     - `state` (text)
     - `country` (text)
     - `move_type` (text) - domestic, international, corporate
     - `estimated_volume_cbm` (numeric)
     - `move_date` (date)
     - `lead_score` (integer) - 0-100
     - `assigned_to` (uuid) - sales rep
     - `notes` (text)
     - `converted_to_customer_id` (uuid)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. `crm_communications` - Track all customer/lead interactions
     - `id` (uuid, primary key)
     - `company_id` (uuid)
     - `entity_type` (text) - lead, customer
     - `entity_id` (uuid)
     - `communication_type` (text) - email, call, sms, meeting, note
     - `direction` (text) - inbound, outbound
     - `subject` (text)
     - `content` (text)
     - `status` (text) - scheduled, completed, cancelled
     - `scheduled_at` (timestamptz)
     - `completed_at` (timestamptz)
     - `created_by` (uuid)
     - `created_at` (timestamptz)

  3. `crm_tasks` - Follow-up tasks and reminders
     - `id` (uuid, primary key)
     - `company_id` (uuid)
     - `entity_type` (text) - lead, customer, quote, job
     - `entity_id` (uuid)
     - `task_type` (text) - follow_up, send_quote, schedule_survey, close_deal
     - `title` (text)
     - `description` (text)
     - `priority` (text) - low, medium, high, urgent
     - `status` (text) - pending, in_progress, completed, cancelled
     - `due_date` (timestamptz)
     - `assigned_to` (uuid)
     - `completed_at` (timestamptz)
     - `created_at` (timestamptz)

  4. `customer_revenue_summary` - Track customer lifetime value
     - `id` (uuid, primary key)
     - `company_id` (uuid)
     - `customer_id` (uuid)
     - `total_quotes` (integer)
     - `total_jobs` (integer)
     - `total_revenue` (numeric)
     - `total_profit` (numeric)
     - `first_job_date` (timestamptz)
     - `last_job_date` (timestamptz)
     - `updated_at` (timestamptz)

  5. `lead_conversion_history` - Track conversion funnel
     - `id` (uuid, primary key)
     - `company_id` (uuid)
     - `lead_id` (uuid)
     - `previous_status` (text)
     - `new_status` (text)
     - `converted_to_customer_id` (uuid)
     - `converted_at` (timestamptz)
     - `converted_by` (uuid)
     - `notes` (text)

  ## Table Modifications

  Add `company_id` to existing CRM tables for multi-tenant support:
  - customers
  - quotes  
  - surveys
  - jobs
  - customer_addresses
  - customer_contacts
  - documents
  - job_status_history

  ## Functions

  1. `calculate_lead_score()` - Auto-score leads based on criteria
  2. `convert_lead_to_customer()` - Convert qualified lead to customer
  3. `update_customer_revenue()` - Maintain revenue summary

  ## Security
  - Enable RLS on all new tables
  - Add company_id based policies for multi-tenant isolation
  - Authenticated users can only access their company's data
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  lead_source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new',
  contact_name text NOT NULL,
  company_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  move_type text,
  estimated_volume_cbm numeric DEFAULT 0,
  move_date date,
  lead_score integer DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id),
  notes text,
  converted_to_customer_id uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create CRM communications table
CREATE TABLE IF NOT EXISTS crm_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  communication_type text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  subject text,
  content text,
  status text DEFAULT 'completed',
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create CRM tasks table
CREATE TABLE IF NOT EXISTS crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  due_date timestamptz,
  assigned_to uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create customer revenue summary table
CREATE TABLE IF NOT EXISTS customer_revenue_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  total_quotes integer DEFAULT 0,
  total_jobs integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  total_profit numeric DEFAULT 0,
  first_job_date timestamptz,
  last_job_date timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, customer_id)
);

-- Create lead conversion history table
CREATE TABLE IF NOT EXISTS lead_conversion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  converted_to_customer_id uuid REFERENCES customers(id),
  converted_at timestamptz DEFAULT now(),
  converted_by uuid REFERENCES auth.users(id),
  notes text
);

-- Add company_id to existing tables if not exists
DO $$
BEGIN
  -- Add company_id to customers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
  END IF;

  -- Add company_id to quotes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
  END IF;

  -- Add company_id to surveys
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE surveys ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_surveys_company_id ON surveys(company_id);
  END IF;

  -- Add company_id to jobs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
  END IF;

  -- Add company_id to customer_addresses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_addresses' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customer_addresses ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_company_id ON customer_addresses(company_id);
  END IF;

  -- Add company_id to customer_contacts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_contacts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customer_contacts ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id ON customer_contacts(company_id);
  END IF;

  -- Add company_id to documents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
  END IF;

  -- Add converted_to_job_id to quotes if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'converted_to_job_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN converted_to_job_id uuid REFERENCES jobs(id);
  END IF;

  -- Add converted_to_quote_id to surveys if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'converted_to_quote_id'
  ) THEN
    ALTER TABLE surveys ADD COLUMN converted_to_quote_id uuid REFERENCES quotes(id);
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_revenue_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_conversion_history ENABLE ROW LEVEL SECURITY;

-- Create multi-tenant policies for leads
CREATE POLICY "Users can view leads in their company"
  ON leads FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create leads in their company"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update leads in their company"
  ON leads FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete leads in their company"
  ON leads FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Create multi-tenant policies for communications
CREATE POLICY "Users can view communications in their company"
  ON crm_communications FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create communications in their company"
  ON crm_communications FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update communications in their company"
  ON crm_communications FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete communications in their company"
  ON crm_communications FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Create multi-tenant policies for tasks
CREATE POLICY "Users can view tasks in their company"
  ON crm_tasks FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create tasks in their company"
  ON crm_tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update tasks in their company"
  ON crm_tasks FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete tasks in their company"
  ON crm_tasks FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Create multi-tenant policies for revenue summary
CREATE POLICY "Users can view revenue in their company"
  ON customer_revenue_summary FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage revenue in their company"
  ON customer_revenue_summary FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Create multi-tenant policies for conversion history
CREATE POLICY "Users can view conversion history in their company"
  ON lead_conversion_history FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create conversion history in their company"
  ON lead_conversion_history FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Function to calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_row leads)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  score integer := 0;
BEGIN
  -- Has email
  IF lead_row.email IS NOT NULL AND lead_row.email != '' THEN
    score := score + 10;
  END IF;
  
  -- Has phone
  IF lead_row.phone IS NOT NULL AND lead_row.phone != '' THEN
    score := score + 10;
  END IF;
  
  -- Has company name
  IF lead_row.company_name IS NOT NULL AND lead_row.company_name != '' THEN
    score := score + 15;
  END IF;
  
  -- Has move date
  IF lead_row.move_date IS NOT NULL THEN
    score := score + 20;
    -- Move date within 3 months
    IF lead_row.move_date <= CURRENT_DATE + INTERVAL '3 months' THEN
      score := score + 15;
    END IF;
  END IF;
  
  -- Has estimated volume
  IF lead_row.estimated_volume_cbm > 0 THEN
    score := score + 10;
  END IF;
  
  -- Lead source scoring
  CASE lead_row.lead_source
    WHEN 'referral' THEN score := score + 20;
    WHEN 'website' THEN score := score + 10;
    WHEN 'phone' THEN score := score + 15;
    ELSE score := score + 5;
  END CASE;
  
  RETURN LEAST(score, 100);
END;
$$;

-- Function to auto-update lead score
CREATE OR REPLACE FUNCTION auto_update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.lead_score := calculate_lead_score(NEW);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update lead score
DROP TRIGGER IF EXISTS lead_score_update_trigger ON leads;
CREATE TRIGGER lead_score_update_trigger
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_lead_score();

-- Function to convert lead to customer
CREATE OR REPLACE FUNCTION convert_lead_to_customer(
  p_lead_id uuid,
  p_company_id uuid,
  p_converted_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead leads;
  v_customer_id uuid;
BEGIN
  -- Get lead details
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND company_id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  
  IF v_lead.status = 'converted' THEN
    RAISE EXCEPTION 'Lead already converted';
  END IF;
  
  -- Create customer
  INSERT INTO customers (
    company_id,
    name,
    company_name,
    email,
    phone,
    address,
    customer_type,
    notes
  ) VALUES (
    p_company_id,
    v_lead.contact_name,
    v_lead.company_name,
    v_lead.email,
    v_lead.phone,
    v_lead.address,
    CASE WHEN v_lead.company_name IS NOT NULL THEN 'corporate' ELSE 'individual' END,
    v_lead.notes
  )
  RETURNING id INTO v_customer_id;
  
  -- Update lead status
  UPDATE leads
  SET 
    status = 'converted',
    converted_to_customer_id = v_customer_id,
    updated_at = now()
  WHERE id = p_lead_id;
  
  -- Log conversion
  INSERT INTO lead_conversion_history (
    company_id,
    lead_id,
    previous_status,
    new_status,
    converted_to_customer_id,
    converted_by
  ) VALUES (
    p_company_id,
    p_lead_id,
    v_lead.status,
    'converted',
    v_customer_id,
    p_converted_by
  );
  
  RETURN v_customer_id;
END;
$$;

-- Function to update customer revenue
CREATE OR REPLACE FUNCTION update_customer_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO customer_revenue_summary (
    company_id,
    customer_id,
    total_jobs,
    total_revenue,
    total_profit,
    first_job_date,
    last_job_date
  )
  SELECT
    NEW.company_id,
    NEW.customer_id,
    1,
    COALESCE(NEW.total_price, 0),
    COALESCE(NEW.total_price - NEW.total_cost, 0),
    NEW.created_at,
    NEW.created_at
  ON CONFLICT (company_id, customer_id)
  DO UPDATE SET
    total_jobs = customer_revenue_summary.total_jobs + 1,
    total_revenue = customer_revenue_summary.total_revenue + COALESCE(NEW.total_price, 0),
    total_profit = customer_revenue_summary.total_profit + COALESCE(NEW.total_price - NEW.total_cost, 0),
    last_job_date = NEW.created_at,
    updated_at = now();
    
  RETURN NEW;
END;
$$;

-- Trigger to update revenue on job creation
DROP TRIGGER IF EXISTS job_revenue_update_trigger ON jobs;
CREATE TRIGGER job_revenue_update_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL AND NEW.company_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_revenue();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_company_status ON leads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);

CREATE INDEX IF NOT EXISTS idx_crm_communications_entity ON crm_communications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_communications_company ON crm_communications(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_company_status ON crm_tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON crm_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_customer_revenue_company ON customer_revenue_summary(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_revenue_customer ON customer_revenue_summary(customer_id);

CREATE INDEX IF NOT EXISTS idx_lead_conversion_lead ON lead_conversion_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversion_company ON lead_conversion_history(company_id, converted_at DESC);
