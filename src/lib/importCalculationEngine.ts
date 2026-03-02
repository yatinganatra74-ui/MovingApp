import { supabase } from './supabase';

interface ShipmentCalculationInput {
  rateSheetId: string;
  volumeCbm: number;
  originPort: string;
  destinationPort: string;
  containerType: string;
  currency: string;
  cargoValue?: number;
  customsDuty?: number;
  isGroupage: boolean;
  groupageContainerId?: string;
  truckingDistance?: number;
  hasTrucking: boolean;
  storageDays?: number;
  shipmentLevelCosts?: Array<{ description: string; amount: number; currency: string }>;
}

interface CalculationResult {
  revenueAmount: number;
  revenueCurrency: string;
  revenueInr: number;
  exchangeRate: number;
  containerCostUsd: number;
  containerCostInr: number;
  truckingCostInr: number;
  truckingRevenueInr: number;
  storageCostInr: number;
  shipmentCostsInr: number;
  totalCostInr: number;
  profitInr: number;
  profitMarginPercent: number;
  calculations: {
    slabBreakdown: Array<{
      fromCbm: number;
      toCbm: number;
      ratePer: number;
      volumeInSlab: number;
      amount: number;
    }>;
    exchangeRateSource: string;
    containerAllocation: {
      allocatedVolume: number;
      totalContainerVolume: number;
      allocationPercent: number;
      containerCostUsd: number;
    } | null;
  };
}

export async function calculateImportShipment(
  input: ShipmentCalculationInput
): Promise<CalculationResult> {
  const result: CalculationResult = {
    revenueAmount: 0,
    revenueCurrency: input.currency,
    revenueInr: 0,
    exchangeRate: 1,
    containerCostUsd: 0,
    containerCostInr: 0,
    truckingCostInr: 0,
    truckingRevenueInr: 0,
    storageCostInr: 0,
    shipmentCostsInr: 0,
    totalCostInr: 0,
    profitInr: 0,
    profitMarginPercent: 0,
    calculations: {
      slabBreakdown: [],
      exchangeRateSource: 'default',
      containerAllocation: null,
    },
  };

  try {
    const exchangeRate = await lockExchangeRate(input.currency);
    result.exchangeRate = exchangeRate;
    result.calculations.exchangeRateSource = `Locked at ${exchangeRate} ${input.currency}/INR`;

    const revenueResult = await calculateSlabRevenue(
      input.rateSheetId,
      input.volumeCbm,
      input.originPort,
      input.destinationPort
    );
    result.revenueAmount = revenueResult.totalAmount;
    result.revenueCurrency = input.currency;
    result.calculations.slabBreakdown = revenueResult.slabBreakdown;

    result.revenueInr = result.revenueAmount * exchangeRate;

    if (input.isGroupage && input.groupageContainerId) {
      const containerCost = await allocateContainerCost(
        input.groupageContainerId,
        input.volumeCbm
      );
      result.containerCostUsd = containerCost.allocatedCostUsd;
      result.containerCostInr = containerCost.allocatedCostInr;
      result.calculations.containerAllocation = {
        allocatedVolume: input.volumeCbm,
        totalContainerVolume: containerCost.totalVolume,
        allocationPercent: containerCost.allocationPercent,
        containerCostUsd: containerCost.totalContainerCostUsd,
      };
    } else if (!input.isGroupage && input.containerType) {
      const fullContainerCost = await getFullContainerCost(
        input.containerType,
        input.originPort,
        input.destinationPort
      );
      result.containerCostUsd = fullContainerCost;
      result.containerCostInr = fullContainerCost * exchangeRate;
    }

    if (input.shipmentLevelCosts && input.shipmentLevelCosts.length > 0) {
      result.shipmentCostsInr = await convertShipmentCosts(
        input.shipmentLevelCosts,
        exchangeRate
      );
    }

    if (input.hasTrucking && input.truckingDistance) {
      const truckingCosts = await calculateTruckingCosts(
        input.truckingDistance,
        input.volumeCbm
      );
      result.truckingCostInr = truckingCosts.costInr;
      result.truckingRevenueInr = truckingCosts.revenueInr;
    }

    if (input.storageDays && input.storageDays > 0) {
      result.storageCostInr = await calculateStorageCosts(
        input.volumeCbm,
        input.storageDays
      );
    }

    result.totalCostInr =
      result.containerCostInr +
      result.shipmentCostsInr +
      result.truckingCostInr +
      result.storageCostInr;

    result.profitInr = result.revenueInr + result.truckingRevenueInr - result.totalCostInr;

    if (result.revenueInr + result.truckingRevenueInr > 0) {
      result.profitMarginPercent =
        (result.profitInr / (result.revenueInr + result.truckingRevenueInr)) * 100;
    }

    return result;
  } catch (error) {
    console.error('Error in calculation engine:', error);
    throw new Error(`Calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function lockExchangeRate(currency: string): Promise<number> {
  if (currency === 'INR') {
    return 1;
  }

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', currency)
      .eq('to_currency', 'INR')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data && data.rate) {
      return data.rate;
    }

    const defaultRates: { [key: string]: number } = {
      USD: 83.0,
      EUR: 90.0,
      GBP: 105.0,
      AED: 22.6,
      SAR: 22.1,
    };

    return defaultRates[currency] || 83.0;
  } catch (error) {
    console.error('Error locking exchange rate:', error);
    return 83.0;
  }
}

async function calculateSlabRevenue(
  rateSheetId: string,
  volumeCbm: number,
  originPort: string,
  destinationPort: string
): Promise<{
  totalAmount: number;
  slabBreakdown: Array<{
    fromCbm: number;
    toCbm: number;
    ratePer: number;
    volumeInSlab: number;
    amount: number;
  }>;
}> {
  try {
    const { data: slabs, error } = await supabase
      .from('rate_sheet_slabs')
      .select('*')
      .eq('rate_sheet_id', rateSheetId)
      .eq('origin_port', originPort)
      .eq('destination_port', destinationPort)
      .order('min_volume', { ascending: true });

    if (error) throw error;

    if (!slabs || slabs.length === 0) {
      throw new Error('No rate slabs found for this route');
    }

    const slabBreakdown: Array<{
      fromCbm: number;
      toCbm: number;
      ratePer: number;
      volumeInSlab: number;
      amount: number;
    }> = [];

    let totalAmount = 0;
    let remainingVolume = volumeCbm;

    for (const slab of slabs) {
      if (remainingVolume <= 0) break;

      const slabMin = slab.min_volume;
      const slabMax = slab.max_volume || Infinity;
      const ratePer = slab.rate_per_unit;

      if (volumeCbm < slabMin) {
        continue;
      }

      const volumeInThisSlab = Math.min(
        remainingVolume,
        slabMax - Math.max(slabMin, volumeCbm - remainingVolume)
      );

      if (volumeInThisSlab > 0) {
        const amount = volumeInThisSlab * ratePer;
        totalAmount += amount;

        slabBreakdown.push({
          fromCbm: slabMin,
          toCbm: slabMax,
          ratePer: ratePer,
          volumeInSlab: volumeInThisSlab,
          amount: amount,
        });

        remainingVolume -= volumeInThisSlab;
      }
    }

    return {
      totalAmount,
      slabBreakdown,
    };
  } catch (error) {
    console.error('Error calculating slab revenue:', error);
    throw error;
  }
}

async function allocateContainerCost(
  groupageContainerId: string,
  volumeCbm: number
): Promise<{
  allocatedCostUsd: number;
  allocatedCostInr: number;
  totalVolume: number;
  allocationPercent: number;
  totalContainerCostUsd: number;
}> {
  try {
    const { data: container, error } = await supabase
      .from('groupage_containers')
      .select('container_cost_usd, total_allocated_volume, max_volume')
      .eq('id', groupageContainerId)
      .maybeSingle();

    if (error) throw error;

    if (!container) {
      throw new Error('Groupage container not found');
    }

    const totalVolume = container.total_allocated_volume || 0;
    const maxVolume = container.max_volume || 1;
    const containerCostUsd = container.container_cost_usd || 0;

    const allocationPercent = (volumeCbm / maxVolume) * 100;
    const allocatedCostUsd = (volumeCbm / maxVolume) * containerCostUsd;

    const usdToInrRate = await lockExchangeRate('USD');
    const allocatedCostInr = allocatedCostUsd * usdToInrRate;

    return {
      allocatedCostUsd,
      allocatedCostInr,
      totalVolume: maxVolume,
      allocationPercent,
      totalContainerCostUsd: containerCostUsd,
    };
  } catch (error) {
    console.error('Error allocating container cost:', error);
    throw error;
  }
}

async function getFullContainerCost(
  containerType: string,
  originPort: string,
  destinationPort: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('container_costs')
      .select('cost_usd')
      .eq('container_type', containerType)
      .eq('origin_port', originPort)
      .eq('destination_port', destinationPort)
      .maybeSingle();

    if (error) throw error;

    return data?.cost_usd || 0;
  } catch (error) {
    console.error('Error getting full container cost:', error);
    return 0;
  }
}

async function convertShipmentCosts(
  costs: Array<{ description: string; amount: number; currency: string }>,
  baseExchangeRate: number
): Promise<number> {
  let totalInr = 0;

  for (const cost of costs) {
    if (cost.currency === 'INR') {
      totalInr += cost.amount;
    } else {
      const rate = await lockExchangeRate(cost.currency);
      totalInr += cost.amount * rate;
    }
  }

  return totalInr;
}

async function calculateTruckingCosts(
  distanceKm: number,
  volumeCbm: number
): Promise<{ costInr: number; revenueInr: number }> {
  try {
    const { data: config, error } = await supabase
      .from('trucking_rate_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const costPerKm = config?.cost_per_km || 15;
    const revenuePerKm = config?.revenue_per_km || 25;

    const costInr = distanceKm * costPerKm;
    const revenueInr = distanceKm * revenuePerKm;

    return { costInr, revenueInr };
  } catch (error) {
    console.error('Error calculating trucking costs:', error);
    return { costInr: 0, revenueInr: 0 };
  }
}

async function calculateStorageCosts(
  volumeCbm: number,
  storageDays: number
): Promise<number> {
  try {
    const { data: config, error } = await supabase
      .from('storage_billing_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const freeDays = config?.free_days || 7;
    const ratePerCbmPerDay = config?.rate_per_cbm_per_day || 10;

    if (storageDays <= freeDays) {
      return 0;
    }

    const billableDays = storageDays - freeDays;
    const storageCost = volumeCbm * billableDays * ratePerCbmPerDay;

    return storageCost;
  } catch (error) {
    console.error('Error calculating storage costs:', error);
    return 0;
  }
}

export async function saveCalculatedShipment(
  shipmentData: any,
  calculationResult: CalculationResult
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('import_shipments')
      .insert({
        ...shipmentData,
        revenue_amount: calculationResult.revenueAmount,
        revenue_currency: calculationResult.revenueCurrency,
        revenue_inr: calculationResult.revenueInr,
        exchange_rate: calculationResult.exchangeRate,
        container_cost_usd: calculationResult.containerCostUsd,
        container_cost_inr: calculationResult.containerCostInr,
        trucking_cost_inr: calculationResult.truckingCostInr,
        trucking_revenue_inr: calculationResult.truckingRevenueInr,
        storage_cost_inr: calculationResult.storageCostInr,
        shipment_costs_inr: calculationResult.shipmentCostsInr,
        total_cost_inr: calculationResult.totalCostInr,
        profit_inr: calculationResult.profitInr,
        profit_margin_percent: calculationResult.profitMarginPercent,
        calculation_breakdown: calculationResult.calculations,
        status: 'draft',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    if (shipmentData.groupage_container_id) {
      await updateGroupageContainerAllocation(
        shipmentData.groupage_container_id,
        shipmentData.volume_cbm
      );
    }

    return data.id;
  } catch (error) {
    console.error('Error saving calculated shipment:', error);
    throw error;
  }
}

async function updateGroupageContainerAllocation(
  containerId: string,
  volumeCbm: number
): Promise<void> {
  try {
    const { data: container, error: fetchError } = await supabase
      .from('groupage_containers')
      .select('total_allocated_volume, available_volume')
      .eq('id', containerId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const currentAllocated = container?.total_allocated_volume || 0;
    const currentAvailable = container?.available_volume || 0;

    const { error: updateError } = await supabase
      .from('groupage_containers')
      .update({
        total_allocated_volume: currentAllocated + volumeCbm,
        available_volume: currentAvailable - volumeCbm,
      })
      .eq('id', containerId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error updating groupage container allocation:', error);
    throw error;
  }
}
