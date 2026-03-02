import React, { useState, useEffect } from 'react';
import { Truck, Plus, CheckCircle, XCircle, DollarSign, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DeliveryZone {
  id: string;
  zone_name: string;
  city_name: string;
  state: string;
  zone_type: string;
  is_metro: boolean;
  auto_apply_groupage_rate: boolean;
  default_delivery_included: boolean;
}

interface TruckingCost {
  id: string;
  from_location: string;
  to_location: string;
  destination_city: string;
  zone_type: string;
  is_metro: boolean;
  default_delivery_included: boolean;
  vehicle_type: string;
  distance_km: number;
  base_trucking_cost: number;
  fuel_surcharge: number;
  toll_charges: number;
  escort_cost: number;
  loading_unloading_charges: number;
  handling_cost_destination: number;
  detention_charges: number;
  total_cost: number;
  margin_percentage: number;
  margin_amount: number;
  billing_option: string;
  extra_delivery_charge: number;
  base_revenue_included: number;
  estimated_profit: number;
  margin_warning: boolean;
  target_margin_percentage: number;
  currency: string;
  vendor_name: string;
  vendor_contact: string;
  is_approved: boolean;
  valid_from: string;
  valid_to: string;
  quote_number: string;
  shipment_number: string;
  remarks: string;
}

interface TruckingTemplate {
  id: string;
  from_location: string;
  to_location: string;
  vehicle_type: string;
  base_cost: number;
  cost_per_km: number;
  currency: string;
}

interface MarginCalculation {
  total_revenue: number;
  total_cost: number;
  estimated_profit: number;
  profit_margin_percentage: number;
  is_below_target: boolean;
  warning_message: string;
}

export default function ManualTruckingCost() {
  const { user } = useAuth();
  const [truckingCosts, setTruckingCosts] = useState<TruckingCost[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [templates, setTemplates] = useState<TruckingTemplate[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [destinationCheck, setDestinationCheck] = useState<DeliveryZone | null>(null);
  const [marginCalculation, setMarginCalculation] = useState<MarginCalculation | null>(null);

  const [activeTab, setActiveTab] = useState<'costs' | 'templates' | 'zones'>('costs');

  const [newCost, setNewCost] = useState({
    quote_id: '',
    shipment_id: '',
    from_location: 'Nhava Sheva',
    to_location: '',
    distance_km: 0,
    vehicle_type: '17ft',
    trucking_cost: 0,
    currency: 'INR',
    fuel_surcharge: 0,
    toll_charges: 0,
    escort_cost: 0,
    loading_unloading_charges: 0,
    handling_cost_destination: 0,
    detention_charges: 0,
    margin_percentage: 15,
    billing_option: 'agent_pays_extra',
    base_revenue_included: 0,
    is_billable_to_agent: true,
    revenue_amount: 0,
    billing_notes: '',
    vendor_name: '',
    vendor_contact: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    remarks: '',
    target_margin_percentage: 15,
  });

  const [newTemplate, setNewTemplate] = useState({
    from_location: 'Nhava Sheva',
    to_location: '',
    vehicle_type: '17ft',
    base_cost: 0,
    cost_per_km: 0,
    currency: 'INR',
    effective_from: new Date().toISOString().split('T')[0],
  });

  const [suggestedCost, setSuggestedCost] = useState<any>(null);

  const vehicleTypes = ['Tata 407', '10ft', '14ft', '17ft', '19ft', '20ft', '22ft', '24ft', '32ft Container'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (newCost.to_location) {
      checkDestinationZone(newCost.to_location);
    }
  }, [newCost.to_location]);

  useEffect(() => {
    if (newCost.from_location && newCost.to_location && newCost.vehicle_type) {
      getSuggestedCost();
    }
  }, [newCost.from_location, newCost.to_location, newCost.vehicle_type, newCost.distance_km]);

  useEffect(() => {
    calculateMargin();
  }, [
    newCost.trucking_cost,
    newCost.fuel_surcharge,
    newCost.toll_charges,
    newCost.escort_cost,
    newCost.loading_unloading_charges,
    newCost.handling_cost_destination,
    newCost.detention_charges,
    newCost.margin_percentage,
    newCost.billing_option,
    newCost.base_revenue_included,
    newCost.target_margin_percentage,
  ]);

  const loadData = async () => {
    const [costsRes, zonesRes, templatesRes, quotesRes, shipmentsRes] = await Promise.all([
      supabase.from('manual_trucking_summary').select('*').order('created_at', { ascending: false }),
      supabase.from('delivery_zones').select('*').order('city_name'),
      supabase.from('trucking_rate_templates').select('*').eq('is_active', true).order('to_location'),
      supabase.from('quotes').select('id, quote_number').order('quote_number', { ascending: false }).limit(50),
      supabase.from('shipments').select('id, shipment_number').order('shipment_number', { ascending: false }).limit(50),
    ]);

    if (costsRes.data) setTruckingCosts(costsRes.data);
    if (zonesRes.data) setDeliveryZones(zonesRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    if (quotesRes.data) setQuotes(quotesRes.data);
    if (shipmentsRes.data) setShipments(shipmentsRes.data);
  };

  const checkDestinationZone = async (cityName: string) => {
    const { data } = await supabase.rpc('get_delivery_zone', {
      p_city_name: cityName,
    });

    if (data && data.length > 0) {
      setDestinationCheck(data[0]);
    } else {
      setDestinationCheck(null);
    }
  };

  const getSuggestedCost = async () => {
    const { data } = await supabase.rpc('suggest_trucking_cost', {
      p_from_location: newCost.from_location,
      p_to_location: newCost.to_location,
      p_vehicle_type: newCost.vehicle_type,
      p_distance_km: newCost.distance_km || null,
    });

    if (data && data.length > 0) {
      setSuggestedCost(data[0]);
      setNewCost(prev => ({ ...prev, trucking_cost: data[0].suggested_cost || 0 }));
    } else {
      setSuggestedCost(null);
    }
  };

  const calculateTotalCost = () => {
    return (
      parseFloat(newCost.trucking_cost.toString() || '0') +
      parseFloat(newCost.fuel_surcharge.toString() || '0') +
      parseFloat(newCost.toll_charges.toString() || '0') +
      parseFloat(newCost.escort_cost.toString() || '0') +
      parseFloat(newCost.loading_unloading_charges.toString() || '0') +
      parseFloat(newCost.handling_cost_destination.toString() || '0') +
      parseFloat(newCost.detention_charges.toString() || '0')
    );
  };

  const calculateMargin = async () => {
    const totalCost = calculateTotalCost();
    const marginAmount = (totalCost * newCost.margin_percentage) / 100;
    const extraDeliveryCharge = totalCost + marginAmount;

    const baseRevenue = parseFloat(newCost.base_revenue_included.toString() || '0');
    const baseCost = 0;

    const { data } = await supabase.rpc('check_margin_warning', {
      p_base_revenue: baseRevenue,
      p_base_cost: baseCost,
      p_trucking_cost: totalCost,
      p_billing_option: newCost.billing_option,
      p_extra_delivery_charge: extraDeliveryCharge,
      p_target_margin: newCost.target_margin_percentage,
    });

    if (data && data.length > 0) {
      setMarginCalculation(data[0]);
    }
  };

  const createTruckingCost = async () => {
    if (!newCost.to_location || !newCost.vehicle_type || !newCost.trucking_cost) {
      alert('Please fill in all required fields');
      return;
    }

    if (marginCalculation?.is_below_target && !confirm(`${marginCalculation.warning_message}\n\nDo you want to proceed?`)) {
      return;
    }

    const zone = await supabase.rpc('get_delivery_zone', { p_city_name: newCost.to_location });
    const zoneId = zone.data?.[0]?.zone_id || null;

    const totalCost = calculateTotalCost();
    const marginAmount = (totalCost * newCost.margin_percentage) / 100;
    const extraDeliveryCharge = totalCost + marginAmount;

    const costData = {
      quote_id: newCost.quote_id || null,
      shipment_id: newCost.shipment_id || null,
      from_location: newCost.from_location,
      to_location: newCost.to_location,
      to_zone_id: zoneId,
      distance_km: newCost.distance_km || null,
      vehicle_type: newCost.vehicle_type,
      trucking_cost: newCost.trucking_cost,
      currency: newCost.currency,
      cost_per_km: newCost.distance_km > 0 ? (newCost.trucking_cost / newCost.distance_km) : null,
      fuel_surcharge: newCost.fuel_surcharge,
      toll_charges: newCost.toll_charges,
      escort_cost: newCost.escort_cost,
      loading_unloading_charges: newCost.loading_unloading_charges,
      handling_cost_destination: newCost.handling_cost_destination,
      detention_charges: newCost.detention_charges,
      total_cost: totalCost,
      margin_percentage: newCost.margin_percentage,
      margin_amount: marginAmount,
      billing_option: newCost.billing_option,
      extra_delivery_charge: extraDeliveryCharge,
      base_revenue_included: newCost.base_revenue_included,
      is_billable_to_agent: newCost.is_billable_to_agent,
      revenue_amount: newCost.revenue_amount,
      billing_notes: newCost.billing_notes,
      estimated_profit: marginCalculation?.estimated_profit || 0,
      margin_warning: marginCalculation?.is_below_target || false,
      target_margin_percentage: newCost.target_margin_percentage,
      vendor_name: newCost.vendor_name,
      vendor_contact: newCost.vendor_contact,
      valid_from: newCost.valid_from,
      valid_to: newCost.valid_to || null,
      remarks: newCost.remarks,
      created_by: user?.id,
    };

    const { error } = await supabase
      .from('manual_trucking_costs')
      .insert([costData]);

    if (error) {
      console.error('Error creating trucking cost:', error);
      alert('Failed to create trucking cost');
      return;
    }

    await loadData();
    setShowNewEntry(false);
    resetNewCost();
  };

  const createTemplate = async () => {
    if (!newTemplate.to_location || !newTemplate.vehicle_type || !newTemplate.base_cost) {
      alert('Please fill in all required fields');
      return;
    }

    const zone = await supabase.rpc('get_delivery_zone', { p_city_name: newTemplate.to_location });
    const zoneId = zone.data?.[0]?.zone_id || null;

    const { error } = await supabase
      .from('trucking_rate_templates')
      .insert([{
        ...newTemplate,
        to_zone_id: zoneId,
      }]);

    if (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template');
      return;
    }

    await loadData();
    setShowTemplateManager(false);
    setNewTemplate({
      from_location: 'Nhava Sheva',
      to_location: '',
      vehicle_type: '17ft',
      base_cost: 0,
      cost_per_km: 0,
      currency: 'INR',
      effective_from: new Date().toISOString().split('T')[0],
    });
  };

  const approveTruckingCost = async (id: string) => {
    const { error } = await supabase
      .from('manual_trucking_costs')
      .update({
        is_approved: true,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error approving cost:', error);
      return;
    }

    await loadData();
  };

  const resetNewCost = () => {
    setNewCost({
      quote_id: '',
      shipment_id: '',
      from_location: 'Nhava Sheva',
      to_location: '',
      distance_km: 0,
      vehicle_type: '17ft',
      trucking_cost: 0,
      currency: 'INR',
      fuel_surcharge: 0,
      toll_charges: 0,
      escort_cost: 0,
      loading_unloading_charges: 0,
      handling_cost_destination: 0,
      detention_charges: 0,
      margin_percentage: 15,
      billing_option: 'agent_pays_extra',
      base_revenue_included: 0,
      vendor_name: '',
      vendor_contact: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: '',
      remarks: '',
      target_margin_percentage: 15,
    });
    setDestinationCheck(null);
    setSuggestedCost(null);
    setMarginCalculation(null);
  };

  const totalCosts = truckingCosts.reduce((sum, cost) => sum + (cost.total_cost || 0), 0);
  const approvedCosts = truckingCosts.filter(c => c.is_approved).length;
  const pendingCosts = truckingCosts.filter(c => !c.is_approved).length;
  const warningCosts = truckingCosts.filter(c => c.margin_warning).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Manual Trucking Cost</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('costs')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'costs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Trucking Costs
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'templates' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'zones' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Delivery Zones
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{truckingCosts.length}</p>
            </div>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">{totalCosts.toFixed(0)} INR</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{approvedCosts}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Margin Warnings</p>
              <p className="text-2xl font-bold text-orange-600">{warningCosts}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {activeTab === 'costs' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewEntry(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Trucking Cost
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {truckingCosts.map((cost) => (
                    <tr key={cost.id} className={`hover:bg-gray-50 ${cost.margin_warning ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{cost.from_location}</div>
                        <div className="text-sm text-blue-600">→ {cost.to_location}</div>
                        {cost.quote_number && (
                          <div className="text-xs text-gray-500">Q: {cost.quote_number}</div>
                        )}
                        {cost.shipment_number && (
                          <div className="text-xs text-gray-500">S: {cost.shipment_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            cost.is_metro ? 'bg-green-100 text-green-800' :
                            cost.zone_type === 'tier1' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {cost.zone_type || 'N/A'}
                          </span>
                        </div>
                        {cost.default_delivery_included && (
                          <div className="text-xs text-green-600 mt-1">Delivery Incl.</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{cost.vehicle_type}</div>
                        {cost.distance_km > 0 && (
                          <div className="text-xs text-gray-500">{cost.distance_km} km</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-bold text-gray-900">Total: {cost.total_cost.toFixed(0)}</div>
                        <div className="text-gray-600">Base: {cost.base_trucking_cost.toFixed(0)}</div>
                        {cost.fuel_surcharge > 0 && <div className="text-gray-600">Fuel: +{cost.fuel_surcharge}</div>}
                        {cost.toll_charges > 0 && <div className="text-gray-600">Toll: +{cost.toll_charges}</div>}
                        {cost.escort_cost > 0 && <div className="text-gray-600">Escort: +{cost.escort_cost}</div>}
                        {cost.handling_cost_destination > 0 && <div className="text-gray-600">Handling: +{cost.handling_cost_destination}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cost.billing_option === 'agent_pays_extra' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {cost.billing_option === 'agent_pays_extra' ? 'Agent Pays' : 'Absorb Cost'}
                        </div>
                        {cost.billing_option === 'agent_pays_extra' && (
                          <div className="text-xs text-gray-600 mt-1">+{cost.extra_delivery_charge.toFixed(0)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {cost.margin_warning ? (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          )}
                          <span className={`font-bold ${cost.margin_warning ? 'text-red-600' : 'text-green-600'}`}>
                            {cost.margin_percentage.toFixed(1)}%
                          </span>
                        </div>
                        {cost.estimated_profit !== 0 && (
                          <div className="text-xs text-gray-600">{cost.estimated_profit.toFixed(0)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cost.is_approved ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {cost.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!cost.is_approved && (
                          <button
                            onClick={() => approveTruckingCost(cost.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowTemplateManager(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{template.from_location}</h3>
                    <p className="text-blue-600">→ {template.to_location}</p>
                  </div>
                  <Truck className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehicle:</span>
                    <span className="font-medium">{template.vehicle_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Cost:</span>
                    <span className="font-medium">{template.base_cost} {template.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Per KM:</span>
                    <span className="font-medium">{template.cost_per_km} {template.currency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'zones' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Included</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveryZones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{zone.zone_name}</td>
                    <td className="px-4 py-3 text-gray-900">{zone.city_name}</td>
                    <td className="px-4 py-3 text-gray-600">{zone.state}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        zone.zone_type === 'metro' ? 'bg-green-100 text-green-800' :
                        zone.zone_type === 'tier1' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {zone.zone_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {zone.is_metro ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {zone.default_delivery_included ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-300" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Manual Trucking Cost</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quote (Optional)</label>
                  <select
                    value={newCost.quote_id}
                    onChange={(e) => setNewCost({ ...newCost, quote_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Quote</option>
                    {quotes.map(q => (
                      <option key={q.id} value={q.id}>{q.quote_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipment (Optional)</label>
                  <select
                    value={newCost.shipment_id}
                    onChange={(e) => setNewCost({ ...newCost, shipment_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Shipment</option>
                    {shipments.map(s => (
                      <option key={s.id} value={s.id}>{s.shipment_number}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Location *</label>
                  <input
                    type="text"
                    value={newCost.from_location}
                    onChange={(e) => setNewCost({ ...newCost, from_location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Location * (City Name)</label>
                  <input
                    type="text"
                    value={newCost.to_location}
                    onChange={(e) => setNewCost({ ...newCost, to_location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Pune, Ahmedabad, Nagpur"
                  />
                </div>

                {destinationCheck && (
                  <div className="col-span-2">
                    <div className={`p-4 rounded-lg ${
                      destinationCheck.is_metro ? 'bg-green-50 border-2 border-green-300' : 'bg-orange-50 border-2 border-orange-300'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {destinationCheck.is_metro ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <p className="text-green-900 font-bold text-lg">METRO CITY - Apply Rate Sheet Normally</p>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-6 h-6 text-orange-600" />
                            <p className="text-orange-900 font-bold text-lg">NON-METRO - Additional Trucking Required</p>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 font-medium">
                        Zone: {destinationCheck.zone_name} | Type: {destinationCheck.zone_type} |
                        Delivery Included: {destinationCheck.default_delivery_included ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={newCost.distance_km || ''}
                    onChange={(e) => setNewCost({ ...newCost, distance_km: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Truck Type *</label>
                  <select
                    value={newCost.vehicle_type}
                    onChange={(e) => setNewCost({ ...newCost, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {vehicleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {suggestedCost && (
                  <div className="col-span-2 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                    <p className="text-blue-900 font-bold mb-2">Template Found - Suggested Cost:</p>
                    <p className="text-3xl font-bold text-blue-900">{suggestedCost.suggested_cost.toFixed(0)} {suggestedCost.currency}</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Base: {suggestedCost.base_cost} + ({suggestedCost.cost_per_km}/km × {newCost.distance_km}km)
                    </p>
                  </div>
                )}

                <div className="col-span-2">
                  <h4 className="font-bold text-gray-900 mb-3 text-lg border-b pb-2">Cost Breakdown</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Trucking Cost (Vendor Quote) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.trucking_cost || ''}
                    onChange={(e) => setNewCost({ ...newCost, trucking_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Surcharge</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.fuel_surcharge || ''}
                    onChange={(e) => setNewCost({ ...newCost, fuel_surcharge: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Toll Estimate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.toll_charges || ''}
                    onChange={(e) => setNewCost({ ...newCost, toll_charges: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Escort Cost (if any)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.escort_cost || ''}
                    onChange={(e) => setNewCost({ ...newCost, escort_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loading/Unloading</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.loading_unloading_charges || ''}
                    onChange={(e) => setNewCost({ ...newCost, loading_unloading_charges: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Handling Cost at Destination</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.handling_cost_destination || ''}
                    onChange={(e) => setNewCost({ ...newCost, handling_cost_destination: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2 bg-gray-100 border-2 border-gray-300 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Total Trucking Cost:</p>
                  <p className="text-3xl font-bold text-gray-900">{calculateTotalCost().toFixed(2)} {newCost.currency}</p>
                </div>

                <div className="col-span-2">
                  <h4 className="font-bold text-gray-900 mb-3 text-lg border-b pb-2">Revenue vs Cost Logic</h4>
                </div>

                <div className="col-span-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCost.is_billable_to_agent}
                      onChange={(e) => {
                        const isBillable = e.target.checked;
                        setNewCost({
                          ...newCost,
                          is_billable_to_agent: isBillable,
                          revenue_amount: isBillable ? newCost.revenue_amount : 0
                        });
                      }}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-lg font-bold text-gray-900">Is this billable to agent?</span>
                      <p className="text-sm text-gray-700 mt-1">
                        {newCost.is_billable_to_agent ? (
                          <span className="text-green-700">✓ <strong>YES</strong> - This cost will be charged to the agent and generate revenue</span>
                        ) : (
                          <span className="text-red-700">✗ <strong>NO</strong> - This is an internal cost only (no revenue generated)</span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                {newCost.is_billable_to_agent && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Amount (Charged to Agent) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newCost.revenue_amount || ''}
                        onChange={(e) => setNewCost({ ...newCost, revenue_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Amount you'll charge the agent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Should be ≥ Total Cost ({calculateTotalCost().toFixed(2)}) for profit
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                      <p className="text-sm text-blue-900 font-medium mb-1">Profit Calculation:</p>
                      <p className="text-xs text-blue-800">
                        Revenue: {newCost.revenue_amount.toFixed(2)} - Cost: {calculateTotalCost().toFixed(2)} =
                        <span className={`font-bold ml-1 ${(newCost.revenue_amount - calculateTotalCost()) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {(newCost.revenue_amount - calculateTotalCost()).toFixed(2)} INR
                          {calculateTotalCost() > 0 && ` (${((newCost.revenue_amount - calculateTotalCost()) / calculateTotalCost() * 100).toFixed(1)}%)`}
                        </span>
                      </p>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Billing Notes</label>
                      <textarea
                        value={newCost.billing_notes}
                        onChange={(e) => setNewCost({ ...newCost, billing_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="e.g., Negotiated rate with agent, special terms, etc."
                      />
                    </div>
                  </>
                )}

                {!newCost.is_billable_to_agent && (
                  <div className="col-span-2 bg-red-50 border border-red-300 rounded-lg p-3">
                    <p className="text-sm text-red-900 font-medium mb-1">⚠️ Pure Cost - No Revenue</p>
                    <p className="text-xs text-red-800">
                      This trucking cost will be recorded as a pure expense with no revenue generated.
                      Total loss: {calculateTotalCost().toFixed(2)} INR
                    </p>
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-red-900 mb-1">Reason (Optional)</label>
                      <input
                        type="text"
                        value={newCost.billing_notes}
                        onChange={(e) => setNewCost({ ...newCost, billing_notes: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        placeholder="e.g., Company vehicle, internal move, courtesy service"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Option *</label>
                  <select
                    value={newCost.billing_option}
                    onChange={(e) => setNewCost({ ...newCost, billing_option: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="agent_pays_extra">Option A - Agent Pays Extra</option>
                    <option value="absorb_cost">Option B - Absorb Cost</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {newCost.billing_option === 'agent_pays_extra'
                      ? 'Add extra delivery charge to agent invoice'
                      : 'Absorb cost internally - reduces profit'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Margin % on Trucking</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCost.margin_percentage || ''}
                    onChange={(e) => setNewCost({ ...newCost, margin_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Revenue Included (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.base_revenue_included || ''}
                    onChange={(e) => setNewCost({ ...newCost, base_revenue_included: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Revenue from slab rate"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Margin %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCost.target_margin_percentage || ''}
                    onChange={(e) => setNewCost({ ...newCost, target_margin_percentage: parseFloat(e.target.value) || 15 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {marginCalculation && (
                  <div className="col-span-2">
                    <div className={`p-4 rounded-lg border-2 ${
                      marginCalculation.is_below_target
                        ? 'bg-red-50 border-red-300'
                        : 'bg-green-50 border-green-300'
                    }`}>
                      <h4 className="font-bold text-lg mb-3">
                        {marginCalculation.is_below_target ? '⚠️ MARGIN WARNING' : '✓ Margin OK'}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Revenue ({newCost.currency}):</p>
                          <p className="text-xl font-bold text-gray-900">{marginCalculation.total_revenue.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total Cost ({newCost.currency}):</p>
                          <p className="text-xl font-bold text-gray-900">{marginCalculation.total_cost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Estimated Profit:</p>
                          <p className={`text-xl font-bold ${
                            marginCalculation.estimated_profit > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {marginCalculation.estimated_profit.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Profit Margin:</p>
                          <p className={`text-xl font-bold ${
                            marginCalculation.is_below_target ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {marginCalculation.profit_margin_percentage.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      {marginCalculation.warning_message && (
                        <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
                          <p className="text-red-800 font-medium">{marginCalculation.warning_message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                  <input
                    type="text"
                    value={newCost.vendor_name}
                    onChange={(e) => setNewCost({ ...newCost, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Contact</label>
                  <input
                    type="text"
                    value={newCost.vendor_contact}
                    onChange={(e) => setNewCost({ ...newCost, vendor_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={newCost.valid_from}
                    onChange={(e) => setNewCost({ ...newCost, valid_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
                  <input
                    type="date"
                    value={newCost.valid_to}
                    onChange={(e) => setNewCost({ ...newCost, valid_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    value={newCost.remarks}
                    onChange={(e) => setNewCost({ ...newCost, remarks: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowNewEntry(false);
                    resetNewCost();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTruckingCost}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Trucking Cost
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplateManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Trucking Rate Template</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Location *</label>
                  <input
                    type="text"
                    value={newTemplate.from_location}
                    onChange={(e) => setNewTemplate({ ...newTemplate, from_location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Location *</label>
                  <input
                    type="text"
                    value={newTemplate.to_location}
                    onChange={(e) => setNewTemplate({ ...newTemplate, to_location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type *</label>
                  <select
                    value={newTemplate.vehicle_type}
                    onChange={(e) => setNewTemplate({ ...newTemplate, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {vehicleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={newTemplate.currency}
                    onChange={(e) => setNewTemplate({ ...newTemplate, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Cost *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTemplate.base_cost || ''}
                    onChange={(e) => setNewTemplate({ ...newTemplate, base_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per KM *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTemplate.cost_per_km || ''}
                    onChange={(e) => setNewTemplate({ ...newTemplate, cost_per_km: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={newTemplate.effective_from}
                    onChange={(e) => setNewTemplate({ ...newTemplate, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowTemplateManager(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}