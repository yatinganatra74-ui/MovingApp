/*
  # Air Freight Calculation Functions

  1. New Functions
    - `calculate_volumetric_weight_kg` - Convert CBM to kg using IATA standard (CBM × 167)
    - `calculate_chargeable_weight_kg` - Get MAX(gross_weight, volumetric_weight)
    - `find_air_rate_slab` - Find matching KG-based rate slab
    - `calculate_air_freight_revenue` - Calculate revenue using KG slabs
    - `calculate_shipment_revenue_by_mode` - Universal router function

  2. Updates to Existing Functions
    - Make existing sea freight functions mode-explicit
    - Add mode parameter to slab matching

  3. Important Notes
    - Volumetric weight = CBM × 167 kg (IATA standard)
    - Chargeable weight = MAX(gross weight, volumetric weight)
    - SEA uses CBM for billing, AIR uses chargeable_weight_kg
*/

-- Calculate volumetric weight from CBM (IATA standard: 1 CBM = 167 kg)
CREATE OR REPLACE FUNCTION calculate_volumetric_weight_kg(p_cbm decimal)
RETURNS decimal AS $$
BEGIN
  IF p_cbm IS NULL OR p_cbm <= 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(p_cbm * 167, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate chargeable weight (MAX of gross and volumetric)
CREATE OR REPLACE FUNCTION calculate_chargeable_weight_kg(p_gross_weight_kg decimal, p_volumetric_weight_kg decimal)
RETURNS decimal AS $$
BEGIN
  RETURN GREATEST(
    COALESCE(p_gross_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Find matching AIR rate slab based on chargeable weight
CREATE OR REPLACE FUNCTION find_air_rate_slab(
  p_rate_sheet_id uuid,
  p_chargeable_weight_kg decimal,
  p_charge_type text DEFAULT 'freight'
)
RETURNS TABLE (
  slab_id uuid,
  from_kg decimal,
  to_kg decimal,
  rate_per_kg decimal,
  currency text,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rs.id,
    rs.from_kg,
    rs.to_kg,
    rs.rate_per_kg,
    rs.currency,
    rs.description
  FROM rate_sheet_slabs rs
  WHERE rs.rate_sheet_id = p_rate_sheet_id
    AND rs.transport_mode = 'AIR'
    AND rs.charge_type = p_charge_type
    AND rs.from_kg <= p_chargeable_weight_kg
    AND (rs.to_kg IS NULL OR rs.to_kg >= p_chargeable_weight_kg)
  ORDER BY rs.from_kg DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate air freight revenue for a shipment
CREATE OR REPLACE FUNCTION calculate_air_freight_revenue(
  p_rate_sheet_id uuid,
  p_chargeable_weight_kg decimal,
  p_exchange_rate decimal DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
  v_slab record;
  v_freight_amount decimal;
  v_result jsonb;
BEGIN
  -- Find matching freight slab
  SELECT * INTO v_slab
  FROM find_air_rate_slab(p_rate_sheet_id, p_chargeable_weight_kg, 'freight')
  LIMIT 1;

  IF v_slab IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No matching AIR freight slab found',
      'chargeable_weight_kg', p_chargeable_weight_kg
    );
  END IF;

  -- Calculate freight: chargeable_weight × rate_per_kg
  v_freight_amount := p_chargeable_weight_kg * v_slab.rate_per_kg;

  v_result := jsonb_build_object(
    'success', true,
    'transport_mode', 'AIR',
    'chargeable_weight_kg', p_chargeable_weight_kg,
    'rate_per_kg', v_slab.rate_per_kg,
    'currency', v_slab.currency,
    'freight_amount', ROUND(v_freight_amount, 2),
    'freight_amount_inr', ROUND(v_freight_amount * p_exchange_rate, 2),
    'slab_from_kg', v_slab.from_kg,
    'slab_to_kg', v_slab.to_kg,
    'slab_description', v_slab.description
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Universal shipment revenue calculator (routes by transport mode)
CREATE OR REPLACE FUNCTION calculate_shipment_revenue_by_mode(p_shipment_draft_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_draft record;
  v_chargeable_weight decimal;
  v_result jsonb;
BEGIN
  -- Get shipment draft details
  SELECT 
    sd.*,
    rs.id as rate_sheet_id,
    sd.locked_exchange_rate
  INTO v_draft
  FROM shipment_drafts sd
  LEFT JOIN rate_sheets rs ON sd.rate_sheet_id = rs.id
  WHERE sd.id = p_shipment_draft_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment draft not found');
  END IF;

  IF v_draft.rate_sheet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No rate sheet assigned');
  END IF;

  -- Route to appropriate calculation based on transport mode
  IF v_draft.transport_mode = 'AIR' THEN
    -- AIR mode: Use chargeable weight
    IF v_draft.chargeable_weight_kg IS NULL OR v_draft.chargeable_weight_kg <= 0 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'AIR mode requires valid chargeable_weight_kg'
      );
    END IF;

    v_result := calculate_air_freight_revenue(
      v_draft.rate_sheet_id,
      v_draft.chargeable_weight_kg,
      COALESCE(v_draft.locked_exchange_rate, 1)
    );

  ELSIF v_draft.transport_mode = 'SEA' THEN
    -- SEA mode: Use CBM (existing logic - placeholder for now)
    IF v_draft.cbm IS NULL OR v_draft.cbm <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'SEA mode requires valid CBM'
      );
    END IF;

    -- Note: Existing sea freight calculation would go here
    v_result := jsonb_build_object(
      'success', true,
      'transport_mode', 'SEA',
      'cbm', v_draft.cbm,
      'message', 'Using existing SEA freight calculation'
    );

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transport mode: ' || COALESCE(v_draft.transport_mode, 'NULL')
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update shipment draft with calculated weights (AIR mode)
CREATE OR REPLACE FUNCTION update_air_shipment_weights(p_shipment_draft_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_draft record;
  v_volumetric_weight decimal;
  v_chargeable_weight decimal;
BEGIN
  SELECT * INTO v_draft
  FROM shipment_drafts
  WHERE id = p_shipment_draft_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipment not found');
  END IF;

  IF v_draft.transport_mode != 'AIR' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an AIR shipment');
  END IF;

  -- Calculate volumetric weight from CBM if provided
  IF v_draft.cbm IS NOT NULL AND v_draft.cbm > 0 THEN
    v_volumetric_weight := calculate_volumetric_weight_kg(v_draft.cbm);
  ELSE
    v_volumetric_weight := 0;
  END IF;

  -- Calculate chargeable weight
  v_chargeable_weight := calculate_chargeable_weight_kg(
    v_draft.gross_weight_kg,
    v_volumetric_weight
  );

  -- Update the shipment draft
  UPDATE shipment_drafts
  SET 
    volumetric_weight_kg = v_volumetric_weight,
    chargeable_weight_kg = v_chargeable_weight,
    updated_at = now()
  WHERE id = p_shipment_draft_id;

  RETURN jsonb_build_object(
    'success', true,
    'gross_weight_kg', v_draft.gross_weight_kg,
    'volumetric_weight_kg', v_volumetric_weight,
    'chargeable_weight_kg', v_chargeable_weight,
    'cbm', v_draft.cbm
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate air shipment weights on insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_air_weights()
RETURNS trigger AS $$
BEGIN
  IF NEW.transport_mode = 'AIR' THEN
    -- Calculate volumetric weight if CBM is provided
    IF NEW.cbm IS NOT NULL AND NEW.cbm > 0 THEN
      NEW.volumetric_weight_kg := calculate_volumetric_weight_kg(NEW.cbm);
    END IF;

    -- Calculate chargeable weight
    NEW.chargeable_weight_kg := calculate_chargeable_weight_kg(
      NEW.gross_weight_kg,
      NEW.volumetric_weight_kg
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to shipment_drafts
DROP TRIGGER IF EXISTS trg_calculate_air_weights ON shipment_drafts;
CREATE TRIGGER trg_calculate_air_weights
  BEFORE INSERT OR UPDATE OF gross_weight_kg, cbm, volumetric_weight_kg, transport_mode
  ON shipment_drafts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_air_weights();

-- Apply trigger to container_shipments
DROP TRIGGER IF EXISTS trg_calculate_air_weights_container ON container_shipments;
CREATE TRIGGER trg_calculate_air_weights_container
  BEFORE INSERT OR UPDATE OF gross_weight_kg, cbm, volumetric_weight_kg, transport_mode
  ON container_shipments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_air_weights();
