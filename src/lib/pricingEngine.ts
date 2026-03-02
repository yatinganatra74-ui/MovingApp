import { supabase } from './supabase';

export interface PricingInput {
  direction: 'domestic' | 'inbound' | 'outbound' | 'third_country';
  transportMode: 'air' | 'sea' | 'road';
  fromZoneCode: string;
  toZoneCode: string;
  volume?: number;
  weightKg?: number;
  isGroupage?: boolean;
  containerType?: string;
  marginProfileId?: string;
  additionalServices?: string[];
  currencyCode?: string;
}

export interface PricingBreakdown {
  baseTransportCost: number;
  fuelSurcharge?: number;
  serviceCharges: Array<{
    serviceName: string;
    amount: number;
  }>;
  subtotal: number;
  fixedMargin: number;
  percentageMargin: number;
  totalMargin: number;
  finalPrice: number;
  currency: {
    code: string;
    symbol: string;
  };
  calculationMethod: string;
  slabDetails?: {
    slabName: string;
    minValue: number;
    maxValue: number;
    rate: number;
  };
}

export class PricingEngine {

  async calculatePrice(input: PricingInput): Promise<PricingBreakdown> {
    const currencyCode = input.currencyCode || 'USD';

    const { data: currency } = await supabase
      .from('currencies')
      .select('*')
      .eq('code', currencyCode)
      .single();

    if (!currency) {
      throw new Error('Currency not found');
    }

    let breakdown: PricingBreakdown = {
      baseTransportCost: 0,
      serviceCharges: [],
      subtotal: 0,
      fixedMargin: 0,
      percentageMargin: 0,
      totalMargin: 0,
      finalPrice: 0,
      currency: {
        code: currency.code,
        symbol: currency.symbol
      },
      calculationMethod: ''
    };

    if (input.transportMode === 'air' && input.weightKg) {
      breakdown = await this.calculateAirFreight(input, currency.id);
    } else if (input.isGroupage && input.volume) {
      breakdown = await this.calculateGroupage(input, currency.id);
    } else if (input.volume) {
      breakdown = await this.calculateSlabBased(input, currency.id);
    }

    const serviceCharges = await this.calculateServiceCharges(
      input.additionalServices || [],
      currency.id,
      breakdown.subtotal
    );

    breakdown.serviceCharges = serviceCharges;
    const servicesTotal = serviceCharges.reduce((sum, s) => sum + s.amount, 0);
    breakdown.subtotal = breakdown.baseTransportCost + (breakdown.fuelSurcharge || 0) + servicesTotal;

    const margins = await this.applyMargins(
      input.marginProfileId,
      breakdown.subtotal,
      currency.id
    );

    breakdown.fixedMargin = margins.fixed;
    breakdown.percentageMargin = margins.percentage;
    breakdown.totalMargin = margins.total;
    breakdown.finalPrice = breakdown.subtotal + breakdown.totalMargin;

    breakdown.currency = {
      code: currency.code,
      symbol: currency.symbol
    };

    return breakdown;
  }

  private async calculateAirFreight(
    input: PricingInput,
    currencyId: string
  ): Promise<PricingBreakdown> {
    const { data: zones } = await supabase
      .from('pricing_zones')
      .select('id, zone_code')
      .in('zone_code', [input.fromZoneCode, input.toZoneCode]);

    const fromZone = zones?.find(z => z.zone_code === input.fromZoneCode);
    const toZone = zones?.find(z => z.zone_code === input.toZoneCode);

    if (!fromZone || !toZone) {
      throw new Error('Zones not found');
    }

    const { data: direction } = await supabase
      .from('move_directions')
      .select('id')
      .eq('direction_code', input.direction)
      .single();

    const { data: rate } = await supabase
      .from('air_freight_rates')
      .select('*')
      .eq('from_zone_id', fromZone.id)
      .eq('to_zone_id', toZone.id)
      .eq('direction_id', direction?.id)
      .eq('currency_id', currencyId)
      .eq('active', true)
      .maybeSingle();

    if (!rate) {
      throw new Error('No air freight rate found for this route');
    }

    const weightCharge = (input.weightKg || 0) * rate.rate_per_kg;
    const baseCharge = Math.max(weightCharge, rate.minimum_charge);
    const fuelSurcharge = baseCharge * (rate.fuel_surcharge_percent / 100);

    return {
      baseTransportCost: baseCharge,
      fuelSurcharge: fuelSurcharge,
      serviceCharges: [],
      subtotal: baseCharge + fuelSurcharge,
      fixedMargin: 0,
      percentageMargin: 0,
      totalMargin: 0,
      finalPrice: 0,
      currency: { code: '', symbol: '' },
      calculationMethod: `Air Freight: ${input.weightKg}kg @ ${rate.rate_per_kg}/kg + ${rate.fuel_surcharge_percent}% fuel surcharge`
    };
  }

  private async calculateGroupage(
    input: PricingInput,
    currencyId: string
  ): Promise<PricingBreakdown> {
    const { data: zones } = await supabase
      .from('pricing_zones')
      .select('id, zone_code')
      .in('zone_code', [input.fromZoneCode, input.toZoneCode]);

    const fromZone = zones?.find(z => z.zone_code === input.fromZoneCode);
    const toZone = zones?.find(z => z.zone_code === input.toZoneCode);

    if (!fromZone || !toZone) {
      throw new Error('Zones not found');
    }

    const { data: rate } = await supabase
      .from('groupage_rates')
      .select('*')
      .eq('from_zone_id', fromZone.id)
      .eq('to_zone_id', toZone.id)
      .eq('currency_id', currencyId)
      .eq('active', true)
      .maybeSingle();

    if (!rate) {
      throw new Error('No groupage rate found for this route');
    }

    const volumeCharge = (input.volume || 0) * rate.rate_per_cubic_foot;
    const baseCharge = Math.max(volumeCharge, rate.minimum_charge);

    return {
      baseTransportCost: baseCharge,
      serviceCharges: [],
      subtotal: baseCharge,
      fixedMargin: 0,
      percentageMargin: 0,
      totalMargin: 0,
      finalPrice: 0,
      currency: { code: '', symbol: '' },
      calculationMethod: `Groupage: ${input.volume} cu ft @ ${rate.rate_per_cubic_foot}/cu ft (${input.containerType || 'standard'})`
    };
  }

  private async calculateSlabBased(
    input: PricingInput,
    currencyId: string
  ): Promise<PricingBreakdown> {
    const { data: zones } = await supabase
      .from('pricing_zones')
      .select('id, zone_code')
      .in('zone_code', [input.fromZoneCode, input.toZoneCode]);

    const fromZone = zones?.find(z => z.zone_code === input.fromZoneCode);
    const toZone = zones?.find(z => z.zone_code === input.toZoneCode);

    if (!fromZone || !toZone) {
      throw new Error('Zones not found');
    }

    const { data: direction } = await supabase
      .from('move_directions')
      .select('id')
      .eq('direction_code', input.direction)
      .single();

    const { data: mode } = await supabase
      .from('transport_modes')
      .select('id')
      .eq('mode_code', input.transportMode)
      .single();

    const { data: slabs } = await supabase
      .from('pricing_slabs')
      .select('*')
      .eq('from_zone_id', fromZone.id)
      .eq('to_zone_id', toZone.id)
      .eq('direction_id', direction?.id)
      .eq('transport_mode_id', mode?.id)
      .eq('currency_id', currencyId)
      .eq('active', true)
      .order('min_value', { ascending: true });

    if (!slabs || slabs.length === 0) {
      throw new Error('No pricing slabs found for this route');
    }

    const volume = input.volume || 0;
    const applicableSlab = slabs.find(
      slab => volume >= slab.min_value && volume <= slab.max_value
    );

    if (!applicableSlab) {
      const lastSlab = slabs[slabs.length - 1];
      return {
        baseTransportCost: lastSlab.base_rate,
        serviceCharges: [],
        subtotal: lastSlab.base_rate,
        fixedMargin: 0,
        percentageMargin: 0,
        totalMargin: 0,
        finalPrice: 0,
        currency: { code: '', symbol: '' },
        calculationMethod: `Slab: ${lastSlab.slab_name} (${volume} ${applicableSlab?.measurement_unit || 'cu ft'})`,
        slabDetails: {
          slabName: lastSlab.slab_name,
          minValue: lastSlab.min_value,
          maxValue: lastSlab.max_value,
          rate: lastSlab.base_rate
        }
      };
    }

    return {
      baseTransportCost: applicableSlab.base_rate,
      serviceCharges: [],
      subtotal: applicableSlab.base_rate,
      fixedMargin: 0,
      percentageMargin: 0,
      totalMargin: 0,
      finalPrice: 0,
      currency: { code: '', symbol: '' },
      calculationMethod: `Slab: ${applicableSlab.slab_name} (${volume} ${applicableSlab.measurement_unit})`,
      slabDetails: {
        slabName: applicableSlab.slab_name,
        minValue: applicableSlab.min_value,
        maxValue: applicableSlab.max_value,
        rate: applicableSlab.base_rate
      }
    };
  }

  private async calculateServiceCharges(
    serviceCodes: string[],
    currencyId: string,
    baseAmount: number
  ): Promise<Array<{ serviceName: string; amount: number }>> {
    if (serviceCodes.length === 0) return [];

    const { data: services } = await supabase
      .from('service_charges')
      .select('*')
      .in('service_code', serviceCodes)
      .eq('currency_id', currencyId)
      .eq('active', true);

    if (!services) return [];

    return services.map(service => {
      let amount = service.amount;

      if (service.charge_type === 'percentage') {
        amount = baseAmount * (service.amount / 100);
      }

      return {
        serviceName: service.service_name,
        amount: amount
      };
    });
  }

  private async applyMargins(
    marginProfileId: string | undefined,
    baseAmount: number,
    currencyId: string
  ): Promise<{ fixed: number; percentage: number; total: number }> {
    if (!marginProfileId) {
      const { data: defaultProfile } = await supabase
        .from('margin_profiles')
        .select('*')
        .eq('currency_id', currencyId)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (!defaultProfile) {
        return { fixed: 0, percentage: 0, total: 0 };
      }

      const percentageAmount = baseAmount * (defaultProfile.percentage_margin / 100);
      return {
        fixed: defaultProfile.fixed_amount,
        percentage: percentageAmount,
        total: defaultProfile.fixed_amount + percentageAmount
      };
    }

    const { data: profile } = await supabase
      .from('margin_profiles')
      .select('*')
      .eq('id', marginProfileId)
      .single();

    if (!profile) {
      return { fixed: 0, percentage: 0, total: 0 };
    }

    const percentageAmount = baseAmount * (profile.percentage_margin / 100);
    return {
      fixed: profile.fixed_amount,
      percentage: percentageAmount,
      total: profile.fixed_amount + percentageAmount
    };
  }

  async savePricingCalculation(
    quoteId: string,
    input: PricingInput,
    breakdown: PricingBreakdown
  ): Promise<void> {
    const { data: currency } = await supabase
      .from('currencies')
      .select('id')
      .eq('code', breakdown.currency.code)
      .single();

    await supabase.from('pricing_calculations').insert([{
      quote_id: quoteId,
      direction_code: input.direction,
      transport_mode: input.transportMode,
      volume: input.volume || 0,
      weight_kg: input.weightKg || 0,
      from_zone: input.fromZoneCode,
      to_zone: input.toZoneCode,
      base_cost: breakdown.baseTransportCost,
      margin_applied: breakdown.totalMargin,
      final_price: breakdown.finalPrice,
      currency_id: currency?.id,
      calculation_details: {
        breakdown,
        input
      }
    }]);
  }
}

export const pricingEngine = new PricingEngine();
