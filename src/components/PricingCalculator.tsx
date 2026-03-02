import { useState, useEffect } from 'react';
import { pricingEngine, PricingInput, PricingBreakdown } from '../lib/pricingEngine';
import { supabase } from '../lib/supabase';
import { Calculator, TrendingUp, DollarSign, Package, Plane, Ship, Truck } from 'lucide-react';

interface PricingCalculatorProps {
  onPriceCalculated?: (breakdown: PricingBreakdown) => void;
  initialValues?: Partial<PricingInput>;
}

export default function PricingCalculator({ onPriceCalculated, initialValues }: PricingCalculatorProps) {
  const [zones, setZones] = useState<any[]>([]);
  const [marginProfiles, setMarginProfiles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);

  const [formData, setFormData] = useState<PricingInput>({
    direction: initialValues?.direction || 'domestic',
    transportMode: initialValues?.transportMode || 'road',
    fromZoneCode: initialValues?.fromZoneCode || '',
    toZoneCode: initialValues?.toZoneCode || '',
    volume: initialValues?.volume || 0,
    weightKg: initialValues?.weightKg || 0,
    isGroupage: initialValues?.isGroupage || false,
    containerType: initialValues?.containerType || '',
    marginProfileId: initialValues?.marginProfileId || '',
    additionalServices: initialValues?.additionalServices || [],
    currencyCode: initialValues?.currencyCode || 'USD'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [zonesRes, marginsRes, servicesRes, currenciesRes] = await Promise.all([
        supabase.from('pricing_zones').select('*').eq('active', true),
        supabase.from('margin_profiles').select('*').eq('active', true),
        supabase.from('service_charges').select('*').eq('active', true),
        supabase.from('currencies').select('*').eq('active', true)
      ]);

      setZones(zonesRes.data || []);
      setMarginProfiles(marginsRes.data || []);
      setServices(servicesRes.data || []);
      setCurrencies(currenciesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const result = await pricingEngine.calculatePrice(formData);
      setBreakdown(result);
      if (onPriceCalculated) {
        onPriceCalculated(result);
      }
    } catch (error) {
      console.error('Error calculating price:', error);
      alert(error instanceof Error ? error.message : 'Failed to calculate price');
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceCode: string) => {
    const current = formData.additionalServices || [];
    const updated = current.includes(serviceCode)
      ? current.filter(s => s !== serviceCode)
      : [...current, serviceCode];
    setFormData({ ...formData, additionalServices: updated });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'air': return <Plane className="w-5 h-5" />;
      case 'sea': return <Ship className="w-5 h-5" />;
      case 'road': return <Truck className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pricing Calculator</h2>
            <p className="text-sm text-slate-600">Calculate quotes with advanced pricing engine</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Move Direction</label>
            <select
              value={formData.direction}
              onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="domestic">Domestic</option>
              <option value="inbound">Inbound International</option>
              <option value="outbound">Outbound International</option>
              <option value="third_country">Third Country</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Transport Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {['air', 'sea', 'road'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFormData({ ...formData, transportMode: mode as any })}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    formData.transportMode === mode
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {getModeIcon(mode)}
                  <span className="text-sm font-medium capitalize">{mode}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
            <select
              value={formData.currencyCode}
              onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {currencies.map(curr => (
                <option key={curr.id} value={curr.code}>
                  {curr.symbol} {curr.code} - {curr.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">From Zone</label>
            <select
              value={formData.fromZoneCode}
              onChange={(e) => setFormData({ ...formData, fromZoneCode: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select zone</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.zone_code}>
                  {zone.zone_name} ({zone.zone_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">To Zone</label>
            <select
              value={formData.toZoneCode}
              onChange={(e) => setFormData({ ...formData, toZoneCode: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select zone</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.zone_code}>
                  {zone.zone_name} ({zone.zone_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Margin Profile</label>
            <select
              value={formData.marginProfileId}
              onChange={(e) => setFormData({ ...formData, marginProfileId: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Default</option>
              {marginProfiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.profile_name} (+{profile.fixed_amount} + {profile.percentage_margin}%)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Volume (cu ft)</label>
            <input
              type="number"
              step="0.01"
              value={formData.volume}
              onChange={(e) => setFormData({ ...formData, volume: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {formData.transportMode === 'air' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="isGroupage"
              checked={formData.isGroupage}
              onChange={(e) => setFormData({ ...formData, isGroupage: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isGroupage" className="text-sm font-medium text-slate-700">
              Groupage Shipment
            </label>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="font-semibold text-slate-900 mb-3">Additional Services</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {services.map(service => (
              <button
                key={service.id}
                type="button"
                onClick={() => toggleService(service.service_code)}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  formData.additionalServices?.includes(service.service_code)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {service.service_name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading || !formData.fromZoneCode || !formData.toZoneCode}
          className="mt-6 w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Calculator className="w-5 h-5" />
          {loading ? 'Calculating...' : 'Calculate Price'}
        </button>
      </div>

      {breakdown && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Price Breakdown</h3>
              <p className="text-sm text-slate-600">{breakdown.calculationMethod}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-700">Base Transport Cost</span>
              <span className="font-semibold text-slate-900">
                {breakdown.currency.symbol}{breakdown.baseTransportCost.toFixed(2)}
              </span>
            </div>

            {breakdown.fuelSurcharge && breakdown.fuelSurcharge > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-700">Fuel Surcharge</span>
                <span className="font-semibold text-slate-900">
                  {breakdown.currency.symbol}{breakdown.fuelSurcharge.toFixed(2)}
                </span>
              </div>
            )}

            {breakdown.serviceCharges.map((service, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-700">{service.serviceName}</span>
                <span className="font-semibold text-slate-900">
                  {breakdown.currency.symbol}{service.amount.toFixed(2)}
                </span>
              </div>
            ))}

            <div className="flex justify-between items-center py-2 border-b border-slate-200 bg-slate-50 px-3 rounded">
              <span className="font-medium text-slate-900">Subtotal</span>
              <span className="font-bold text-slate-900">
                {breakdown.currency.symbol}{breakdown.subtotal.toFixed(2)}
              </span>
            </div>

            {breakdown.fixedMargin > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-700">Fixed Margin</span>
                <span className="font-semibold text-green-700">
                  +{breakdown.currency.symbol}{breakdown.fixedMargin.toFixed(2)}
                </span>
              </div>
            )}

            {breakdown.percentageMargin > 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="text-slate-700">Percentage Margin</span>
                <span className="font-semibold text-green-700">
                  +{breakdown.currency.symbol}{breakdown.percentageMargin.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-3 bg-blue-50 px-4 rounded-lg mt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-blue-900 text-lg">Final Price</span>
              </div>
              <span className="font-bold text-blue-900 text-2xl">
                {breakdown.currency.symbol}{breakdown.finalPrice.toFixed(2)} {breakdown.currency.code}
              </span>
            </div>

            {breakdown.slabDetails && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Slab Details</h4>
                <div className="text-sm text-slate-700 space-y-1">
                  <p>Slab: {breakdown.slabDetails.slabName}</p>
                  <p>Range: {breakdown.slabDetails.minValue} - {breakdown.slabDetails.maxValue}</p>
                  <p>Rate: {breakdown.currency.symbol}{breakdown.slabDetails.rate.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
