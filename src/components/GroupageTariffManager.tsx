import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Search, FileText, DollarSign, Calendar, Ship, CheckCircle, XCircle, Package, Container, Plane } from 'lucide-react';

interface Tariff {
  id: string;
  tariff_name: string;
  tariff_code: string;
  origin_port: string;
  destination_port: string;
  service_type: string;
  shipment_type: string;
  carrier_name: string;
  transit_time_days: number;
  currency: string;
  is_active: boolean;
  is_agent_rate: boolean;
  free_days: number;
  effective_from: string;
  effective_to: string;
  notes: string;
}

interface TariffRate {
  id?: string;
  slab_name: string;
  min_cbm: number;
  max_cbm: number | null;
  rate_per_cbm: number;
  minimum_charge: number;
  notes: string;
}

interface FCLRate {
  id?: string;
  container_type: string;
  rate_per_container: number;
  includes_baf: boolean;
  includes_caf: boolean;
  baf_amount: number;
  caf_amount: number;
  notes: string;
}

interface TariffCharge {
  id?: string;
  charge_type: string;
  charge_name: string;
  charge_amount: number;
  is_per_shipment: boolean;
  is_optional: boolean;
  notes: string;
}

interface Carrier {
  id: string;
  carrier_name: string;
  carrier_code: string;
}

export default function GroupageTariffManager() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | 'all'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [formData, setFormData] = useState({
    tariff_name: '',
    tariff_code: '',
    origin_port: '',
    destination_port: '',
    service_type: 'sea_lcl',
    shipment_type: 'LCL',
    carrier_name: '',
    transit_time_days: 0,
    currency: 'USD',
    is_active: true,
    is_agent_rate: false,
    free_days: 0,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    notes: ''
  });

  const [rates, setRates] = useState<TariffRate[]>([]);
  const [fclRates, setFclRates] = useState<FCLRate[]>([]);
  const [charges, setCharges] = useState<TariffCharge[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tariffsRes, carriersRes] = await Promise.all([
        supabase
          .from('groupage_tariffs')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('shipping_carriers')
          .select('id, carrier_name, carrier_code')
          .eq('is_active', true)
          .order('carrier_name')
      ]);

      if (tariffsRes.data) setTariffs(tariffsRes.data);
      if (carriersRes.data) setCarriers(carriersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewTariff = () => {
    setEditingTariff(null);
    setFormData({
      tariff_name: '',
      tariff_code: '',
      origin_port: '',
      destination_port: '',
      service_type: 'sea_lcl',
      shipment_type: 'LCL',
      carrier_name: '',
      transit_time_days: 0,
      currency: 'USD',
      is_active: true,
      is_agent_rate: false,
      free_days: 0,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      notes: ''
    });
    setRates([{
      slab_name: '0-1 CBM',
      min_cbm: 0,
      max_cbm: 1,
      rate_per_cbm: 0,
      minimum_charge: 0,
      notes: ''
    }]);
    setFclRates([]);
    setCharges([]);
    setShowForm(true);
  };

  const handleEditTariff = async (tariff: Tariff) => {
    setEditingTariff(tariff);
    setFormData({
      tariff_name: tariff.tariff_name,
      tariff_code: tariff.tariff_code,
      origin_port: tariff.origin_port,
      destination_port: tariff.destination_port,
      service_type: tariff.service_type,
      shipment_type: tariff.shipment_type || 'LCL',
      carrier_name: tariff.carrier_name || '',
      transit_time_days: tariff.transit_time_days,
      currency: tariff.currency,
      is_active: tariff.is_active,
      is_agent_rate: tariff.is_agent_rate || false,
      free_days: tariff.free_days || 0,
      effective_from: tariff.effective_from,
      effective_to: tariff.effective_to || '',
      notes: tariff.notes || ''
    });

    const [ratesRes, fclRatesRes, chargesRes] = await Promise.all([
      supabase
        .from('groupage_tariff_rates')
        .select('*')
        .eq('tariff_id', tariff.id)
        .order('min_cbm'),
      supabase
        .from('groupage_fcl_rates')
        .select('*')
        .eq('tariff_id', tariff.id),
      supabase
        .from('groupage_tariff_charges')
        .select('*')
        .eq('tariff_id', tariff.id)
    ]);

    if (ratesRes.data) setRates(ratesRes.data);
    if (fclRatesRes.data) setFclRates(fclRatesRes.data);
    if (chargesRes.data) setCharges(chargesRes.data);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: user } = await supabase.auth.getUser();

      let tariffId = editingTariff?.id;

      if (editingTariff) {
        const { error } = await supabase
          .from('groupage_tariffs')
          .update(formData)
          .eq('id', editingTariff.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('groupage_tariffs')
          .insert([{ ...formData, created_by: user.user?.id }])
          .select()
          .single();

        if (error) throw error;
        tariffId = data.id;
      }

      if (editingTariff) {
        await Promise.all([
          supabase.from('groupage_tariff_rates').delete().eq('tariff_id', editingTariff.id),
          supabase.from('groupage_fcl_rates').delete().eq('tariff_id', editingTariff.id),
          supabase.from('groupage_tariff_charges').delete().eq('tariff_id', editingTariff.id)
        ]);
      }

      if (formData.shipment_type === 'LCL' && rates.length > 0) {
        const ratesData = rates.map(rate => ({ tariff_id: tariffId, ...rate }));
        const { error: ratesError } = await supabase
          .from('groupage_tariff_rates')
          .insert(ratesData);
        if (ratesError) throw ratesError;
      }

      if (formData.shipment_type === 'FCL' && fclRates.length > 0) {
        const fclRatesData = fclRates.map(rate => ({ tariff_id: tariffId, currency: formData.currency, ...rate }));
        const { error: fclError } = await supabase
          .from('groupage_fcl_rates')
          .insert(fclRatesData);
        if (fclError) throw fclError;
      }

      if (charges.length > 0) {
        const chargesData = charges.map(charge => ({ tariff_id: tariffId, ...charge }));
        const { error: chargesError } = await supabase
          .from('groupage_tariff_charges')
          .insert(chargesData);
        if (chargesError) throw chargesError;
      }

      alert('Tariff saved successfully!');
      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving tariff:', error);
      alert(error.message || 'Failed to save tariff');
    }
  };

  const handleDeleteTariff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tariff?')) return;

    try {
      const { error } = await supabase
        .from('groupage_tariffs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Tariff deleted successfully!');
      loadData();
    } catch (error: any) {
      console.error('Error deleting tariff:', error);
      alert(error.message || 'Failed to delete tariff');
    }
  };

  const addRate = () => {
    const lastRate = rates[rates.length - 1];
    const newMinCbm = lastRate?.max_cbm || 0;
    setRates([...rates, {
      slab_name: `${newMinCbm}-${newMinCbm + 5} CBM`,
      min_cbm: newMinCbm,
      max_cbm: newMinCbm + 5,
      rate_per_cbm: 0,
      minimum_charge: 0,
      notes: ''
    }]);
  };

  const removeRate = (index: number) => {
    setRates(rates.filter((_, i) => i !== index));
  };

  const addFCLRate = () => {
    setFclRates([...fclRates, {
      container_type: '20FT',
      rate_per_container: 0,
      includes_baf: false,
      includes_caf: false,
      baf_amount: 0,
      caf_amount: 0,
      notes: ''
    }]);
  };

  const removeFCLRate = (index: number) => {
    setFclRates(fclRates.filter((_, i) => i !== index));
  };

  const addCharge = () => {
    setCharges([...charges, {
      charge_type: 'documentation',
      charge_name: '',
      charge_amount: 0,
      is_per_shipment: true,
      is_optional: false,
      notes: ''
    }]);
  };

  const removeCharge = (index: number) => {
    setCharges(charges.filter((_, i) => i !== index));
  };

  const filteredTariffs = tariffs.filter(tariff => {
    const matchesSearch = searchTerm === '' ||
      tariff.tariff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.tariff_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.origin_port.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.destination_port.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tariff.carrier_name && tariff.carrier_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesActive = filterActive === 'all' || tariff.is_active === filterActive;
    const matchesType = filterType === 'all' || tariff.shipment_type === filterType;

    return matchesSearch && matchesActive && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FCL': return <Container className="h-4 w-4" />;
      case 'AIR': return <Plane className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading tariffs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shipping Tariff Management</h2>
          <p className="text-gray-600">Manage LCL, FCL, and Agent rates for all routes</p>
        </div>
        <button
          onClick={handleNewTariff}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Tariff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Total Tariffs</p>
          <p className="text-2xl font-bold text-blue-600">{tariffs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">LCL Rates</p>
          <p className="text-2xl font-bold text-green-600">
            {tariffs.filter(t => t.shipment_type === 'LCL').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">FCL Rates</p>
          <p className="text-2xl font-bold text-purple-600">
            {tariffs.filter(t => t.shipment_type === 'FCL').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Agent Rates</p>
          <p className="text-2xl font-bold text-orange-600">
            {tariffs.filter(t => t.is_agent_rate).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {tariffs.filter(t => t.is_active).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search tariffs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Types</option>
            <option value="LCL">LCL</option>
            <option value="FCL">FCL</option>
            <option value="AIR">AIR</option>
          </select>
          <select
            value={filterActive === 'all' ? 'all' : filterActive.toString()}
            onChange={(e) => setFilterActive(e.target.value === 'all' ? 'all' : e.target.value === 'true')}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Carrier</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Transit</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Currency</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTariffs.map((tariff) => (
                <tr key={tariff.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(tariff.shipment_type)}
                      <div>
                        <span className="text-sm font-medium">{tariff.shipment_type}</span>
                        {tariff.is_agent_rate && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                            Agent
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium">{tariff.tariff_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-900">{tariff.tariff_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <Ship className="h-3 w-3 text-gray-400" />
                      <span>{tariff.origin_port} → {tariff.destination_port}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{tariff.carrier_name || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{tariff.transit_time_days} days</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium">{tariff.currency}</span>
                  </td>
                  <td className="px-4 py-3">
                    {tariff.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTariff(tariff)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTariff(tariff.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTariffs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No tariffs found</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingTariff ? 'Edit Tariff' : 'New Shipping Tariff'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tariff Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tariff_name}
                    onChange={(e) => setFormData({ ...formData, tariff_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tariff Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tariff_code}
                    onChange={(e) => setFormData({ ...formData, tariff_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., SHTO-DXB-LCL-2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shipment Type *
                  </label>
                  <select
                    required
                    value={formData.shipment_type}
                    onChange={(e) => setFormData({ ...formData, shipment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="LCL">LCL (Less than Container Load)</option>
                    <option value="FCL">FCL (Full Container Load)</option>
                    <option value="AIR">AIR Freight</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origin Port *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.origin_port}
                    onChange={(e) => setFormData({ ...formData, origin_port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Shanghai, China"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination Port *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination_port}
                    onChange={(e) => setFormData({ ...formData, destination_port: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Dubai, UAE"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrier
                  </label>
                  <select
                    value={formData.carrier_name}
                    onChange={(e) => setFormData({ ...formData, carrier_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Carrier</option>
                    {carriers.map(carrier => (
                      <option key={carrier.id} value={carrier.carrier_name}>
                        {carrier.carrier_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transit Time (days)
                  </label>
                  <input
                    type="number"
                    value={formData.transit_time_days}
                    onChange={(e) => setFormData({ ...formData, transit_time_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Free Days
                  </label>
                  <input
                    type="number"
                    value={formData.free_days}
                    onChange={(e) => setFormData({ ...formData, free_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={formData.effective_to}
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Tariff</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_agent_rate}
                    onChange={(e) => setFormData({ ...formData, is_agent_rate: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Agent Rate (Buying Price)</span>
                </label>
              </div>

              {formData.shipment_type === 'LCL' && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-900">CBM Rate Slabs</h4>
                    <button
                      type="button"
                      onClick={addRate}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Slab
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rates.map((rate, index) => (
                      <div key={index} className="grid grid-cols-6 gap-2 items-start p-3 bg-gray-50 rounded">
                        <input
                          type="text"
                          placeholder="Slab name"
                          value={rate.slab_name}
                          onChange={(e) => {
                            const newRates = [...rates];
                            newRates[index].slab_name = e.target.value;
                            setRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min CBM"
                          value={rate.min_cbm}
                          onChange={(e) => {
                            const newRates = [...rates];
                            newRates[index].min_cbm = parseFloat(e.target.value) || 0;
                            setRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Max CBM"
                          value={rate.max_cbm || ''}
                          onChange={(e) => {
                            const newRates = [...rates];
                            newRates[index].max_cbm = e.target.value ? parseFloat(e.target.value) : null;
                            setRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate/CBM"
                          value={rate.rate_per_cbm}
                          onChange={(e) => {
                            const newRates = [...rates];
                            newRates[index].rate_per_cbm = parseFloat(e.target.value) || 0;
                            setRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min charge"
                          value={rate.minimum_charge}
                          onChange={(e) => {
                            const newRates = [...rates];
                            newRates[index].minimum_charge = parseFloat(e.target.value) || 0;
                            setRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeRate(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.shipment_type === 'FCL' && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-gray-900">FCL Container Rates</h4>
                    <button
                      type="button"
                      onClick={addFCLRate}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Container
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fclRates.map((rate, index) => (
                      <div key={index} className="grid grid-cols-7 gap-2 items-start p-3 bg-gray-50 rounded">
                        <select
                          value={rate.container_type}
                          onChange={(e) => {
                            const newRates = [...fclRates];
                            newRates[index].container_type = e.target.value;
                            setFclRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="20FT">20FT</option>
                          <option value="40FT">40FT</option>
                          <option value="40HC">40HC</option>
                          <option value="45HC">45HC</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          value={rate.rate_per_container}
                          onChange={(e) => {
                            const newRates = [...fclRates];
                            newRates[index].rate_per_container = parseFloat(e.target.value) || 0;
                            setFclRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="BAF"
                          value={rate.baf_amount}
                          onChange={(e) => {
                            const newRates = [...fclRates];
                            newRates[index].baf_amount = parseFloat(e.target.value) || 0;
                            setFclRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="CAF"
                          value={rate.caf_amount}
                          onChange={(e) => {
                            const newRates = [...fclRates];
                            newRates[index].caf_amount = parseFloat(e.target.value) || 0;
                            setFclRates(newRates);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs col-span-2">
                          <input
                            type="checkbox"
                            checked={rate.includes_baf}
                            onChange={(e) => {
                              const newRates = [...fclRates];
                              newRates[index].includes_baf = e.target.checked;
                              setFclRates(newRates);
                            }}
                            className="rounded"
                          />
                          Incl. BAF
                          <input
                            type="checkbox"
                            checked={rate.includes_caf}
                            onChange={(e) => {
                              const newRates = [...fclRates];
                              newRates[index].includes_caf = e.target.checked;
                              setFclRates(newRates);
                            }}
                            className="rounded ml-2"
                          />
                          Incl. CAF
                        </label>
                        <button
                          type="button"
                          onClick={() => removeFCLRate(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">Additional Charges</h4>
                  <button
                    type="button"
                    onClick={addCharge}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Charge
                  </button>
                </div>

                <div className="space-y-2">
                  {charges.map((charge, index) => (
                    <div key={index} className="grid grid-cols-6 gap-2 items-start p-3 bg-gray-50 rounded">
                      <select
                        value={charge.charge_type}
                        onChange={(e) => {
                          const newCharges = [...charges];
                          newCharges[index].charge_type = e.target.value;
                          setCharges(newCharges);
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="documentation">Documentation</option>
                        <option value="handling">Handling</option>
                        <option value="customs">Customs</option>
                        <option value="delivery">Delivery</option>
                        <option value="insurance">Insurance</option>
                        <option value="thc">THC</option>
                        <option value="isps">ISPS</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Charge name"
                        value={charge.charge_name}
                        onChange={(e) => {
                          const newCharges = [...charges];
                          newCharges[index].charge_name = e.target.value;
                          setCharges(newCharges);
                        }}
                        className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={charge.charge_amount}
                        onChange={(e) => {
                          const newCharges = [...charges];
                          newCharges[index].charge_amount = parseFloat(e.target.value) || 0;
                          setCharges(newCharges);
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={charge.is_per_shipment}
                          onChange={(e) => {
                            const newCharges = [...charges];
                            newCharges[index].is_per_shipment = e.target.checked;
                            setCharges(newCharges);
                          }}
                          className="rounded"
                        />
                        Per shipment
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCharge(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Any special conditions, validity notes, or additional information..."
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTariff ? 'Update Tariff' : 'Create Tariff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
