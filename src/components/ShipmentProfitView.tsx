import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Truck,
  MapPin,
  Package,
  AlertCircle,
  Plus,
  Save,
  X,
  CheckCircle,
  Edit,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CheckpointValidator from './CheckpointValidator';

interface ShipmentProfit {
  id: string;
  draft_number: string;
  client_name: string;
  delivery_city: string;
  cbm: number;
  status: string;
  delivery_zone_type: string;
  requires_trucking: boolean;
  freight_revenue: number;
  fixed_charges_total: number;
  trucking_revenue: number;
  total_revenue_inr: number;
  container_cost_share: number;
  trucking_cost: number;
  total_cost_inr: number;
  gross_profit_inr: number;
  profit_margin_percentage: number;
  is_cost_allocated: boolean;
  zone_icon: string;
  profit_icon: string;
}

interface TruckingCost {
  id: string;
  cost_amount: number;
  is_billable: boolean;
  billable_amount: number;
  margin_percentage: number;
  profit_amount: number;
  vehicle_type: string;
  status: string;
}

export default function ShipmentProfitView() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<ShipmentProfit[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [truckingCost, setTruckingCost] = useState<TruckingCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTruckingForm, setShowTruckingForm] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);

  const [truckingFormData, setTruckingFormData] = useState({
    cost_amount: '',
    is_billable: false,
    billable_amount: '',
    vehicle_type: '',
    distance_km: '',
    notes: '',
  });

  useEffect(() => {
    loadShipments();
  }, []);

  useEffect(() => {
    if (selectedShipment) {
      loadTruckingCost();
    }
  }, [selectedShipment]);

  const loadShipments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('shipment_profit_summary')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setShipments(data || []);
    } catch (error) {
      console.error('Error loading shipments:', error);
      alert('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const loadTruckingCost = async () => {
    if (!selectedShipment) return;

    try {
      const { data, error } = await supabase
        .from('trucking_costs')
        .select('*')
        .eq('shipment_draft_id', selectedShipment)
        .maybeSingle();

      if (error) throw error;

      setTruckingCost(data);
    } catch (error) {
      console.error('Error loading trucking cost:', error);
    }
  };

  const handleTruckingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShipment) return;

    try {
      const truckingData = {
        shipment_draft_id: selectedShipment,
        cost_amount: parseFloat(truckingFormData.cost_amount),
        is_billable: truckingFormData.is_billable,
        billable_amount: truckingFormData.is_billable ? parseFloat(truckingFormData.billable_amount) : 0,
        vehicle_type: truckingFormData.vehicle_type,
        distance_km: truckingFormData.distance_km ? parseFloat(truckingFormData.distance_km) : null,
        notes: truckingFormData.notes,
        status: 'planned',
        created_by: user?.id,
      };

      if (truckingCost) {
        const { error } = await supabase
          .from('trucking_costs')
          .update(truckingData)
          .eq('id', truckingCost.id);

        if (error) throw error;
        alert('Trucking cost updated! Profit recalculated automatically.');
      } else {
        const { error } = await supabase.from('trucking_costs').insert([truckingData]);

        if (error) throw error;
        alert('Trucking cost added! Profit recalculated automatically.');
      }

      setShowTruckingForm(false);
      resetTruckingForm();
      loadTruckingCost();
      loadShipments();
    } catch (error) {
      console.error('Error saving trucking cost:', error);
      alert('Failed to save trucking cost');
    }
  };

  const resetTruckingForm = () => {
    setTruckingFormData({
      cost_amount: '',
      is_billable: false,
      billable_amount: '',
      vehicle_type: '',
      distance_km: '',
      notes: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const selectedShipmentData = shipments.find((s) => s.id === selectedShipment);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Shipment Profit & Cost Planning</h1>
        <p className="text-gray-600 mt-1">
          View profit estimates, add trucking costs, and track financial performance
        </p>
      </div>

      <div className="grid gap-4">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Shipments Yet</h3>
            <p className="text-gray-600">Create shipment drafts to see profit calculations here</p>
          </div>
        ) : (
          shipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{shipment.profit_icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{shipment.draft_number}</h3>
                      <span className="text-2xl">{shipment.zone_icon}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                        {shipment.delivery_zone_type?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div>{shipment.client_name}</div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {shipment.delivery_city}
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {shipment.cbm} CBM
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm text-blue-600 mb-1">Freight Revenue</div>
                  <div className="text-lg font-bold text-blue-900">
                    ₹{shipment.freight_revenue?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-sm text-purple-600 mb-1">Fixed Charges</div>
                  <div className="text-lg font-bold text-purple-900">
                    ₹{shipment.fixed_charges_total?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm text-green-600 mb-1">Total Revenue</div>
                  <div className="text-lg font-bold text-green-900">
                    ₹{shipment.total_revenue_inr?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="text-sm text-orange-600 mb-1">Total Cost</div>
                  <div className="text-lg font-bold text-orange-900">
                    ₹{shipment.total_cost_inr?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div
                  className={`rounded-lg p-4 ${
                    shipment.gross_profit_inr > 0 ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
                  }`}
                >
                  <div
                    className={`text-sm mb-1 ${shipment.gross_profit_inr > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    Gross Profit
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      shipment.gross_profit_inr > 0 ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    ₹{shipment.gross_profit_inr?.toLocaleString() || 0}
                  </div>
                </div>
                <div
                  className={`rounded-lg p-4 ${
                    shipment.profit_margin_percentage > 0
                      ? 'bg-green-50 border-2 border-green-200'
                      : 'bg-red-50 border-2 border-red-200'
                  }`}
                >
                  <div
                    className={`text-sm mb-1 ${
                      shipment.profit_margin_percentage > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    Profit Margin
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      shipment.profit_margin_percentage > 0 ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {shipment.profit_margin_percentage?.toFixed(2) || 0}%
                  </div>
                </div>
              </div>

              {shipment.requires_trucking && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Truck className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-900 mb-1">Trucking Required (Non-Metro)</div>
                      <div className="text-sm text-yellow-800">
                        {shipment.trucking_cost > 0 ? (
                          <div className="flex items-center justify-between">
                            <span>
                              Trucking Cost: ₹{shipment.trucking_cost.toLocaleString()}
                              {shipment.trucking_revenue > 0 && (
                                <span className="ml-2 text-green-700">
                                  | Revenue: ₹{shipment.trucking_revenue.toLocaleString()}
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedShipment(shipment.id);
                                setShowTruckingForm(true);
                              }}
                              className="text-yellow-900 hover:text-yellow-700 flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedShipment(shipment.id);
                              setShowTruckingForm(true);
                            }}
                            className="text-yellow-900 hover:text-yellow-700 flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add Trucking Cost
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    {shipment.is_cost_allocated ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Container costs allocated
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        Awaiting container cost allocation
                      </div>
                    )}
                    <div className="text-gray-400">•</div>
                    <div>
                      Container Share: ₹{shipment.container_cost_share?.toLocaleString() || 0}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedShipment(shipment.id);
                      setShowCheckpoints(true);
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Validate Checkpoints
                  </button>
                </div>

                {showCheckpoints && selectedShipment === shipment.id && (
                  <div className="mt-3">
                    <CheckpointValidator
                      entityId={shipment.id}
                      entityType="shipment"
                      showActions={true}
                      onValidationComplete={(canProceed, results) => {
                        console.log('Validation complete:', canProceed, results);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showTruckingForm && selectedShipmentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Trucking Cost Entry</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedShipmentData.draft_number} - {selectedShipmentData.delivery_city}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTruckingForm(false);
                  setSelectedShipment(null);
                  resetTruckingForm();
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleTruckingSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={truckingFormData.cost_amount}
                    onChange={(e) => setTruckingFormData({ ...truckingFormData, cost_amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Actual trucking cost"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Distance (KM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingFormData.distance_km}
                    onChange={(e) => setTruckingFormData({ ...truckingFormData, distance_km: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={truckingFormData.is_billable}
                    onChange={(e) =>
                      setTruckingFormData({ ...truckingFormData, is_billable: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Billable to customer (with margin)
                  </span>
                </label>
              </div>

              {truckingFormData.is_billable && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-900 mb-2">
                    Billable Amount (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required={truckingFormData.is_billable}
                    value={truckingFormData.billable_amount}
                    onChange={(e) =>
                      setTruckingFormData({ ...truckingFormData, billable_amount: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Amount charged to customer"
                  />
                  {truckingFormData.cost_amount && truckingFormData.billable_amount && (
                    <div className="mt-2 text-sm text-green-800">
                      Margin:{' '}
                      {(
                        ((parseFloat(truckingFormData.billable_amount) -
                          parseFloat(truckingFormData.cost_amount)) /
                          parseFloat(truckingFormData.cost_amount)) *
                        100
                      ).toFixed(2)}
                      % | Profit: ₹
                      {(
                        parseFloat(truckingFormData.billable_amount) - parseFloat(truckingFormData.cost_amount)
                      ).toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                <select
                  value={truckingFormData.vehicle_type}
                  onChange={(e) => setTruckingFormData({ ...truckingFormData, vehicle_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select vehicle type...</option>
                  <option value="Tata Ace">Tata Ace</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Truck - 14 ft">Truck - 14 ft</option>
                  <option value="Truck - 17 ft">Truck - 17 ft</option>
                  <option value="Truck - 19 ft">Truck - 19 ft</option>
                  <option value="Truck - 22 ft">Truck - 22 ft</option>
                  <option value="Container - 20 ft">Container - 20 ft</option>
                  <option value="Container - 40 ft">Container - 40 ft</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={truckingFormData.notes}
                  onChange={(e) => setTruckingFormData({ ...truckingFormData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Additional notes about trucking"
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Instant Profit Recalculation</p>
                    <p>
                      When you save this trucking cost, the shipment's profit will be automatically recalculated to
                      include the trucking expense and revenue (if billable).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {truckingCost ? 'Update' : 'Add'} Trucking Cost
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTruckingForm(false);
                    setSelectedShipment(null);
                    resetTruckingForm();
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
