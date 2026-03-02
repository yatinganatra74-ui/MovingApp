import { useState, useEffect } from 'react';
import { Calculator, DollarSign, Truck, Package, Users, Building, TrendingUp, Plane, Ship } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FreightResult {
  freight_type?: string;
  actual_weight_kg?: number;
  volumetric_weight_kg?: number;
  chargeable_weight_kg?: number;
  rate_per_kg?: number;
  freight_cost: number;
  quantity?: number;
  unit?: string;
  rate?: number;
}

export default function CostingCalculator() {
  const [totalCBM, setTotalCBM] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(100);
  const [distanceKm, setDistanceKm] = useState<number>(50);
  const [crewMembers, setCrewMembers] = useState<number>(2);
  const [estimatedHours, setEstimatedHours] = useState<number>(8);
  const [freightType, setFreightType] = useState<string>('ROAD');
  const [profitMargin, setProfitMargin] = useState<number>(15);
  const [actualWeightKg, setActualWeightKg] = useState<number>(0);

  const [costs, setCosts] = useState({
    materialCost: 0,
    laborCost: 0,
    transportCost: 0,
    freightCost: 0,
    insuranceCost: 0,
    overheadCost: 0,
    subtotal: 0,
    profitAmount: 0,
    totalCost: 0
  });

  const [freightDetails, setFreightDetails] = useState<FreightResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    if (totalCBM > 0) {
      setActualWeightKg(totalCBM * 150);
    }
  }, [totalCBM]);

  const calculateCosts = async () => {
    setCalculating(true);
    try {
      const materialEstimate = totalCBM * 8 * 2.5;

      const { data: laborData, error: laborError } = await supabase.rpc('calculate_labor_cost', {
        p_crew_members: crewMembers,
        p_hours: estimatedHours,
        p_overtime_hours: 0
      });

      if (laborError) throw laborError;

      let transportCost = 0;
      let freightCost = 0;
      let freightInfo: FreightResult | null = null;

      if (freightType === 'ROAD') {
        const { data: transportData, error: transportError } = await supabase.rpc('calculate_transport_cost', {
          p_distance_km: distanceKm
        });
        if (transportError) throw transportError;
        transportCost = transportData;
        freightInfo = { freight_cost: transportData };
      } else if (freightType === 'AIR') {
        const { data: airData, error: airError } = await supabase.rpc('calculate_air_freight', {
          p_cbm: totalCBM,
          p_actual_weight_kg: actualWeightKg
        });
        if (airError) throw airError;
        freightCost = airData.freight_cost;
        freightInfo = airData;
      } else {
        const { data: seaData, error: seaError } = await supabase.rpc('calculate_sea_freight', {
          p_cbm: totalCBM,
          p_freight_type: freightType
        });
        if (seaError) throw seaError;
        freightCost = seaData.freight_cost;
        freightInfo = seaData;
      }

      const subtotal = materialEstimate + laborData + transportCost + freightCost;
      const insurance = subtotal * 0.02;
      const overhead = subtotal * 0.10;
      const finalSubtotal = subtotal + insurance + overhead;
      const profit = finalSubtotal * (profitMargin / 100);
      const total = finalSubtotal + profit;

      setCosts({
        materialCost: materialEstimate,
        laborCost: laborData,
        transportCost,
        freightCost,
        insuranceCost: insurance,
        overheadCost: overhead,
        subtotal: finalSubtotal,
        profitAmount: profit,
        totalCost: total
      });

      setFreightDetails(freightInfo);
    } catch (error) {
      console.error('Error calculating costs:', error);
      alert('Failed to calculate costs');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (totalCBM > 0) {
      calculateCosts();
    }
  }, [totalCBM, distanceKm, crewMembers, estimatedHours, freightType, profitMargin, actualWeightKg]);

  const getFreightIcon = () => {
    switch (freightType) {
      case 'AIR': return <Plane className="w-5 h-5" />;
      case 'SEA_FCL_20':
      case 'SEA_FCL_40':
      case 'SEA_LCL': return <Ship className="w-5 h-5" />;
      default: return <Truck className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Comprehensive Costing Calculator</h1>
          <p className="text-slate-600 mt-1">Calculate complete job costs with all components</p>
        </div>
        <Calculator className="w-8 h-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Job Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Volume (CBM)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={totalCBM}
                  onChange={(e) => setTotalCBM(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Items
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalItems}
                  onChange={(e) => setTotalItems(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Distance (km)
                </label>
                <input
                  type="number"
                  min="0"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Crew Members
                </label>
                <input
                  type="number"
                  min="1"
                  value={crewMembers}
                  onChange={(e) => setCrewMembers(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(parseFloat(e.target.value) || 1)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Profit Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              {getFreightIcon()}
              Freight Options
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Freight Type
                </label>
                <select
                  value={freightType}
                  onChange={(e) => setFreightType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ROAD">Road Transport</option>
                  <option value="AIR">Air Freight</option>
                  <option value="SEA_LCL">Sea Freight (LCL)</option>
                  <option value="SEA_FCL_20">Sea Freight (20ft Container)</option>
                  <option value="SEA_FCL_40">Sea Freight (40ft Container)</option>
                </select>
              </div>

              {freightType === 'AIR' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Actual Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actualWeightKg}
                    onChange={(e) => setActualWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Estimated: {(totalCBM * 150).toFixed(0)} kg
                  </p>
                </div>
              )}
            </div>

            {freightDetails && freightType === 'AIR' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Air Freight Calculation</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-700">Actual Weight:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {freightDetails.actual_weight_kg?.toFixed(2)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Volumetric Weight:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {freightDetails.volumetric_weight_kg?.toFixed(2)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Chargeable Weight:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {freightDetails.chargeable_weight_kg?.toFixed(2)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Rate per kg:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      ${freightDetails.rate_per_kg?.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Formula: Volumetric Weight = (L × W × H in cm) ÷ 6000
                </p>
              </div>
            )}

            {freightDetails && freightType.startsWith('SEA') && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Sea Freight Calculation</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-green-700">Type:</span>
                    <span className="ml-2 font-semibold text-green-900">
                      {freightDetails.freight_type}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700">Quantity:</span>
                    <span className="ml-2 font-semibold text-green-900">
                      {freightDetails.quantity} {freightDetails.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700">Rate:</span>
                    <span className="ml-2 font-semibold text-green-900">
                      ${freightDetails.rate?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Total Cost
            </h3>
            <div className="text-4xl font-bold mb-2">
              ${costs.totalCost.toFixed(2)}
            </div>
            <p className="text-blue-100 text-sm">
              Including {profitMargin}% profit margin
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cost Breakdown</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-700">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">Material Cost</span>
                </div>
                <span className="font-semibold text-slate-900">
                  ${costs.materialCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Labor Cost</span>
                </div>
                <span className="font-semibold text-slate-900">
                  ${costs.laborCost.toFixed(2)}
                </span>
              </div>

              {costs.transportCost > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Truck className="w-4 h-4" />
                    <span className="text-sm">Transport Cost</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    ${costs.transportCost.toFixed(2)}
                  </span>
                </div>
              )}

              {costs.freightCost > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    {getFreightIcon()}
                    <span className="text-sm">Freight Cost</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    ${costs.freightCost.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-sm text-slate-700">Insurance (2%)</span>
                <span className="font-semibold text-slate-900">
                  ${costs.insuranceCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-700">
                  <Building className="w-4 h-4" />
                  <span className="text-sm">Overhead (10%)</span>
                </div>
                <span className="font-semibold text-slate-900">
                  ${costs.overheadCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 bg-slate-50 rounded-lg px-3">
                <span className="text-sm font-medium text-slate-900">Subtotal</span>
                <span className="font-bold text-slate-900">
                  ${costs.subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Profit ({profitMargin}%)</span>
                </div>
                <span className="font-semibold text-green-700">
                  ${costs.profitAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 bg-blue-50 rounded-lg px-3">
                <span className="font-bold text-blue-900">Final Total</span>
                <span className="text-xl font-bold text-blue-900">
                  ${costs.totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-2 text-sm">Cost Formulas</h4>
            <div className="space-y-1 text-xs text-slate-600">
              <p>Material = CBM × Items Factor × Unit Cost</p>
              <p>Labor = Crew × Hours × Rate</p>
              <p>Transport = Distance × Rate per KM</p>
              <p>Air = Chargeable Weight × Rate</p>
              <p>Sea = CBM × Rate or Container Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
