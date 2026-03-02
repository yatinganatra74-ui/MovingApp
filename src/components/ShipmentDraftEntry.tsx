import React, { useState, useEffect } from 'react';
import {
  Package,
  User,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  Save,
  CheckCircle,
  X,
  Plus,
  Edit,
  Trash2,
  Lock,
  Box,
  Weight,
  Layers,
  Calendar,
  Ship,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CheckpointValidator from './CheckpointValidator';
import TransportModeSelector from './TransportModeSelector';
import LocationPicker from './LocationPicker';

interface ShipmentDraft {
  id: string;
  draft_number: string;
  container_id: string;
  container_number: string;
  client_id: string;
  client_name: string;
  client_email: string;
  cbm: number;
  weight_kg: number;
  packages: number;
  delivery_city: string;
  delivery_state: string;
  rate_sheet_id: string;
  rate_sheet_name: string;
  applied_slab_rate: number;
  applied_slab_name: string;
  calculated_revenue_inr: number;
  calculated_revenue_usd: number;
  exchange_rate_inr_usd: number;
  commodity_description: string;
  status: string;
  status_icon: string;
  created_at: string;
}

interface Container {
  id: string;
  container_number: string;
  agent_name: string;
  origin_country: string;
  eta_pod: string;
  pod_name: string;
  estimated_total_cbm: number;
  available_cbm: number;
  used_cbm: number;
  utilization_percentage: number;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface RateSheet {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export default function ShipmentDraftEntry() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<ShipmentDraft[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [exchangeRate, setExchangeRate] = useState(83.0);
  const [showCheckpoints, setShowCheckpoints] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    transport_mode: 'SEA' as 'SEA' | 'AIR',
    container_id: '',
    client_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    cbm: '',
    weight_kg: '',
    gross_weight_kg: '',
    packages: '1',
    delivery_city: '',
    delivery_state: '',
    delivery_pincode: '',
    rate_sheet_id: '',
    commodity_description: '',
    special_instructions: '',
    origin_location_id: '',
    destination_location_id: '',
  });

  const [calculatedRevenue, setCalculatedRevenue] = useState({
    rate_per_cbm: 0,
    rate_per_kg: 0,
    slab_name: '',
    revenue_inr: 0,
    revenue_usd: 0,
    chargeable_weight_kg: 0,
    volumetric_weight_kg: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.transport_mode === 'SEA' && formData.rate_sheet_id && formData.cbm) {
      calculateRevenue();
    } else if (formData.transport_mode === 'AIR' && formData.rate_sheet_id && formData.gross_weight_kg) {
      calculateRevenue();
    }
  }, [formData.rate_sheet_id, formData.cbm, formData.gross_weight_kg, formData.delivery_city, formData.transport_mode]);

  useEffect(() => {
    if (formData.container_id) {
      const container = containers.find(c => c.id === formData.container_id);
      setSelectedContainer(container || null);
    }
  }, [formData.container_id, containers]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [draftsRes, containersRes, customersRes, rateSheetsRes, exchangeRateRes] = await Promise.all([
        supabase.from('shipment_draft_summary').select('*').order('created_at', { ascending: false }),
        supabase.from('import_container_utilization').select('*').eq('status', 'expected').order('eta_pod'),
        supabase.from('customers').select('id, name, email, phone').eq('status', 'active'),
        supabase.from('rate_sheets').select('id, name, type, currency').eq('is_active', true),
        supabase.rpc('get_current_exchange_rate', { p_from_currency: 'INR', p_to_currency: 'USD' }),
      ]);

      if (draftsRes.error) throw draftsRes.error;
      if (containersRes.error) throw containersRes.error;
      if (customersRes.error) throw customersRes.error;
      if (rateSheetsRes.error) throw rateSheetsRes.error;

      setDrafts(draftsRes.data || []);
      setContainers(containersRes.data || []);
      setCustomers(customersRes.data || []);
      setRateSheets(rateSheetsRes.data || []);
      setExchangeRate(exchangeRateRes.data || 83.0);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateRevenue = async () => {
    if (!formData.rate_sheet_id) return;

    if (formData.transport_mode === 'SEA' && !formData.cbm) return;
    if (formData.transport_mode === 'AIR' && !formData.gross_weight_kg) return;

    try {
      if (formData.transport_mode === 'SEA') {
        const { data, error } = await supabase.rpc('calculate_slab_revenue', {
          p_rate_sheet_id: formData.rate_sheet_id,
          p_cbm: parseFloat(formData.cbm),
          p_delivery_city: formData.delivery_city || null,
        });

        if (error) throw error;

        if (data && data.success) {
          const revenueInr = data.calculated_revenue;
          const revenueUsd = revenueInr * exchangeRate;

          setCalculatedRevenue({
            rate_per_cbm: data.rate_per_cbm,
            rate_per_kg: 0,
            slab_name: data.slab_name,
            revenue_inr: revenueInr,
            revenue_usd: revenueUsd,
            chargeable_weight_kg: 0,
            volumetric_weight_kg: 0,
          });
        }
      } else if (formData.transport_mode === 'AIR') {
        const grossWeight = parseFloat(formData.gross_weight_kg);
        const cbm = formData.cbm ? parseFloat(formData.cbm) : 0;
        const volumetricWeight = cbm * 167;
        const chargeableWeight = Math.max(grossWeight, volumetricWeight);

        const { data, error } = await supabase.rpc('calculate_air_freight_revenue', {
          p_rate_sheet_id: formData.rate_sheet_id,
          p_chargeable_weight_kg: chargeableWeight,
          p_exchange_rate: exchangeRate,
        });

        if (error) throw error;

        if (data && data.success) {
          setCalculatedRevenue({
            rate_per_cbm: 0,
            rate_per_kg: data.rate_per_kg,
            slab_name: data.slab_description || 'AIR Freight',
            revenue_inr: data.freight_amount_inr,
            revenue_usd: data.freight_amount,
            chargeable_weight_kg: chargeableWeight,
            volumetric_weight_kg: volumetricWeight,
          });
        }
      }
    } catch (error) {
      console.error('Error calculating revenue:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedContainer && parseFloat(formData.cbm) > selectedContainer.available_cbm) {
      alert(`Insufficient space! Available: ${selectedContainer.available_cbm} CBM`);
      return;
    }

    try {
      const rateSheet = rateSheets.find(r => r.id === formData.rate_sheet_id);

      const draftData = {
        transport_mode: formData.transport_mode,
        container_id: formData.container_id || null,
        client_id: formData.client_id || null,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        cbm: formData.cbm ? parseFloat(formData.cbm) : null,
        weight_kg: parseFloat(formData.weight_kg) || 0,
        gross_weight_kg: formData.gross_weight_kg ? parseFloat(formData.gross_weight_kg) : null,
        chargeable_weight_kg: calculatedRevenue.chargeable_weight_kg || null,
        volumetric_weight_kg: calculatedRevenue.volumetric_weight_kg || null,
        packages: parseInt(formData.packages) || 1,
        delivery_city: formData.delivery_city,
        delivery_state: formData.delivery_state,
        delivery_pincode: formData.delivery_pincode,
        origin_location_id: formData.origin_location_id || null,
        destination_location_id: formData.destination_location_id || null,
        rate_sheet_id: formData.rate_sheet_id,
        rate_sheet_name: rateSheet?.name || '',
        applied_slab_rate: formData.transport_mode === 'SEA' ? calculatedRevenue.rate_per_cbm : calculatedRevenue.rate_per_kg,
        applied_slab_name: calculatedRevenue.slab_name,
        calculated_revenue_inr: calculatedRevenue.revenue_inr,
        calculated_revenue_usd: calculatedRevenue.revenue_usd,
        exchange_rate_inr_usd: exchangeRate,
        exchange_rate_locked_at: new Date().toISOString(),
        commodity_description: formData.commodity_description,
        special_instructions: formData.special_instructions,
        status: 'draft',
        created_by: user?.id,
      };

      if (editingDraft) {
        const { error } = await supabase
          .from('shipment_drafts')
          .update(draftData)
          .eq('id', editingDraft);

        if (error) throw error;
        alert('Draft updated successfully!');
      } else {
        const { error } = await supabase.from('shipment_drafts').insert([draftData]);

        if (error) throw error;
        alert('Draft created successfully!');
      }

      setShowForm(false);
      setEditingDraft(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    }
  };

  const confirmDraft = async (draftId: string) => {
    if (!confirm('Confirm this draft? It cannot be modified after confirmation.')) return;

    try {
      const { error } = await supabase
        .from('shipment_drafts')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
        })
        .eq('id', draftId);

      if (error) throw error;

      alert('Draft confirmed successfully!');
      loadData();
    } catch (error) {
      console.error('Error confirming draft:', error);
      alert('Failed to confirm draft');
    }
  };

  const deleteDraft = async (draftId: string) => {
    if (!confirm('Delete this draft?')) return;

    try {
      const { error } = await supabase.from('shipment_drafts').delete().eq('id', draftId);

      if (error) throw error;

      alert('Draft deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert('Failed to delete draft');
    }
  };

  const resetForm = () => {
    setFormData({
      transport_mode: 'SEA',
      container_id: '',
      client_id: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      cbm: '',
      weight_kg: '',
      gross_weight_kg: '',
      packages: '1',
      delivery_city: '',
      delivery_state: '',
      delivery_pincode: '',
      rate_sheet_id: '',
      commodity_description: '',
      special_instructions: '',
      origin_location_id: '',
      destination_location_id: '',
    });
    setCalculatedRevenue({
      rate_per_cbm: 0,
      rate_per_kg: 0,
      slab_name: '',
      revenue_inr: 0,
      revenue_usd: 0,
      chargeable_weight_kg: 0,
      volumetric_weight_kg: 0,
    });
    setSelectedContainer(null);
  };

  const handleClientChange = (clientId: string) => {
    const client = customers.find(c => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: client.name,
        client_email: client.email || '',
        client_phone: client.phone || '',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipment Draft Entry</h1>
          <p className="text-gray-600 mt-1">Create and manage shipment drafts within containers</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingDraft(null);
            resetForm();
          }}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Draft
        </button>
      </div>

      <div className="grid gap-4">
        {drafts.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Drafts Yet</h3>
            <p className="text-gray-600 mb-4">Create your first shipment draft</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Draft
            </button>
          </div>
        ) : (
          drafts.map((draft) => (
            <div key={draft.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{draft.status_icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900">{draft.draft_number}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          draft.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : draft.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {draft.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Ship className="w-4 h-4" />
                        {draft.container_number}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {draft.client_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {draft.delivery_city}
                      </div>
                    </div>
                  </div>
                </div>
                {draft.status === 'draft' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmDraft(draft.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                      title="Confirm Draft"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Box className="w-4 h-4" />
                    CBM
                  </div>
                  <div className="text-lg font-bold text-gray-900">{draft.cbm.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Weight className="w-4 h-4" />
                    Weight (KG)
                  </div>
                  <div className="text-lg font-bold text-gray-900">{draft.weight_kg.toFixed(0)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Layers className="w-4 h-4" />
                    Packages
                  </div>
                  <div className="text-lg font-bold text-gray-900">{draft.packages}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm text-blue-600 mb-1 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Revenue (INR)
                  </div>
                  <div className="text-lg font-bold text-blue-700">
                    ₹{draft.calculated_revenue_inr.toLocaleString()}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    Revenue (USD)
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    ${draft.calculated_revenue_usd.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 border-t pt-3">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Rate Sheet:</span> {draft.rate_sheet_name}
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Slab:</span> {draft.applied_slab_name}
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-4 h-4" />
                  <span className="font-medium">FX Rate:</span> {draft.exchange_rate_inr_usd?.toFixed(4)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Create Shipment Draft</h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <TransportModeSelector
                value={formData.transport_mode}
                onChange={(mode) => setFormData({ ...formData, transport_mode: mode })}
                disabled={!!editingDraft}
              />

              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Exchange Rate Locked</span>
                </div>
                <p className="text-sm text-blue-700">
                  Current Rate: 1 USD = ₹{exchangeRate.toFixed(2)} INR (Locked at draft creation)
                </p>
              </div>

              {formData.transport_mode === 'SEA' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Container *</label>
                <select
                  required
                  value={formData.container_id}
                  onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select Container...</option>
                  {containers.map((container) => (
                    <option key={container.id} value={container.id}>
                      {container.container_number} - Available: {container.available_cbm.toFixed(2)} CBM (
                      {container.utilization_percentage.toFixed(1)}% used)
                    </option>
                  ))}
                </select>
                {selectedContainer && (
                  <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span>POD: {selectedContainer.pod_name}</span>
                      <span>
                        ETA: {selectedContainer.eta_pod ? new Date(selectedContainer.eta_pod).toLocaleDateString() : 'N/A'}
                      </span>
                      <span>Used: {selectedContainer.used_cbm.toFixed(2)} / {selectedContainer.estimated_total_cbm.toFixed(2)} CBM</span>
                    </div>
                  </div>
                )}
                </div>
              )}

              {formData.transport_mode === 'AIR' && (
                <div className="grid grid-cols-2 gap-4">
                  <LocationPicker
                    transportMode="AIR"
                    value={formData.origin_location_id}
                    onChange={(id) => setFormData({ ...formData, origin_location_id: id })}
                    label="Origin Airport *"
                  />
                  <LocationPicker
                    transportMode="AIR"
                    value={formData.destination_location_id}
                    onChange={(id) => setFormData({ ...formData, destination_location_id: id })}
                    label="Destination Airport *"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Existing Client (Optional)
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select or enter new client...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Email</label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Phone</label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {formData.transport_mode === 'SEA' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CBM *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cbm}
                      onChange={(e) => setFormData({ ...formData, cbm: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.weight_kg}
                      onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packages *</label>
                    <input
                      type="number"
                      required
                      value={formData.packages}
                      onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gross Weight (KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.gross_weight_kg}
                      onChange={(e) => setFormData({ ...formData, gross_weight_kg: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CBM (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cbm}
                      onChange={(e) => setFormData({ ...formData, cbm: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="For volumetric weight"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Packages *</label>
                    <input
                      type="number"
                      required
                      value={formData.packages}
                      onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {formData.transport_mode === 'AIR' && calculatedRevenue.chargeable_weight_kg > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Air Freight Weight Calculation</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-blue-700">Gross Weight</div>
                      <div className="font-bold text-blue-900">{formData.gross_weight_kg} kg</div>
                    </div>
                    <div>
                      <div className="text-blue-700">Volumetric Weight</div>
                      <div className="font-bold text-blue-900">{calculatedRevenue.volumetric_weight_kg.toFixed(2)} kg</div>
                      {formData.cbm && <div className="text-xs text-blue-600">({formData.cbm} CBM × 167)</div>}
                    </div>
                    <div>
                      <div className="text-blue-700">Chargeable Weight</div>
                      <div className="font-bold text-blue-900">{calculatedRevenue.chargeable_weight_kg.toFixed(2)} kg</div>
                      <div className="text-xs text-blue-600">(Higher of the two)</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery City *</label>
                  <input
                    type="text"
                    required
                    value={formData.delivery_city}
                    onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery State</label>
                  <input
                    type="text"
                    value={formData.delivery_state}
                    onChange={(e) => setFormData({ ...formData, delivery_state: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    value={formData.delivery_pincode}
                    onChange={(e) => setFormData({ ...formData, delivery_pincode: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rate Sheet *</label>
                <select
                  required
                  value={formData.rate_sheet_id}
                  onChange={(e) => setFormData({ ...formData, rate_sheet_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select Rate Sheet...</option>
                  {rateSheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name} ({sheet.currency})
                    </option>
                  ))}
                </select>
              </div>

              {calculatedRevenue.revenue_inr > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Auto-Calculated Revenue ({formData.transport_mode})
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-green-700">Applied Slab</div>
                      <div className="font-bold text-green-900">{calculatedRevenue.slab_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">
                        {formData.transport_mode === 'SEA' ? 'Rate per CBM' : 'Rate per KG'}
                      </div>
                      <div className="font-bold text-green-900">
                        ₹{(formData.transport_mode === 'SEA' ? calculatedRevenue.rate_per_cbm : calculatedRevenue.rate_per_kg).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Total Revenue</div>
                      <div className="font-bold text-green-900">
                        ₹{calculatedRevenue.revenue_inr.toLocaleString()} (${calculatedRevenue.revenue_usd.toFixed(2)})
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commodity Description
                </label>
                <textarea
                  value={formData.commodity_description}
                  onChange={(e) => setFormData({ ...formData, commodity_description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
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
