import React, { useState, useEffect } from 'react';
import { MapPin, Calculator, TrendingUp, DollarSign, Clock, Navigation, Settings, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface VehicleCostConfig {
  vehicle_type: string;
  base_cost_per_km: number;
  fuel_cost_per_km: number;
  maintenance_cost_per_km: number;
  total_cost_per_km: number;
  driver_allowance_per_day: number;
  currency: string;
}

interface TollRoute {
  route_name: string;
  total_toll_cost: number;
  toll_points: any[];
  last_verified: string;
}

interface CostBreakdown {
  distance_km: number;
  vehicle_type: string;
  base_cost_per_km: number;
  fuel_cost_per_km: number;
  maintenance_cost_per_km: number;
  base_distance_cost: number;
  fuel_cost: number;
  maintenance_cost: number;
  toll_cost: number;
  driver_allowance: number;
  driver_days: number;
  total_cost: number;
}

interface CalculationResult {
  base_distance_cost: number;
  fuel_cost: number;
  maintenance_cost: number;
  toll_cost: number;
  driver_allowance: number;
  total_cost: number;
  cost_breakdown: CostBreakdown;
}

export default function DistanceCalculator() {
  const { user } = useAuth();
  const [fromLocation, setFromLocation] = useState('Nhava Sheva, Maharashtra');
  const [toLocation, setToLocation] = useState('');
  const [vehicleType, setVehicleType] = useState('17ft');
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [calculating, setCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [vehicleConfigs, setVehicleConfigs] = useState<VehicleCostConfig[]>([]);
  const [tollRoute, setTollRoute] = useState<TollRoute | null>(null);
  const [manualDistance, setManualDistance] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [isBillableToAgent, setIsBillableToAgent] = useState(true);
  const [revenueAmount, setRevenueAmount] = useState<number>(0);
  const [savingCalculation, setSavingCalculation] = useState(false);

  const vehicleTypes = ['Tata 407', '10ft', '14ft', '17ft', '19ft', '20ft', '22ft', '24ft', '32ft Container'];

  useEffect(() => {
    loadVehicleConfigs();
  }, []);

  useEffect(() => {
    if (distance > 0 && vehicleType) {
      calculateCost();
    }
  }, [distance, duration, vehicleType]);

  useEffect(() => {
    if (fromLocation && toLocation) {
      loadTollRoute();
    }
  }, [fromLocation, toLocation, vehicleType]);

  const loadVehicleConfigs = async () => {
    const { data } = await supabase
      .from('vehicle_cost_config')
      .select('*')
      .eq('is_active', true)
      .order('vehicle_type');

    if (data) {
      const configs = data.map(config => ({
        vehicle_type: config.vehicle_type,
        base_cost_per_km: config.base_cost_per_km,
        fuel_cost_per_km: config.fuel_cost_per_km,
        maintenance_cost_per_km: config.maintenance_cost_per_km,
        total_cost_per_km: config.base_cost_per_km + config.fuel_cost_per_km + config.maintenance_cost_per_km,
        driver_allowance_per_day: config.driver_allowance_per_day,
        currency: config.currency,
      }));
      setVehicleConfigs(configs);
    }
  };

  const loadTollRoute = async () => {
    const { data } = await supabase.rpc('get_toll_cost_for_route', {
      p_from_location: fromLocation,
      p_to_location: toLocation,
      p_vehicle_type: vehicleType,
    });

    if (data && data.length > 0) {
      setTollRoute(data[0]);
    } else {
      setTollRoute(null);
    }
  };

  const calculateDistanceWithGoogleMaps = async () => {
    if (!googleMapsApiKey) {
      alert('Please configure Google Maps API key in Settings');
      return;
    }

    setCalculating(true);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(fromLocation)}&destinations=${encodeURIComponent(toLocation)}&key=${googleMapsApiKey}&mode=driving`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
        const element = data.rows[0].elements[0];
        const distanceInMeters = element.distance.value;
        const durationInSeconds = element.duration.value;

        const distanceKm = Math.round(distanceInMeters / 1000);
        const durationMinutes = Math.round(durationInSeconds / 60);

        setDistance(distanceKm);
        setDuration(durationMinutes);

        await supabase.from('distance_calculation_log').insert([{
          from_location: fromLocation,
          to_location: toLocation,
          distance_km: distanceKm,
          duration_minutes: durationMinutes,
          api_provider: 'google_maps',
          calculation_method: 'api',
          api_response: data,
          calculated_by: user?.id,
        }]);

        await supabase.from('distance_calculator_config').upsert([{
          from_location: fromLocation,
          to_location: toLocation,
          distance_km: distanceKm,
          estimated_duration_minutes: durationMinutes,
          google_maps_data: data,
          last_updated: new Date().toISOString(),
          created_by: user?.id,
        }]);
      } else {
        alert('Unable to calculate distance. Please enter manually.');
        setManualDistance(true);
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
      alert('Error calculating distance. Please enter manually.');
      setManualDistance(true);
    } finally {
      setCalculating(false);
    }
  };

  const calculateCost = async () => {
    if (distance <= 0) return;

    const { data } = await supabase.rpc('calculate_distance_based_trucking_cost', {
      p_from_location: fromLocation,
      p_to_location: toLocation,
      p_distance_km: distance,
      p_vehicle_type: vehicleType,
      p_duration_minutes: duration || null,
      p_include_toll: true,
      p_include_driver_allowance: duration > 0,
    });

    if (data && data.length > 0) {
      setCalculationResult(data[0]);
    }
  };

  const saveCalculation = async () => {
    if (!calculationResult || !distance) {
      alert('Please calculate distance first');
      return;
    }

    if (isBillableToAgent && !revenueAmount) {
      alert('Please enter revenue amount for billable services');
      return;
    }

    setSavingCalculation(true);

    try {
      const marginAmount = isBillableToAgent
        ? revenueAmount - calculationResult.total_cost
        : -calculationResult.total_cost;

      const marginPercentage = isBillableToAgent && calculationResult.total_cost > 0
        ? (marginAmount / calculationResult.total_cost) * 100
        : -100;

      await supabase.from('distance_calculation_log').insert([{
        from_location: fromLocation,
        to_location: toLocation,
        distance_km: distance,
        duration_minutes: duration || null,
        api_provider: manualDistance ? 'manual' : 'google_maps',
        calculation_method: manualDistance ? 'manual' : 'api',
        calculated_by: user?.id,
        is_billable_to_agent: isBillableToAgent,
        revenue_amount: isBillableToAgent ? revenueAmount : 0,
        cost_amount: calculationResult.total_cost,
        margin_amount: marginAmount,
        margin_percentage: marginPercentage,
      }]);

      alert('Calculation saved successfully!');
    } catch (error) {
      console.error('Error saving calculation:', error);
      alert('Failed to save calculation');
    } finally {
      setSavingCalculation(false);
    }
  };

  const selectedVehicleConfig = vehicleConfigs.find(c => c.vehicle_type === vehicleType);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Distance-Based Trucking Calculator</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>

      {showSettings && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Google Maps API Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps API Key</label>
              <input
                type="text"
                value={googleMapsApiKey}
                onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your Google Maps API key"
              />
              <p className="text-xs text-gray-600 mt-1">
                Get your API key from: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a>
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-300 rounded">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Note:</p>
                <p>Enable "Distance Matrix API" in your Google Cloud project. If not configured, you can enter distance manually.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Route Details</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Nhava Sheva, Maharashtra"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Location</label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Delhi, Delhi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {vehicleTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={manualDistance}
                    onChange={(e) => setManualDistance(e.target.checked)}
                    className="mr-2"
                  />
                  Enter Distance Manually
                </label>
              </div>
            </div>

            {!manualDistance ? (
              <button
                onClick={calculateDistanceWithGoogleMaps}
                disabled={calculating || !fromLocation || !toLocation}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                {calculating ? 'Calculating Distance...' : 'Calculate Distance (Google Maps)'}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={distance || ''}
                    onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter distance in KM"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={duration || ''}
                    onChange={(e) => setDuration(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Estimated travel time"
                  />
                </div>
              </div>
            )}

            {distance > 0 && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Distance</p>
                  <p className="text-2xl font-bold text-blue-900">{distance} KM</p>
                </div>
                {duration > 0 && (
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Estimated Duration</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {Math.floor(duration / 60)}h {duration % 60}m
                    </p>
                  </div>
                )}
              </div>
            )}

            {tollRoute && (
              <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                <h4 className="font-bold text-orange-900 mb-2">Toll Route Found: {tollRoute.route_name}</h4>
                <p className="text-sm text-orange-800 mb-2">
                  Total Toll Cost: <span className="font-bold text-lg">{tollRoute.total_toll_cost} INR</span>
                </p>
                {tollRoute.toll_points && tollRoute.toll_points.length > 0 && (
                  <details className="text-xs text-orange-700">
                    <summary className="cursor-pointer font-medium">View {tollRoute.toll_points.length} Toll Points</summary>
                    <div className="mt-2 space-y-1">
                      {tollRoute.toll_points.map((point: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>{point.name}</span>
                          <span className="font-medium">{point.cost} INR</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <p className="text-xs text-orange-600 mt-2">Last verified: {tollRoute.last_verified}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Vehicle Cost Configuration</h3>

          {selectedVehicleConfig ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-gray-600">Base Cost/KM:</span>
                <span className="font-bold text-gray-900">{selectedVehicleConfig.base_cost_per_km} INR</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-gray-600">Fuel Cost/KM:</span>
                <span className="font-bold text-gray-900">{selectedVehicleConfig.fuel_cost_per_km} INR</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-gray-600">Maintenance/KM:</span>
                <span className="font-bold text-gray-900">{selectedVehicleConfig.maintenance_cost_per_km} INR</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b bg-blue-50 p-2 rounded">
                <span className="text-sm font-bold text-blue-900">Total Cost/KM:</span>
                <span className="font-bold text-blue-900 text-lg">{selectedVehicleConfig.total_cost_per_km} INR</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm text-gray-600">Driver Allowance/Day:</span>
                <span className="font-bold text-gray-900">{selectedVehicleConfig.driver_allowance_per_day} INR</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Select a vehicle type to view cost configuration</p>
          )}
        </div>
      </div>

      {calculationResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Cost Calculation Results
          </h3>

          <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isBillableToAgent}
                onChange={(e) => {
                  setIsBillableToAgent(e.target.checked);
                  if (!e.target.checked) {
                    setRevenueAmount(0);
                  }
                }}
                className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-lg font-bold text-gray-900">Is this billable to agent?</span>
                <p className="text-sm text-gray-700 mt-1">
                  {isBillableToAgent ? (
                    <span className="text-green-700">✓ <strong>YES</strong> - This cost will be charged to the agent and generate revenue</span>
                  ) : (
                    <span className="text-red-700">✗ <strong>NO</strong> - This is an internal cost only (no revenue generated)</span>
                  )}
                </p>
              </div>
            </label>

            {isBillableToAgent && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Amount (Charged to Agent) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={revenueAmount || ''}
                    onChange={(e) => setRevenueAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Amount you'll charge the agent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Should be ≥ Total Cost ({calculationResult.total_cost.toFixed(2)}) for profit
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                  <p className="text-sm text-blue-900 font-medium mb-1">Profit Calculation:</p>
                  <p className="text-xs text-blue-800">
                    Revenue: {revenueAmount.toFixed(2)} - Cost: {calculationResult.total_cost.toFixed(2)} =
                    <span className={`font-bold ml-1 ${(revenueAmount - calculationResult.total_cost) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {(revenueAmount - calculationResult.total_cost).toFixed(2)} INR
                      {calculationResult.total_cost > 0 && ` (${((revenueAmount - calculationResult.total_cost) / calculationResult.total_cost * 100).toFixed(1)}%)`}
                    </span>
                  </p>
                </div>

                <div className="col-span-2">
                  <button
                    onClick={saveCalculation}
                    disabled={savingCalculation || !revenueAmount}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingCalculation ? 'Saving...' : 'Save Calculation to Database'}
                  </button>
                </div>
              </div>
            )}

            {!isBillableToAgent && (
              <div className="mt-4 bg-red-50 border border-red-300 rounded-lg p-3">
                <p className="text-sm text-red-900 font-medium mb-1">⚠️ Pure Cost - No Revenue</p>
                <p className="text-xs text-red-800">
                  This trucking cost will be recorded as a pure expense with no revenue generated.
                  Total loss: {calculationResult.total_cost.toFixed(2)} INR
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-700 font-medium">Base Distance Cost</p>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {calculationResult.base_distance_cost.toFixed(0)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {calculationResult.cost_breakdown.base_cost_per_km} × {calculationResult.cost_breakdown.distance_km} km
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-green-700 font-medium">Fuel Cost</p>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                {calculationResult.fuel_cost.toFixed(0)}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {calculationResult.cost_breakdown.fuel_cost_per_km} × {calculationResult.cost_breakdown.distance_km} km
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-purple-700 font-medium">Maintenance</p>
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {calculationResult.maintenance_cost.toFixed(0)}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {calculationResult.cost_breakdown.maintenance_cost_per_km} × {calculationResult.cost_breakdown.distance_km} km
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-orange-700 font-medium">Toll Cost</p>
                <Navigation className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {calculationResult.toll_cost.toFixed(0)}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                {tollRoute ? 'From route config' : 'Estimated'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700 font-medium">Driver Allowance</p>
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {calculationResult.driver_allowance.toFixed(0)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {calculationResult.cost_breakdown.driver_days} day{calculationResult.cost_breakdown.driver_days !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 mb-1">Total Estimated Cost</p>
                <p className="text-4xl font-bold">
                  {calculationResult.total_cost.toFixed(0)} INR
                </p>
                <p className="text-sm text-blue-100 mt-2">
                  For {calculationResult.cost_breakdown.distance_km} km journey with {calculationResult.cost_breakdown.vehicle_type}
                </p>
              </div>
              <Calculator className="w-16 h-16 text-blue-200" />
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-bold text-gray-900 mb-3">Cost Breakdown Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Base + Fuel + Maintenance</p>
                <p className="font-bold text-gray-900">
                  {(calculationResult.base_distance_cost + calculationResult.fuel_cost + calculationResult.maintenance_cost).toFixed(0)} INR
                </p>
              </div>
              <div>
                <p className="text-gray-600">Variable Costs (Toll + Driver)</p>
                <p className="font-bold text-gray-900">
                  {(calculationResult.toll_cost + calculationResult.driver_allowance).toFixed(0)} INR
                </p>
              </div>
              <div>
                <p className="text-gray-600">Cost per KM (Total / Distance)</p>
                <p className="font-bold text-gray-900">
                  {(calculationResult.total_cost / calculationResult.cost_breakdown.distance_km).toFixed(2)} INR/km
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">All Vehicle Cost Configurations</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base/KM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel/KM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maintenance/KM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total/KM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver Allowance/Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vehicleConfigs.map((config) => (
                <tr
                  key={config.vehicle_type}
                  className={`hover:bg-gray-50 ${config.vehicle_type === vehicleType ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{config.vehicle_type}</td>
                  <td className="px-4 py-3 text-gray-900">{config.base_cost_per_km} INR</td>
                  <td className="px-4 py-3 text-gray-900">{config.fuel_cost_per_km} INR</td>
                  <td className="px-4 py-3 text-gray-900">{config.maintenance_cost_per_km} INR</td>
                  <td className="px-4 py-3 font-bold text-blue-900">{config.total_cost_per_km} INR</td>
                  <td className="px-4 py-3 text-gray-900">{config.driver_allowance_per_day} INR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}