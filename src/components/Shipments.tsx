import React, { useState, useEffect } from 'react';
import { Ship, Plus, DollarSign, TrendingUp, TrendingDown, Calendar, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Shipment {
  id: string;
  shipment_number: string;
  agent_id: string;
  locked_rate_sheet_id: string;
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  service_type: string;
  status: string;
  booking_date: string;
  etd: string | null;
  eta: string | null;
  total_cbm: number;
  locked_exchange_rate: number;
  total_revenue_base: number;
  total_cost_base: number;
  profit_base: number;
  profit_margin_percent: number;
}

interface RateSheet {
  id: string;
  name: string;
  base_currency: string;
  agent_id: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
}

interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

export default function Shipments() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('INR');

  const [newShipment, setNewShipment] = useState({
    agent_id: '',
    locked_rate_sheet_id: '',
    origin_country: '',
    origin_port: '',
    destination_country: '',
    destination_port: '',
    service_type: 'FCL',
    booking_date: new Date().toISOString().split('T')[0],
    etd: '',
    eta: '',
    total_cbm: 0,
  });

  const [revenue, setRevenue] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedShipment) {
      loadShipmentFinancials(selectedShipment);
    }
  }, [selectedShipment]);

  const loadData = async () => {
    const [shipmentsRes, agentsRes, rateSheetsRes, ratesRes, configRes] = await Promise.all([
      supabase.from('shipments').select('*').order('booking_date', { ascending: false }),
      supabase.from('agents').select('*').eq('is_active', true).order('name'),
      supabase.from('rate_sheets').select('*').eq('is_active', true).order('name'),
      supabase.from('exchange_rates').select('*').order('effective_date', { ascending: false }),
      supabase.from('system_config').select('*').eq('config_key', 'base_currency').single(),
    ]);

    if (shipmentsRes.data) setShipments(shipmentsRes.data);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (rateSheetsRes.data) setRateSheets(rateSheetsRes.data);
    if (ratesRes.data) setExchangeRates(ratesRes.data);
    if (configRes.data) setBaseCurrency(configRes.data.config_value);
  };

  const loadShipmentFinancials = async (shipmentId: string) => {
    const [revenueRes, costsRes] = await Promise.all([
      supabase.from('shipment_revenue').select('*').eq('shipment_id', shipmentId),
      supabase.from('shipment_costs').select('*, agents(name)').eq('shipment_id', shipmentId),
    ]);

    if (revenueRes.data) setRevenue(revenueRes.data);
    if (costsRes.data) setCosts(costsRes.data);
  };

  const getExchangeRate = (fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return 1;

    const rate = exchangeRates.find(
      r => r.from_currency === fromCurrency && r.to_currency === toCurrency
    );

    return rate ? rate.rate : 1;
  };

  const createShipment = async () => {
    if (!newShipment.agent_id || !newShipment.locked_rate_sheet_id || newShipment.total_cbm <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    const selectedRateSheet = rateSheets.find(rs => rs.id === newShipment.locked_rate_sheet_id);
    if (!selectedRateSheet) {
      alert('Invalid rate sheet selected');
      return;
    }

    const exchangeRate = getExchangeRate(selectedRateSheet.base_currency, baseCurrency);

    const shipmentNumber = `SHP${Date.now().toString().slice(-8)}`;

    const { data: shipmentData, error: shipmentError } = await supabase
      .from('shipments')
      .insert([{
        ...newShipment,
        shipment_number: shipmentNumber,
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
      p_rate_sheet_id: newShipment.locked_rate_sheet_id,
      p_cbm: newShipment.total_cbm,
      p_exchange_rate: exchangeRate,
    });

    if (slabError) {
      console.error('Error calculating revenue:', slabError);
    } else if (slabRevenue && slabRevenue.length > 0) {
      const revenueItems = slabRevenue.map((item: any) => ({
        shipment_id: shipmentData.id,
        description: item.description,
        category: item.charge_type,
        amount: item.amount_foreign,
        currency: item.currency,
        exchange_rate: item.exchange_rate,
        amount_in_base_currency: item.amount_base,
      }));

      await supabase.from('shipment_revenue').insert(revenueItems);
    }

    setShipments([shipmentData, ...shipments]);
    setShowNewShipment(false);
    setNewShipment({
      agent_id: '',
      locked_rate_sheet_id: '',
      origin_country: '',
      origin_port: '',
      destination_country: '',
      destination_port: '',
      service_type: 'FCL',
      booking_date: new Date().toISOString().split('T')[0],
      etd: '',
      eta: '',
      total_cbm: 0,
    });
    setSelectedShipment(shipmentData.id);
  };

  const addCost = async (shipmentId: string, costData: any) => {
    const selectedRateSheet = rateSheets.find(rs =>
      rs.id === shipments.find(s => s.id === shipmentId)?.locked_rate_sheet_id
    );

    const exchangeRate = getExchangeRate(costData.currency, baseCurrency);
    const amountInBase = costData.amount * exchangeRate;

    const { error } = await supabase.from('shipment_costs').insert([{
      shipment_id: shipmentId,
      ...costData,
      exchange_rate: exchangeRate,
      amount_in_base_currency: amountInBase,
    }]);

    if (error) {
      console.error('Error adding cost:', error);
      alert('Failed to add cost');
      return;
    }

    loadShipmentFinancials(shipmentId);
    loadData();
  };

  const filteredRateSheets = rateSheets.filter(rs => rs.agent_id === newShipment.agent_id);

  const totalProfit = shipments.reduce((sum, s) => sum + (s.profit_base || 0), 0);
  const totalRevenue = shipments.reduce((sum, s) => sum + (s.total_revenue_base || 0), 0);
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Shipment Management</h2>
        <button
          onClick={() => setShowNewShipment(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Shipment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{shipments.length}</p>
            </div>
            <Ship className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalRevenue.toFixed(2)} {baseCurrency}
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
                {totalProfit.toFixed(2)} {baseCurrency}
              </p>
            </div>
            {totalProfit >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-500" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Margin</p>
              <p className={`text-2xl font-bold ${averageMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {averageMargin.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CBM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr
                  key={shipment.id}
                  onClick={() => setSelectedShipment(shipment.id)}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selectedShipment === shipment.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{shipment.shipment_number}</div>
                    <div className="text-xs text-gray-500">{new Date(shipment.booking_date).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-900">{shipment.origin_port} → {shipment.destination_port}</div>
                    <div className="text-xs text-gray-500">{shipment.service_type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{shipment.total_cbm}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      shipment.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      shipment.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                      shipment.status === 'customs' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {shipment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {shipment.total_revenue_base.toFixed(2)} {baseCurrency}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600">
                    {shipment.total_cost_base.toFixed(2)} {baseCurrency}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold">
                    <span className={shipment.profit_base >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {shipment.profit_base.toFixed(2)} {baseCurrency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={shipment.profit_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {shipment.profit_margin_percent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedShipment && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Breakdown</h3>
            <div className="space-y-2">
              {revenue.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    <p className="text-xs text-gray-500">
                      {item.amount.toFixed(2)} {item.currency} × {item.exchange_rate.toFixed(4)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">
                    {item.amount_in_base_currency.toFixed(2)} {baseCurrency}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cost Breakdown</h3>
            <div className="space-y-2">
              {costs.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    <p className="text-xs text-gray-500">
                      {item.amount.toFixed(2)} {item.currency} × {item.exchange_rate.toFixed(4)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600">
                    {item.amount_in_base_currency.toFixed(2)} {baseCurrency}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNewShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Shipment</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
                  <select
                    value={newShipment.agent_id}
                    onChange={(e) => setNewShipment({ ...newShipment, agent_id: e.target.value, locked_rate_sheet_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Sheet *</label>
                  <select
                    value={newShipment.locked_rate_sheet_id}
                    onChange={(e) => setNewShipment({ ...newShipment, locked_rate_sheet_id: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin Port *</label>
                  <input
                    type="text"
                    value={newShipment.origin_port}
                    onChange={(e) => setNewShipment({ ...newShipment, origin_port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination Port *</label>
                  <input
                    type="text"
                    value={newShipment.destination_port}
                    onChange={(e) => setNewShipment({ ...newShipment, destination_port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total CBM *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newShipment.total_cbm || ''}
                    onChange={(e) => setNewShipment({ ...newShipment, total_cbm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                  <select
                    value={newShipment.service_type}
                    onChange={(e) => setNewShipment({ ...newShipment, service_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FCL">FCL</option>
                    <option value="LCL">LCL</option>
                    <option value="Air">Air</option>
                    <option value="Road">Road</option>
                  </select>
                </div>
              </div>

              {newShipment.locked_rate_sheet_id && newShipment.total_cbm > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">
                    Rate Sheet: {rateSheets.find(rs => rs.id === newShipment.locked_rate_sheet_id)?.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    Currency: {rateSheets.find(rs => rs.id === newShipment.locked_rate_sheet_id)?.base_currency}
                  </p>
                  <p className="text-sm text-blue-700">
                    Exchange Rate to {baseCurrency}: {getExchangeRate(
                      rateSheets.find(rs => rs.id === newShipment.locked_rate_sheet_id)?.base_currency || 'USD',
                      baseCurrency
                    ).toFixed(4)}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Revenue will be calculated automatically based on slab rates
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowNewShipment(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createShipment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Shipment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}