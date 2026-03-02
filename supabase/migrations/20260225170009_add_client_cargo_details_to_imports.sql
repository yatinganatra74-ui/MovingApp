/*
  # Add Client & Cargo Details to Import Shipments

  1. Schema Changes
    - Add client and cargo fields to import_shipments table
    - Client name, origin country, delivery details
    - Contact person information
    - Overall shipment totals (CBM, weight, packages)
    - Auto-calculated delivery zone classification

  2. New Features
    - Origin country tracking
    - Delivery address and city
    - Automatic Metro/Non-Metro zone determination
    - Contact person details
    - Shipment-level totals separate from cargo line items

  3. Integration
    - Links to delivery_zones table for city/zone lookup
    - Metro/Non-Metro auto-classification based on city

  4. Notes
    - This is Section 2 of the Import Shipment Creation form
    - Provides high-level client and cargo summary
    - Individual cargo line items still tracked in import_shipment_cargo table
*/

-- Add client and cargo summary fields to import_shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'import_shipments' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE import_shipments
    ADD COLUMN client_name text,
    ADD COLUMN origin_country text,
    ADD COLUMN delivery_address_full text,
    ADD COLUMN delivery_city text,
    ADD COLUMN delivery_zone_type text CHECK (delivery_zone_type IN ('Metro', 'Non-Metro')),
    ADD COLUMN contact_person text,
    ADD COLUMN contact_phone text,
    ADD COLUMN contact_email text,
    ADD COLUMN summary_total_cbm decimal(12, 3),
    ADD COLUMN summary_total_weight_kg decimal(12, 2),
    ADD COLUMN summary_total_packages integer;
  END IF;
END $$;

-- Create a function to auto-determine Metro/Non-Metro based on city
CREATE OR REPLACE FUNCTION determine_metro_classification(p_city text)
RETURNS text AS $$
DECLARE
  metro_cities text[] := ARRAY[
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
    'Kolkata', 'Pune', 'Ahmedabad', 'Surat', 'Jaipur',
    'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane',
    'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara',
    'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
    'Meerut', 'Rajkot', 'Kalyan-Dombivali', 'Vasai-Virar', 'Varanasi',
    'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar', 'Navi Mumbai',
    'Allahabad', 'Ranchi', 'Howrah', 'Coimbatore', 'Jabalpur',
    'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur',
    'Kota', 'Chandigarh', 'Guwahati', 'Solapur', 'Hubli-Dharwad'
  ];
  city_lower text;
BEGIN
  city_lower := LOWER(TRIM(p_city));
  
  IF city_lower = ANY(SELECT LOWER(unnest(metro_cities))) THEN
    RETURN 'Metro';
  ELSE
    RETURN 'Non-Metro';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add index for delivery city lookups
CREATE INDEX IF NOT EXISTS idx_import_shipments_delivery_city 
  ON import_shipments(delivery_city);

-- Comments
COMMENT ON COLUMN import_shipments.client_name IS 'Client/consignee name for this import shipment';
COMMENT ON COLUMN import_shipments.origin_country IS 'Country of origin for the goods';
COMMENT ON COLUMN import_shipments.delivery_address_full IS 'Complete delivery address';
COMMENT ON COLUMN import_shipments.delivery_city IS 'Delivery city for zone classification';
COMMENT ON COLUMN import_shipments.delivery_zone_type IS 'Auto-calculated: Metro or Non-Metro based on city';
COMMENT ON COLUMN import_shipments.contact_person IS 'Primary contact person for delivery';
COMMENT ON COLUMN import_shipments.contact_phone IS 'Contact phone number';
COMMENT ON COLUMN import_shipments.contact_email IS 'Contact email address';
COMMENT ON COLUMN import_shipments.summary_total_cbm IS 'Total CBM summary for the shipment';
COMMENT ON COLUMN import_shipments.summary_total_weight_kg IS 'Total weight summary (optional)';
COMMENT ON COLUMN import_shipments.summary_total_packages IS 'Total number of packages';

-- Create a list of common countries for origin
CREATE TABLE IF NOT EXISTS origin_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name text UNIQUE NOT NULL,
  country_code text UNIQUE NOT NULL,
  region text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 999,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE origin_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view origin countries"
  ON origin_countries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage origin countries"
  ON origin_countries FOR ALL
  TO authenticated
  USING (true);

-- Insert common trading partner countries
INSERT INTO origin_countries (country_name, country_code, region, display_order) VALUES
  ('China', 'CN', 'Asia', 1),
  ('United States', 'US', 'North America', 2),
  ('United Arab Emirates', 'AE', 'Middle East', 3),
  ('Singapore', 'SG', 'Asia', 4),
  ('Germany', 'DE', 'Europe', 5),
  ('United Kingdom', 'GB', 'Europe', 6),
  ('Japan', 'JP', 'Asia', 7),
  ('South Korea', 'KR', 'Asia', 8),
  ('Thailand', 'TH', 'Asia', 9),
  ('Vietnam', 'VN', 'Asia', 10),
  ('Malaysia', 'MY', 'Asia', 11),
  ('Indonesia', 'ID', 'Asia', 12),
  ('Taiwan', 'TW', 'Asia', 13),
  ('Hong Kong', 'HK', 'Asia', 14),
  ('Australia', 'AU', 'Oceania', 15),
  ('Italy', 'IT', 'Europe', 16),
  ('France', 'FR', 'Europe', 17),
  ('Spain', 'ES', 'Europe', 18),
  ('Netherlands', 'NL', 'Europe', 19),
  ('Belgium', 'BE', 'Europe', 20),
  ('Turkey', 'TR', 'Middle East', 21),
  ('Saudi Arabia', 'SA', 'Middle East', 22),
  ('Brazil', 'BR', 'South America', 23),
  ('Mexico', 'MX', 'North America', 24),
  ('Canada', 'CA', 'North America', 25),
  ('South Africa', 'ZA', 'Africa', 26),
  ('Egypt', 'EG', 'Africa', 27),
  ('Israel', 'IL', 'Middle East', 28),
  ('Switzerland', 'CH', 'Europe', 29),
  ('Sweden', 'SE', 'Europe', 30)
ON CONFLICT (country_code) DO NOTHING;

-- Create Indian cities reference table
CREATE TABLE IF NOT EXISTS indian_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text UNIQUE NOT NULL,
  state_name text NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN ('Metro', 'Non-Metro')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE indian_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view indian cities"
  ON indian_cities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage indian cities"
  ON indian_cities FOR ALL
  TO authenticated
  USING (true);

-- Insert major Indian cities with Metro/Non-Metro classification
INSERT INTO indian_cities (city_name, state_name, zone_type) VALUES
  ('Mumbai', 'Maharashtra', 'Metro'),
  ('Delhi', 'Delhi', 'Metro'),
  ('Bangalore', 'Karnataka', 'Metro'),
  ('Hyderabad', 'Telangana', 'Metro'),
  ('Chennai', 'Tamil Nadu', 'Metro'),
  ('Kolkata', 'West Bengal', 'Metro'),
  ('Pune', 'Maharashtra', 'Metro'),
  ('Ahmedabad', 'Gujarat', 'Metro'),
  ('Surat', 'Gujarat', 'Metro'),
  ('Jaipur', 'Rajasthan', 'Metro'),
  ('Lucknow', 'Uttar Pradesh', 'Metro'),
  ('Kanpur', 'Uttar Pradesh', 'Metro'),
  ('Nagpur', 'Maharashtra', 'Metro'),
  ('Indore', 'Madhya Pradesh', 'Metro'),
  ('Thane', 'Maharashtra', 'Metro'),
  ('Bhopal', 'Madhya Pradesh', 'Metro'),
  ('Visakhapatnam', 'Andhra Pradesh', 'Metro'),
  ('Patna', 'Bihar', 'Metro'),
  ('Vadodara', 'Gujarat', 'Metro'),
  ('Ghaziabad', 'Uttar Pradesh', 'Metro'),
  ('Ludhiana', 'Punjab', 'Metro'),
  ('Agra', 'Uttar Pradesh', 'Metro'),
  ('Nashik', 'Maharashtra', 'Metro'),
  ('Faridabad', 'Haryana', 'Metro'),
  ('Meerut', 'Uttar Pradesh', 'Metro'),
  ('Rajkot', 'Gujarat', 'Metro'),
  ('Varanasi', 'Uttar Pradesh', 'Metro'),
  ('Srinagar', 'Jammu and Kashmir', 'Metro'),
  ('Aurangabad', 'Maharashtra', 'Metro'),
  ('Amritsar', 'Punjab', 'Metro'),
  ('Navi Mumbai', 'Maharashtra', 'Metro'),
  ('Allahabad', 'Uttar Pradesh', 'Metro'),
  ('Ranchi', 'Jharkhand', 'Metro'),
  ('Howrah', 'West Bengal', 'Metro'),
  ('Coimbatore', 'Tamil Nadu', 'Metro'),
  ('Jabalpur', 'Madhya Pradesh', 'Metro'),
  ('Gwalior', 'Madhya Pradesh', 'Metro'),
  ('Vijayawada', 'Andhra Pradesh', 'Metro'),
  ('Jodhpur', 'Rajasthan', 'Metro'),
  ('Madurai', 'Tamil Nadu', 'Metro'),
  ('Raipur', 'Chhattisgarh', 'Metro'),
  ('Kota', 'Rajasthan', 'Metro'),
  ('Chandigarh', 'Chandigarh', 'Metro'),
  ('Guwahati', 'Assam', 'Metro'),
  ('Solapur', 'Maharashtra', 'Non-Metro'),
  ('Hubli', 'Karnataka', 'Non-Metro'),
  ('Dharwad', 'Karnataka', 'Non-Metro'),
  ('Mysore', 'Karnataka', 'Non-Metro'),
  ('Tiruchirappalli', 'Tamil Nadu', 'Non-Metro'),
  ('Bareilly', 'Uttar Pradesh', 'Non-Metro'),
  ('Aligarh', 'Uttar Pradesh', 'Non-Metro'),
  ('Moradabad', 'Uttar Pradesh', 'Non-Metro'),
  ('Jalandhar', 'Punjab', 'Non-Metro'),
  ('Bhubaneswar', 'Odisha', 'Non-Metro'),
  ('Salem', 'Tamil Nadu', 'Non-Metro'),
  ('Warangal', 'Telangana', 'Non-Metro'),
  ('Guntur', 'Andhra Pradesh', 'Non-Metro'),
  ('Bhiwandi', 'Maharashtra', 'Non-Metro'),
  ('Saharanpur', 'Uttar Pradesh', 'Non-Metro'),
  ('Gorakhpur', 'Uttar Pradesh', 'Non-Metro'),
  ('Bikaner', 'Rajasthan', 'Non-Metro'),
  ('Amravati', 'Maharashtra', 'Non-Metro'),
  ('Noida', 'Uttar Pradesh', 'Metro'),
  ('Jamshedpur', 'Jharkhand', 'Non-Metro'),
  ('Bhilai', 'Chhattisgarh', 'Non-Metro'),
  ('Cuttack', 'Odisha', 'Non-Metro'),
  ('Kochi', 'Kerala', 'Metro'),
  ('Udaipur', 'Rajasthan', 'Non-Metro'),
  ('Bhavnagar', 'Gujarat', 'Non-Metro'),
  ('Dehradun', 'Uttarakhand', 'Non-Metro'),
  ('Asansol', 'West Bengal', 'Non-Metro'),
  ('Nanded', 'Maharashtra', 'Non-Metro'),
  ('Kolhapur', 'Maharashtra', 'Non-Metro'),
  ('Ajmer', 'Rajasthan', 'Non-Metro'),
  ('Gulbarga', 'Karnataka', 'Non-Metro'),
  ('Jamnagar', 'Gujarat', 'Non-Metro'),
  ('Ujjain', 'Madhya Pradesh', 'Non-Metro'),
  ('Loni', 'Uttar Pradesh', 'Non-Metro'),
  ('Siliguri', 'West Bengal', 'Non-Metro'),
  ('Jhansi', 'Uttar Pradesh', 'Non-Metro'),
  ('Ulhasnagar', 'Maharashtra', 'Non-Metro'),
  ('Nellore', 'Andhra Pradesh', 'Non-Metro'),
  ('Jammu', 'Jammu and Kashmir', 'Non-Metro'),
  ('Mangalore', 'Karnataka', 'Non-Metro'),
  ('Erode', 'Tamil Nadu', 'Non-Metro'),
  ('Belgaum', 'Karnataka', 'Non-Metro'),
  ('Ambattur', 'Tamil Nadu', 'Non-Metro'),
  ('Tirunelveli', 'Tamil Nadu', 'Non-Metro'),
  ('Malegaon', 'Maharashtra', 'Non-Metro'),
  ('Gaya', 'Bihar', 'Non-Metro'),
  ('Tiruppur', 'Tamil Nadu', 'Non-Metro'),
  ('Davanagere', 'Karnataka', 'Non-Metro'),
  ('Kozhikode', 'Kerala', 'Non-Metro'),
  ('Akola', 'Maharashtra', 'Non-Metro'),
  ('Kurnool', 'Andhra Pradesh', 'Non-Metro')
ON CONFLICT (city_name) DO NOTHING;

-- Index for city lookups
CREATE INDEX IF NOT EXISTS idx_indian_cities_name ON indian_cities(city_name);
CREATE INDEX IF NOT EXISTS idx_indian_cities_zone ON indian_cities(zone_type);

-- Comments
COMMENT ON TABLE origin_countries IS 'Reference list of countries for import origin tracking';
COMMENT ON TABLE indian_cities IS 'Indian cities with Metro/Non-Metro classification for delivery zone determination';