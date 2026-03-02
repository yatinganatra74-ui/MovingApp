import { supabase } from './supabase';

interface RateLane {
  id: string;
  rate_sheet_id: string;
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  service_type: 'FCL' | 'LCL' | 'Air' | 'Road';
  container_type: string | null;
  base_rate: number;
  fuel_surcharge: number;
  security_fee: number;
  terminal_handling: number;
  documentation_fee: number;
  transit_days: number;
  valid_from: string;
  valid_to: string | null;
}

interface RateCharge {
  id: string;
  rate_sheet_id: string;
  charge_name: string;
  charge_type: 'origin' | 'destination' | 'freight' | 'other';
  unit_type: 'per_shipment' | 'per_container' | 'per_cbm' | 'per_kg' | 'percentage';
  amount: number;
  currency: string;
  is_mandatory: boolean;
  description: string | null;
}

interface RateSheetSearchParams {
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  service_type: 'FCL' | 'LCL' | 'Air' | 'Road';
  container_type?: string;
  shipment_type: 'import' | 'export';
}

interface RateSearchResult {
  lane: RateLane | null;
  charges: RateCharge[];
  total_base_cost: number;
  mandatory_charges: number;
}

export async function searchRates(params: RateSheetSearchParams): Promise<RateSearchResult> {
  const today = new Date().toISOString().split('T')[0];

  const { data: rateSheets, error: sheetsError } = await supabase
    .from('rate_sheets')
    .select('id')
    .eq('type', params.shipment_type)
    .eq('is_active', true)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`);

  if (sheetsError || !rateSheets || rateSheets.length === 0) {
    return {
      lane: null,
      charges: [],
      total_base_cost: 0,
      mandatory_charges: 0,
    };
  }

  const sheetIds = rateSheets.map(sheet => sheet.id);

  let laneQuery = supabase
    .from('rate_sheet_lanes')
    .select('*')
    .in('rate_sheet_id', sheetIds)
    .eq('origin_country', params.origin_country)
    .eq('origin_port', params.origin_port)
    .eq('destination_country', params.destination_country)
    .eq('destination_port', params.destination_port)
    .eq('service_type', params.service_type)
    .lte('valid_from', today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('valid_from', { ascending: false })
    .limit(1);

  if (params.container_type) {
    laneQuery = laneQuery.eq('container_type', params.container_type);
  }

  const { data: lanes, error: lanesError } = await laneQuery;

  const selectedLane = lanes && lanes.length > 0 ? lanes[0] : null;

  const { data: charges, error: chargesError } = await supabase
    .from('rate_sheet_charges')
    .select('*')
    .in('rate_sheet_id', sheetIds);

  const relevantCharges = charges || [];

  const totalBaseCost = selectedLane
    ? selectedLane.base_rate +
      selectedLane.fuel_surcharge +
      selectedLane.security_fee +
      selectedLane.terminal_handling +
      selectedLane.documentation_fee
    : 0;

  const mandatoryCharges = relevantCharges
    .filter(charge => charge.is_mandatory)
    .reduce((sum, charge) => sum + charge.amount, 0);

  return {
    lane: selectedLane,
    charges: relevantCharges,
    total_base_cost: totalBaseCost,
    mandatory_charges: mandatoryCharges,
  };
}

export async function getActiveRateSheets(type?: 'import' | 'export') {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('rate_sheets')
    .select('*')
    .eq('is_active', true)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching rate sheets:', error);
    return [];
  }

  return data || [];
}

export async function getRateSheetLanes(rateSheetId: string) {
  const { data, error } = await supabase
    .from('rate_sheet_lanes')
    .select('*')
    .eq('rate_sheet_id', rateSheetId)
    .order('origin_country', { ascending: true });

  if (error) {
    console.error('Error fetching lanes:', error);
    return [];
  }

  return data || [];
}

export async function getRateSheetCharges(rateSheetId: string) {
  const { data, error } = await supabase
    .from('rate_sheet_charges')
    .select('*')
    .eq('rate_sheet_id', rateSheetId)
    .order('charge_name', { ascending: true });

  if (error) {
    console.error('Error fetching charges:', error);
    return [];
  }

  return data || [];
}

export function calculateChargeAmount(
  charge: RateCharge,
  shipmentDetails: {
    containers?: number;
    volume?: number;
    weight?: number;
    freight_cost?: number;
  }
): number {
  switch (charge.unit_type) {
    case 'per_shipment':
      return charge.amount;
    case 'per_container':
      return charge.amount * (shipmentDetails.containers || 0);
    case 'per_cbm':
      return charge.amount * (shipmentDetails.volume || 0);
    case 'per_kg':
      return charge.amount * (shipmentDetails.weight || 0);
    case 'percentage':
      return (charge.amount / 100) * (shipmentDetails.freight_cost || 0);
    default:
      return charge.amount;
  }
}

interface SlabRate {
  service_name: string;
  service_type: string;
  unit_type: string;
  rate: number;
  currency: string;
}

export async function fetchSlabBasedRates(
  rateSheetId: string,
  cbm: number,
  weight: number
): Promise<SlabRate[]> {
  const { data: slabs, error } = await supabase
    .from('slab_rates')
    .select('*')
    .eq('rate_sheet_id', rateSheetId)
    .eq('is_active', true)
    .order('service_name', { ascending: true });

  if (error || !slabs) {
    console.error('Error fetching slab rates:', error);
    return [];
  }

  const applicableRates: SlabRate[] = [];

  for (const slab of slabs) {
    let isApplicable = false;
    let applicableRate = 0;

    if (slab.volume_from !== null && slab.volume_to !== null) {
      if (cbm >= slab.volume_from && cbm <= slab.volume_to) {
        isApplicable = true;
        applicableRate = slab.rate;
      }
    } else if (slab.weight_from !== null && slab.weight_to !== null) {
      if (weight >= slab.weight_from && weight <= slab.weight_to) {
        isApplicable = true;
        applicableRate = slab.rate;
      }
    } else if (slab.unit_type === 'Fixed') {
      isApplicable = true;
      applicableRate = slab.rate;
    }

    if (isApplicable) {
      applicableRates.push({
        service_name: slab.service_name,
        service_type: slab.service_type,
        unit_type: slab.unit_type,
        rate: applicableRate,
        currency: slab.currency || 'USD',
      });
    }
  }

  return applicableRates;
}

export interface RevenueLineItem {
  service_name: string;
  service_type: string;
  unit_type: string;
  quantity: number;
  rate: number;
  currency: string;
  amount: number;
  auto_calculated: boolean;
}

export function generateRevenueLineItems(
  slabRates: SlabRate[],
  cbm: number,
  weight: number
): RevenueLineItem[] {
  const lineItems: RevenueLineItem[] = [];

  for (const slab of slabRates) {
    let quantity = 1;
    let amount = slab.rate;

    if (slab.unit_type === 'Per CBM') {
      quantity = cbm;
      amount = slab.rate * cbm;
    } else if (slab.unit_type === 'Per KG') {
      quantity = weight;
      amount = slab.rate * weight;
    } else if (slab.unit_type === 'Fixed') {
      quantity = 1;
      amount = slab.rate;
    }

    lineItems.push({
      service_name: slab.service_name,
      service_type: slab.service_type,
      unit_type: slab.unit_type,
      quantity: Number(quantity.toFixed(3)),
      rate: Number(slab.rate.toFixed(2)),
      currency: slab.currency,
      amount: Number(amount.toFixed(2)),
      auto_calculated: true,
    });
  }

  return lineItems;
}