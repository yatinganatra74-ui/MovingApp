import React, { useState, useEffect } from 'react';
import { Container, Plus, DollarSign, TrendingUp, Package, Ship, Eye, X, Plane } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TransportModeSelector from './TransportModeSelector';
import LocationPicker from './LocationPicker';

interface GroupageContainer {
  id: string;
  container_number: string;
  container_type: string;
  status: string;
  origin_port: string;
  destination_port: string;
  etd: string | null;
  eta: string | null;
  total_capacity_cbm: number;
  used_capacity_cbm: number;
  remaining_capacity_cbm: number;
  utilization_percent: number;
  total_cost: number;
  total_revenue_base: number;
  total_allocated_cost: number;
  profit_base: number;
  profit_margin_percent: number;
  shipment_count: number;
}

interface ContainerShipment {
  id: string;
  shipment_number: string;
  customer_id: string;
  agent_id: string;
  rate_sheet_id: string;
  locked_exchange_rate: number;
  cbm: number;
  weight_kg: number;
  package_count: number;
  description: string;
  revenue_base: number;
  allocated_cost_base: number;
  profit_base: number;
  profit_margin_percent: number;
  customers: { name: string } | null;
  agents: { name: string } | null;
  rate_sheets: { name: string; base_currency: string } | null;
}

interface Agent {
  id: string;
  name: string;
  type: string;
}

interface RateSheet {
  id: string;
  name: string;
  base_currency: string;
  agent_id: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function GroupageContainers() {
  const { user } = useAuth();
  const [containers, setContainers] = useState<GroupageContainer[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [containerShipments, setContainerShipments] = useState<ContainerShipment[]>([]);
  const [costItems, setCostItems] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'SEA' | 'AIR'>('ALL');

  const [showNewContainer, setShowNewContainer] = useState(false);
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [showContainerDetails, setShowContainerDetails] = useState(false);

  const [newContainer, setNewContainer] = useState({
    container_number: '',
    container_type: '20ft',
    transport_mode: 'SEA' as 'SEA' | 'AIR',
    origin_port: '',
    destination_port: '',
    origin_location_id: '',
    destination_location_id: '',
    etd: '',
    eta: '',
  });

  const [newShipment, setNewShipment] = useState({
    customer_id: '',
    agent_id: '',
    rate_sheet_id: '',
    cbm: 0,
    weight_kg: 0,
    package_count: 1,
    description: '',
  });

  const [newCost, setNewCost] = useState({
    description: '',
    category: 'freight',
    amount: 0,
    currency: 'INR',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedContainer) {
      loadContainerDetails(selectedContainer);
    }
  }, [selectedContainer]);

  const loadData = async () => {
    const [containersRes, agentsRes, rateSheetsRes, customersRes, ratesRes, configRes] = await Promise.all([
      supabase.from('container_dashboard').select('*').order('created_at', { ascending: false }),
      supabase.from('agents').select('*').eq('is_active', true).order('name'),
      supabase.from('rate_sheets').select('*').eq('is_active', true).order('name'),
      supabase.from('customers').select('id, name, email').order('name'),
      supabase.from('exchange_rates').select('*').order('effective_date', { ascending: false }),
      supabase.from('system_config').select('*').eq('config_key', 'base_currency').single(),
    ]);

    if (containersRes.data) setContainers(containersRes.data);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (rateSheetsRes.data) setRateSheets(rateSheetsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    if (ratesRes.data) setExchangeRates(ratesRes.data);
    if (configRes.data) setBaseCurrency(configRes.data.config_value);
  };

  const loadContainerDetails = async (containerId: string) => {
    const [shipmentsRes, costsRes] = await Promise.all([
      supabase
        .from('container_shipments')
        .select('*, customers(name), agents(name), rate_sheets(name, base_currency)')
        .eq('container_id', containerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('container_costs')
        .select('*, agents(name)')
        .eq('container_id', containerId)
        .order('created_at', { ascending: false }),
    ]);

    if (shipmentsRes.data) setContainerShipments(shipmentsRes.data);
    if (costsRes.data) setCostItems(costsRes.data);
  };

  const getExchangeRate = (fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return 1;
    const rate = exchangeRates.find(
      r => r.from_currency === fromCurrency && r.to_currency === toCurrency
    );
    return rate ? rate.rate : 1;
  };

  const createContainer = async () => {
    if (!newContainer.container_number) {
      alert('Please fill in all required fields');
      return;
    }

    if (newContainer.transport_mode === 'SEA' && (!newContainer.origin_port || !newContainer.destination_port)) {
      alert('Please fill in origin and destination ports');
      return;
    }

    if (newContainer.transport_mode === 'AIR' && (!newContainer.origin_location_id || !newContainer.destination_location_id)) {
      alert('Please select origin and destination airports');
      return;
    }

    const capacityMap: { [key: string]: number } = {
      '20ft': 33,
      '40ft': 67,
      '40HC': 76,
    };

    const containerData = {
      container_number: newContainer.container_number,
      container_type: newContainer.container_type,
      transport_mode: newContainer.transport_mode,
      origin_port: newContainer.origin_port || null,
      destination_port: newContainer.destination_port || null,
      origin_location_id: newContainer.origin_location_id || null,
      destination_location_id: newContainer.destination_location_id || null,
      etd: newContainer.etd || null,
      eta: newContainer.eta || null,
      total_capacity_cbm: newContainer.transport_mode === 'SEA' ? (capacityMap[newContainer.container_type] || 33) : null,
      total_capacity_kg: newContainer.transport_mode === 'AIR' ? 5000 : null,
      created_by: user?.id,
    };

    const { data, error } = await supabase
      .from('groupage_containers')
      .insert([containerData])
      .select()
      .single();

    if (error) {
      console.error('Error creating container:', error);
      alert('Failed to create container');
      return;
    }

    await loadData();
    setShowNewContainer(false);
    setNewContainer({
      container_number: '',
      container_type: '20ft',
      origin_port: '',
      destination_port: '',
      etd: '',
      eta: '',
    });
  };

  const addShipment = async () => {
    if (!selectedContainer || !newShipment.agent_id || !newShipment.rate_sheet_id || newShipment.cbm <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    const container = containers.find(c => c.id === selectedContainer);
    if (!container) return;

    if (container.used_capacity_cbm + newShipment.cbm > container.total_capacity_cbm) {
      alert(`Not enough space! Available: ${container.remaining_capacity_cbm} CBM`);
      return;
    }

    const selectedRateSheet = rateSheets.find(rs => rs.id === newShipment.rate_sheet_id);
    if (!selectedRateSheet) return;

    const exchangeRate = getExchangeRate(selectedRateSheet.base_currency, baseCurrency);
    const shipmentNumber = `GRP${Date.now().toString().slice(-8)}`;

    const { data: shipmentData, error: shipmentError } = await supabase
      .from('container_shipments')
      .insert([{
        container_id: selectedContainer,
        shipment_number: shipmentNumber,
        ...newShipment,
        locked_exchange_rate: exchangeRate,
        created_by: user?.id,
      }])
      .select()
      .single();

    if (shipmentError) {
      console.error('Error creating shipment:', shipmentError);
      alert('Failed to create shipment');
      return;
    }

    const { data: slabRevenue, error: slabError } = await supabase.rpc('calculate_slab_revenue', {
      p_rate_sheet_id: newShipment.rate_sheet_id,
      p_cbm: newShipment.cbm,
      p_exchange_rate: exchangeRate,
    });

    if (slabError) {
      console.error('Error calculating revenue:', slabError);
    } else if (slabRevenue && slabRevenue.length > 0) {
      const revenueItems = slabRevenue.map((item: any) => ({
        container_shipment_id: shipmentData.id,
        description: item.description,
        category: item.charge_type,
        amount: item.amount_foreign,
        currency: item.currency,
        exchange_rate: item.exchange_rate,
        amount_in_base_currency: item.amount_base,
      }));

      await supabase.from('container_shipment_revenue').insert(revenueItems);
    }

    setShowAddShipment(false);
    setNewShipment({
      customer_id: '',
      agent_id: '',
      rate_sheet_id: '',
      cbm: 0,
      weight_kg: 0,
      package_count: 1,
      description: '',
    });

    await loadData();
    await loadContainerDetails(selectedContainer);
  };

  const addCost = async () => {
    if (!selectedContainer || !newCost.description || newCost.amount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    const exchangeRate = getExchangeRate(newCost.currency, baseCurrency);
    const amountInInr = newCost.amount * exchangeRate;

    const { error } = await supabase
      .from('container_costs')
      .insert([{
        container_id: selectedContainer,
        ...newCost,
        exchange_rate: exchangeRate,
        amount_in_inr: amountInInr,
      }]);

    if (error) {
      console.error('Error adding cost:', error);
      alert('Failed to add cost');
      return;
    }

    setShowAddCost(false);
    setNewCost({
      description: '',
      category: 'freight',
      amount: 0,
      currency: 'INR',
    });

    await loadData();
    await loadContainerDetails(selectedContainer);
  };

  const viewContainerDetails = (containerId: string) => {
    setSelectedContainer(containerId);
    setShowContainerDetails(true);
    loadContainerDetails(containerId);
  };

  const filteredRateSheets = rateSheets.filter(rs => rs.agent_id === newShipment.agent_id);

  const filteredContainers = containers.filter(c => {
    if (modeFilter === 'ALL') return true;
    return c.transport_mode === modeFilter;
  });

  const totalProfit = filteredContainers.reduce((sum, c) => sum + (c.profit_base || 0), 0);
  const totalRevenue = filteredContainers.reduce((sum, c) => sum + (c.total_revenue_base || 0), 0);
  const totalShipments = filteredContainers.reduce((sum, c) => sum + (c.shipment_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Groupage Containers</h2>
        <button
          onClick={() => setShowNewContainer(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Container
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setModeFilter('ALL')}
          className={`px-4 py-2 font-medium transition-colors ${
            modeFilter === 'ALL'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Containers
        </button>
        <button
          onClick={() => setModeFilter('SEA')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            modeFilter === 'SEA'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Ship className="w-4 h-4" />
          Sea Freight
        </button>
        <button
          onClick={() => setModeFilter('AIR')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            modeFilter === 'AIR'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Plane className="w-4 h-4" />
          Air Freight
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Containers</p>
              <p className="text-2xl font-bold text-gray-900">{filteredContainers.length}</p>
            </div>
            <Container className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{totalShipments}</p>
            </div>
            <Package className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalRevenue.toFixed(0)} {baseCurrency}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfit.toFixed(0)} {baseCurrency}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Container</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContainers.map((container) => (
                <tr key={container.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{container.container_number}</div>
                    <div className="text-xs text-gray-500">{container.container_type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-900">{container.origin_port} → {container.destination_port}</div>
                    <div className="text-xs text-gray-500">
                      {container.etd && `ETD: ${new Date(container.etd).toLocaleDateString()}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {container.used_capacity_cbm.toFixed(1)} / {container.total_capacity_cbm} CBM
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${
                          container.utilization_percent > 90 ? 'bg-red-500' :
                          container.utilization_percent > 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(container.utilization_percent, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{container.utilization_percent.toFixed(1)}%</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-medium">
                      {container.shipment_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {container.total_revenue_base.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600">
                    {container.total_allocated_cost.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold">
                    <span className={container.profit_base >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {container.profit_base.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={container.profit_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {container.profit_margin_percent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => viewContainerDetails(container.id)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNewContainer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Container</h3>
            <div className="space-y-4">
              <TransportModeSelector
                value={newContainer.transport_mode}
                onChange={(mode) => setNewContainer({ ...newContainer, transport_mode: mode })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Container Number *</label>
                  <input
                    type="text"
                    value={newContainer.container_number}
                    onChange={(e) => setNewContainer({ ...newContainer, container_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="MSCU1234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Container Type *</label>
                  <select
                    value={newContainer.container_type}
                    onChange={(e) => setNewContainer({ ...newContainer, container_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="20ft">20ft (33 CBM)</option>
                    <option value="40ft">40ft (67 CBM)</option>
                    <option value="40HC">40HC (76 CBM)</option>
                  </select>
                </div>
              </div>

              {newContainer.transport_mode === 'SEA' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin Port *</label>
                    <input
                      type="text"
                      value={newContainer.origin_port}
                      onChange={(e) => setNewContainer({ ...newContainer, origin_port: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination Port *</label>
                    <input
                      type="text"
                      value={newContainer.destination_port}
                      onChange={(e) => setNewContainer({ ...newContainer, destination_port: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <LocationPicker
                    transportMode="AIR"
                    value={newContainer.origin_location_id}
                    onChange={(id) => setNewContainer({ ...newContainer, origin_location_id: id })}
                    label="Origin Airport *"
                  />
                  <LocationPicker
                    transportMode="AIR"
                    value={newContainer.destination_location_id}
                    onChange={(id) => setNewContainer({ ...newContainer, destination_location_id: id })}
                    label="Destination Airport *"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ETD</label>
                  <input
                    type="date"
                    value={newContainer.etd}
                    onChange={(e) => setNewContainer({ ...newContainer, etd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ETA</label>
                  <input
                    type="date"
                    value={newContainer.eta}
                    onChange={(e) => setNewContainer({ ...newContainer, eta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowNewContainer(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createContainer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Container
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showContainerDetails && selectedContainer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-6xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Container Details</h3>
              <button
                onClick={() => {
                  setShowContainerDetails(false);
                  setSelectedContainer(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setShowAddShipment(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Shipment
              </button>

              <button
                onClick={() => setShowAddCost(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Container Cost
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900">Shipments ({containerShipments.length})</h4>
                <div className="space-y-2">
                  {containerShipments.map((shipment) => (
                    <div key={shipment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{shipment.shipment_number}</p>
                          <p className="text-sm text-gray-600">{shipment.customers?.name || 'No customer'}</p>
                          <p className="text-xs text-gray-500">{shipment.agents?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{shipment.cbm} CBM</p>
                          <p className="text-xs text-gray-500">{shipment.package_count} pkgs</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div>
                          <p className="text-gray-500">Revenue</p>
                          <p className="font-medium text-green-600">{shipment.revenue_base.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Cost</p>
                          <p className="font-medium text-red-600">{shipment.allocated_cost_base.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Profit</p>
                          <p className={`font-medium ${shipment.profit_base >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {shipment.profit_base.toFixed(0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Rate: {shipment.rate_sheets?.name} ({shipment.rate_sheets?.base_currency})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900">Container Costs ({costItems.length})</h4>
                <div className="space-y-2">
                  {costItems.map((cost) => (
                    <div key={cost.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{cost.description}</p>
                          <p className="text-xs text-gray-500">{cost.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-red-600">{cost.amount_in_inr.toFixed(2)} INR</p>
                          <p className="text-xs text-gray-500">
                            {cost.amount.toFixed(2)} {cost.currency}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Shipment to Container</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={newShipment.customer_id}
                    onChange={(e) => setNewShipment({ ...newShipment, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
                  <select
                    value={newShipment.agent_id}
                    onChange={(e) => setNewShipment({ ...newShipment, agent_id: e.target.value, rate_sheet_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Sheet *</label>
                  <select
                    value={newShipment.rate_sheet_id}
                    onChange={(e) => setNewShipment({ ...newShipment, rate_sheet_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!newShipment.agent_id}
                  >
                    <option value="">Select Rate Sheet</option>
                    {filteredRateSheets.map(rs => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name} ({rs.base_currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBM *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newShipment.cbm || ''}
                    onChange={(e) => setNewShipment({ ...newShipment, cbm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newShipment.weight_kg || ''}
                    onChange={(e) => setNewShipment({ ...newShipment, weight_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Count</label>
                  <input
                    type="number"
                    value={newShipment.package_count || ''}
                    onChange={(e) => setNewShipment({ ...newShipment, package_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newShipment.description}
                    onChange={(e) => setNewShipment({ ...newShipment, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>

              {newShipment.rate_sheet_id && newShipment.cbm > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">
                    Rate Sheet: {rateSheets.find(rs => rs.id === newShipment.rate_sheet_id)?.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    Currency: {rateSheets.find(rs => rs.id === newShipment.rate_sheet_id)?.base_currency}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Revenue will be calculated automatically from slab rates and converted to INR
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowAddShipment(false);
                    setNewShipment({
                      customer_id: '',
                      agent_id: '',
                      rate_sheet_id: '',
                      cbm: 0,
                      weight_kg: 0,
                      package_count: 1,
                      description: '',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addShipment}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Shipment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddCost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Container Cost</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={newCost.description}
                  onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Ocean Freight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={newCost.category}
                  onChange={(e) => setNewCost({ ...newCost, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="freight">Freight</option>
                  <option value="handling">Handling</option>
                  <option value="documentation">Documentation</option>
                  <option value="customs">Customs</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCost.amount || ''}
                    onChange={(e) => setNewCost({ ...newCost, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    value={newCost.currency}
                    onChange={(e) => setNewCost({ ...newCost, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowAddCost(false);
                    setNewCost({
                      description: '',
                      category: 'freight',
                      amount: 0,
                      currency: 'INR',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addCost}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Add Cost
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}