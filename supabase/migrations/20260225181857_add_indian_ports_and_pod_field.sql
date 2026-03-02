/*
  # Add Indian Ports/ICDs and Update POD Field

  ## Overview
  Replace "ETA Nhava Sheva" with "ETA POD (Port of Discharge)" and add comprehensive list of Indian ports and ICDs.

  ## New Tables

  ### 1. `indian_ports_icds`
  Reference table for all major ports and ICDs in India
  - `id` (uuid, primary key)
  - `port_code` (text, unique) - Standard port code
  - `port_name` (text) - Full name
  - `port_type` (text) - seaport/icd/cfs
  - `state` (text) - Indian state
  - `city` (text) - City location
  - `is_active` (boolean) - Active status
  - `display_order` (integer) - Sort order

  ## Changes

  ### Containers Table
  - Rename `eta_nhava_sheva` to `eta_pod`
  - Add `pod_name` (text) - Port of Discharge name
  - Add `pod_code` (text) - Port code reference

  ## Security
  - RLS enabled on new table
  - Public read access for reference data
*/

-- Create indian_ports_icds reference table
CREATE TABLE IF NOT EXISTS indian_ports_icds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_code text UNIQUE NOT NULL,
  port_name text NOT NULL,
  port_type text NOT NULL,
  state text,
  city text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 999,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indian_ports_icds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view indian_ports_icds"
  ON indian_ports_icds FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Rename eta_nhava_sheva to eta_pod and add pod fields
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'eta_nhava_sheva') THEN
    ALTER TABLE containers RENAME COLUMN eta_nhava_sheva TO eta_pod;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'eta_pod') THEN
    ALTER TABLE containers ADD COLUMN eta_pod date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'pod_name') THEN
    ALTER TABLE containers ADD COLUMN pod_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'pod_code') THEN
    ALTER TABLE containers ADD COLUMN pod_code text;
  END IF;
END $$;

-- Insert comprehensive list of Indian Ports and ICDs
INSERT INTO indian_ports_icds (port_code, port_name, port_type, state, city, display_order) VALUES
-- Major Seaports
('INNSA', 'Nhava Sheva (JNPT)', 'seaport', 'Maharashtra', 'Mumbai', 1),
('INMUN', 'Mumbai Port', 'seaport', 'Maharashtra', 'Mumbai', 2),
('INMAA', 'Chennai Port', 'seaport', 'Tamil Nadu', 'Chennai', 3),
('INIXE', 'Mangalore Port', 'seaport', 'Karnataka', 'Mangalore', 4),
('INCOK', 'Kochi/Cochin Port', 'seaport', 'Kerala', 'Kochi', 5),
('INVTZ', 'Visakhapatnam Port', 'seaport', 'Andhra Pradesh', 'Visakhapatnam', 6),
('INBLR', 'Bangalore ICD', 'icd', 'Karnataka', 'Bangalore', 7),
('INDEL', 'Delhi ICD (Tughlakabad)', 'icd', 'Delhi', 'Delhi', 8),
('INKOL', 'Kolkata Port', 'seaport', 'West Bengal', 'Kolkata', 9),
('INGAU', 'Guwahati ICD', 'icd', 'Assam', 'Guwahati', 10),
('INPAV', 'Pipavav Port', 'seaport', 'Gujarat', 'Pipavav', 11),
('INMDR', 'Mundra Port', 'seaport', 'Gujarat', 'Mundra', 12),
('INHZR', 'Hazira Port', 'seaport', 'Gujarat', 'Hazira', 13),
('INKDI', 'Kandla Port', 'seaport', 'Gujarat', 'Kandla', 14),
('INTUT', 'Tuticorin Port', 'seaport', 'Tamil Nadu', 'Tuticorin', 15),

-- Major ICDs
('INTUG', 'Tughlakabad ICD', 'icd', 'Delhi', 'Delhi', 20),
('INDAD', 'Dadri ICD', 'icd', 'Uttar Pradesh', 'Greater Noida', 21),
('INWHF', 'Whitefield ICD', 'icd', 'Karnataka', 'Bangalore', 22),
('INPAT', 'Patparganj ICD', 'icd', 'Delhi', 'Delhi', 23),
('INLKO', 'Lucknow ICD', 'icd', 'Uttar Pradesh', 'Lucknow', 24),
('INJPR', 'Jaipur ICD', 'icd', 'Rajasthan', 'Jaipur', 25),
('INAGR', 'Agra ICD', 'icd', 'Uttar Pradesh', 'Agra', 26),
('INAMO', 'Amritsar ICD', 'icd', 'Punjab', 'Amritsar', 27),
('INLDH', 'Ludhiana ICD', 'icd', 'Punjab', 'Ludhiana', 28),
('INPNQ', 'Pune ICD (Dighi)', 'icd', 'Maharashtra', 'Pune', 29),
('INNAG', 'Nagpur ICD', 'icd', 'Maharashtra', 'Nagpur', 30),
('ININD', 'Indore ICD', 'icd', 'Madhya Pradesh', 'Indore', 31),
('INAHD', 'Ahmedabad ICD', 'icd', 'Gujarat', 'Ahmedabad', 32),
('INVNS', 'Varanasi ICD', 'icd', 'Uttar Pradesh', 'Varanasi', 33),
('INBHO', 'Bhopal ICD', 'icd', 'Madhya Pradesh', 'Bhopal', 34),

-- Additional Seaports
('INKAT', 'Kakinada Port', 'seaport', 'Andhra Pradesh', 'Kakinada', 40),
('INNMU', 'New Mangalore Port', 'seaport', 'Karnataka', 'Mangalore', 41),
('INCRM', 'Karaikal Port', 'seaport', 'Puducherry', 'Karaikal', 42),
('INPBD', 'Porbandar Port', 'seaport', 'Gujarat', 'Porbandar', 43),
('INMAR', 'Marmagao Port', 'seaport', 'Goa', 'Vasco da Gama', 44),
('INRMD', 'Ratnagiri Port', 'seaport', 'Maharashtra', 'Ratnagiri', 45),
('INPAR', 'Paradip Port', 'seaport', 'Odisha', 'Paradip', 46),
('INHAL', 'Haldia Port', 'seaport', 'West Bengal', 'Haldia', 47),
('INBOM', 'Mumbai (Bombay) Port', 'seaport', 'Maharashtra', 'Mumbai', 48),

-- CFS and Additional ICDs
('INMCFS', 'Mumbai CFS', 'cfs', 'Maharashtra', 'Mumbai', 50),
('INCHECFS', 'Chennai CFS', 'cfs', 'Tamil Nadu', 'Chennai', 51),
('INKCFS', 'Kochi CFS', 'cfs', 'Kerala', 'Kochi', 52),
('INVTZCFS', 'Vizag CFS', 'cfs', 'Andhra Pradesh', 'Visakhapatnam', 53),
('INBLRCFS', 'Bangalore CFS', 'cfs', 'Karnataka', 'Bangalore', 54),
('INHYD', 'Hyderabad ICD', 'icd', 'Telangana', 'Hyderabad', 55),
('INCOICD', 'Coimbatore ICD', 'icd', 'Tamil Nadu', 'Coimbatore', 56),
('INVIJICD', 'Vijayawada ICD', 'icd', 'Andhra Pradesh', 'Vijayawada', 57),
('INRJKICD', 'Rajkot ICD', 'icd', 'Gujarat', 'Rajkot', 58),
('INSURICD', 'Surat ICD', 'icd', 'Gujarat', 'Surat', 59),
('INJAMICD', 'Jammu ICD', 'icd', 'Jammu & Kashmir', 'Jammu', 60),
('INCHDICD', 'Chandigarh ICD', 'icd', 'Chandigarh', 'Chandigarh', 61),
('INSMLICD', 'Sonipat ICD', 'icd', 'Haryana', 'Sonipat', 62),
('INBALICD', 'Ballabhgarh ICD', 'icd', 'Haryana', 'Faridabad', 63),
('INKANICD', 'Kanpur ICD', 'icd', 'Uttar Pradesh', 'Kanpur', 64),
('INALLICD', 'Allahabad ICD', 'icd', 'Uttar Pradesh', 'Allahabad', 65),
('INGORICICD', 'Gorakhpur ICD', 'icd', 'Uttar Pradesh', 'Gorakhpur', 66),
('INBHUICD', 'Bhubaneswar ICD', 'icd', 'Odisha', 'Bhubaneswar', 67),
('INRANCICD', 'Ranchi ICD', 'icd', 'Jharkhand', 'Ranchi', 68),
('INPATNICD', 'Patna ICD', 'icd', 'Bihar', 'Patna', 69),
('INSILIGCD', 'Siliguri ICD', 'icd', 'West Bengal', 'Siliguri', 70)
ON CONFLICT (port_code) DO NOTHING;

-- Update existing view to use new field names
DROP VIEW IF EXISTS import_container_utilization;

CREATE OR REPLACE VIEW import_container_utilization AS
SELECT
  c.id as container_id,
  c.container_number,
  c.container_type,
  c.agent_name,
  c.origin_country,
  c.eta_pod,
  c.pod_name,
  c.pod_code,
  c.estimated_total_cbm,
  c.estimated_container_cost,
  c.status,
  COALESCE(SUM(ica.allocated_cbm), 0) as used_cbm,
  c.estimated_total_cbm - COALESCE(SUM(ica.allocated_cbm), 0) as available_cbm,
  CASE
    WHEN c.estimated_total_cbm > 0 THEN
      ROUND((COALESCE(SUM(ica.allocated_cbm), 0) / c.estimated_total_cbm * 100)::numeric, 2)
    ELSE 0
  END as utilization_percentage,
  COUNT(ica.id) as shipment_count,
  COUNT(CASE WHEN ica.is_confirmed THEN 1 END) as confirmed_shipments,
  COUNT(CASE WHEN NOT ica.is_confirmed THEN 1 END) as draft_shipments
FROM containers c
LEFT JOIN import_container_allocations ica ON c.id = ica.container_id
GROUP BY c.id, c.container_number, c.container_type, c.agent_name, c.origin_country, 
         c.eta_pod, c.pod_name, c.pod_code, c.estimated_total_cbm, c.estimated_container_cost, c.status;

-- Update the create_container_from_prealert function to use new field
CREATE OR REPLACE FUNCTION create_container_from_prealert(
  p_container_number text,
  p_agent_name text,
  p_origin_country text,
  p_eta date,
  p_container_type text,
  p_estimated_cbm numeric,
  p_estimated_cost numeric,
  p_user_id uuid,
  p_pod_name text DEFAULT NULL,
  p_pod_code text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_container_id uuid;
  v_result json;
BEGIN
  SELECT id INTO v_container_id
  FROM containers
  WHERE container_number = p_container_number;
  
  IF v_container_id IS NOT NULL THEN
    UPDATE containers
    SET agent_name = p_agent_name,
        origin_country = p_origin_country,
        eta_pod = p_eta,
        pod_name = p_pod_name,
        pod_code = p_pod_code,
        container_type = p_container_type,
        estimated_total_cbm = p_estimated_cbm,
        estimated_container_cost = p_estimated_cost,
        updated_at = now(),
        status = 'expected'
    WHERE id = v_container_id;
  ELSE
    INSERT INTO containers (
      container_number,
      agent_name,
      origin_country,
      eta_pod,
      pod_name,
      pod_code,
      container_type,
      estimated_total_cbm,
      estimated_container_cost,
      status,
      created_by,
      capacity
    )
    VALUES (
      p_container_number,
      p_agent_name,
      p_origin_country,
      p_eta,
      p_pod_name,
      p_pod_code,
      p_container_type,
      p_estimated_cbm,
      p_estimated_cost,
      'expected',
      p_user_id,
      p_estimated_cbm
    )
    RETURNING id INTO v_container_id;
  END IF;
  
  v_result := json_build_object(
    'success', true,
    'container_id', v_container_id,
    'container_number', p_container_number,
    'status', 'expected'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create index on port lookups
CREATE INDEX IF NOT EXISTS idx_indian_ports_icds_active ON indian_ports_icds(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_containers_eta_pod ON containers(eta_pod);
