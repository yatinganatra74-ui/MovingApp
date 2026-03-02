import React, { useState, useEffect } from 'react';
import {
  Ship,
  Package,
  FileText,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  Download,
  Edit,
  Save,
  X,
  Anchor,
  MapPin,
  Calendar,
  Box,
  DollarSign,
  Percent,
  User,
  Mail,
  FileSpreadsheet,
  CheckSquare,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PreAlert {
  id: string;
  container_id: string | null;
  alert_date: string;
  agent_name: string;
  agent_email: string;
  bl_number: string;
  total_packages: number;
  total_cbm: number;
  total_weight_kg: number;
  commodity_description: string;
  special_instructions: string;
  bl_copy_url: string;
  packing_list_url: string;
  invoice_copy_url: string;
  status: string;
  container_number: string | null;
}

interface Container {
  id: string;
  container_number: string;
  agent_name: string;
  origin_country: string;
  eta_pod: string;
  pod_name: string;
  pod_code: string;
  container_type: string;
  estimated_total_cbm: number;
  estimated_container_cost: number;
  status: string;
  vessel_name: string;
  shipping_line: string;
  utilization_percentage: number;
  used_cbm: number;
  available_cbm: number;
  shipment_count: number;
}

interface Port {
  id: string;
  port_code: string;
  port_name: string;
  port_type: string;
  state: string;
  city: string;
}

export default function PreAlertManager() {
  const { user } = useAuth();
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreAlertForm, setShowPreAlertForm] = useState(false);
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'prealerts' | 'containers'>('prealerts');

  const [formData, setFormData] = useState({
    agent_name: '',
    agent_email: '',
    bl_number: '',
    total_packages: '',
    total_cbm: '',
    total_weight_kg: '',
    commodity_description: '',
    special_instructions: '',
    alert_date: new Date().toISOString().split('T')[0],
  });

  const [containerFormData, setContainerFormData] = useState({
    container_number: '',
    agent_name: '',
    origin_country: '',
    eta_pod: '',
    pod_code: '',
    pod_name: '',
    container_type: 'LCL',
    estimated_total_cbm: '',
    estimated_container_cost: '',
    vessel_name: '',
    voyage_number: '',
    port_of_loading: '',
    shipping_line: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: portsData, error: portsError } = await supabase
        .from('indian_ports_icds')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (portsError) throw portsError;
      setPorts(portsData || []);

      const { data: preAlertsData, error: preAlertsError } = await supabase
        .from('pre_alerts')
        .select(`
          *,
          containers(container_number)
        `)
        .order('created_at', { ascending: false });

      if (preAlertsError) throw preAlertsError;

      const formattedPreAlerts = (preAlertsData || []).map((item: any) => ({
        ...item,
        container_number: item.containers?.container_number || null,
      }));

      setPreAlerts(formattedPreAlerts);

      const { data: containersData, error: containersError } = await supabase
        .from('import_container_utilization')
        .select('*')
        .order('eta_pod', { ascending: true });

      if (containersError) throw containersError;
      setContainers(containersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createPreAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('pre_alerts').insert([
        {
          agent_name: formData.agent_name,
          agent_email: formData.agent_email,
          bl_number: formData.bl_number,
          total_packages: parseInt(formData.total_packages) || 0,
          total_cbm: parseFloat(formData.total_cbm) || 0,
          total_weight_kg: parseFloat(formData.total_weight_kg) || 0,
          commodity_description: formData.commodity_description,
          special_instructions: formData.special_instructions,
          alert_date: formData.alert_date,
          status: 'received',
          created_by: user?.id,
        },
      ]);

      if (error) throw error;

      alert('Pre-alert created successfully!');
      setShowPreAlertForm(false);
      setFormData({
        agent_name: '',
        agent_email: '',
        bl_number: '',
        total_packages: '',
        total_cbm: '',
        total_weight_kg: '',
        commodity_description: '',
        special_instructions: '',
        alert_date: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (error) {
      console.error('Error creating pre-alert:', error);
      alert('Failed to create pre-alert');
    }
  };

  const createContainer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.rpc('create_container_from_prealert', {
        p_container_number: containerFormData.container_number,
        p_agent_name: containerFormData.agent_name,
        p_origin_country: containerFormData.origin_country,
        p_eta: containerFormData.eta_pod,
        p_container_type: containerFormData.container_type,
        p_estimated_cbm: parseFloat(containerFormData.estimated_total_cbm) || 0,
        p_estimated_cost: parseFloat(containerFormData.estimated_container_cost) || 0,
        p_user_id: user?.id,
        p_pod_name: containerFormData.pod_name,
        p_pod_code: containerFormData.pod_code,
      });

      if (error) throw error;

      if (containerFormData.vessel_name || containerFormData.voyage_number ||
          containerFormData.port_of_loading || containerFormData.shipping_line ||
          containerFormData.notes) {
        const { error: updateError } = await supabase
          .from('containers')
          .update({
            vessel_name: containerFormData.vessel_name,
            voyage_number: containerFormData.voyage_number,
            port_of_loading: containerFormData.port_of_loading,
            shipping_line: containerFormData.shipping_line,
            notes: containerFormData.notes,
          })
          .eq('id', data.container_id);

        if (updateError) throw updateError;
      }

      alert('Container created successfully!');
      setShowContainerForm(false);
      setContainerFormData({
        container_number: '',
        agent_name: '',
        origin_country: '',
        eta_pod: '',
        pod_code: '',
        pod_name: '',
        container_type: 'LCL',
        estimated_total_cbm: '',
        estimated_container_cost: '',
        vessel_name: '',
        voyage_number: '',
        port_of_loading: '',
        shipping_line: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error creating container:', error);
      alert('Failed to create container');
    }
  };

  const linkPreAlertToContainer = async (preAlertId: string, containerId: string) => {
    try {
      const { error } = await supabase
        .from('pre_alerts')
        .update({ container_id: containerId })
        .eq('id', preAlertId);

      if (error) throw error;

      alert('Pre-alert linked to container successfully!');
      loadData();
    } catch (error) {
      console.error('Error linking pre-alert:', error);
      alert('Failed to link pre-alert');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      expected: 'bg-yellow-100 text-yellow-800',
      in_transit: 'bg-blue-100 text-blue-800',
      arrived: 'bg-green-100 text-green-800',
      discharged: 'bg-purple-100 text-purple-800',
      closed: 'bg-gray-100 text-gray-800',
      received: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pre-alerts and containers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Pre-Alert & Container Management</h2>
          <p className="text-gray-600 mt-1">Phase 1: Receive pre-alerts and create containers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreAlertForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Pre-Alert
          </button>
          <button
            onClick={() => setShowContainerForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            New Container
          </button>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('prealerts')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'prealerts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pre-Alerts ({preAlerts.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('containers')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'containers'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Containers ({containers.length})
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'prealerts' && (
        <div className="grid grid-cols-1 gap-4">
          {preAlerts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">No Pre-Alerts</h3>
              <p className="text-gray-500 mb-4">Create your first pre-alert to get started</p>
              <button
                onClick={() => setShowPreAlertForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Pre-Alert
              </button>
            </div>
          ) : (
            preAlerts.map((preAlert) => (
              <div key={preAlert.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        BL: {preAlert.bl_number || 'N/A'}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(preAlert.status)}`}>
                        {preAlert.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{preAlert.agent_name}</span>
                      {preAlert.agent_email && (
                        <>
                          <Mail className="w-4 h-4 ml-2" />
                          <span>{preAlert.agent_email}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Alert Date</div>
                    <div className="font-medium">
                      {new Date(preAlert.alert_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Packages</div>
                    <div className="text-2xl font-bold text-gray-900">{preAlert.total_packages}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">CBM</div>
                    <div className="text-2xl font-bold text-gray-900">{preAlert.total_cbm}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Weight (KG)</div>
                    <div className="text-2xl font-bold text-gray-900">{preAlert.total_weight_kg}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-600 mb-1">Container</div>
                    <div className="text-lg font-bold text-gray-900">
                      {preAlert.container_number || 'Not Assigned'}
                    </div>
                  </div>
                </div>

                {preAlert.commodity_description && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Commodity</div>
                    <div className="text-gray-900">{preAlert.commodity_description}</div>
                  </div>
                )}

                {preAlert.special_instructions && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Special Instructions</div>
                    <div className="text-gray-900 bg-yellow-50 p-3 rounded-lg">
                      {preAlert.special_instructions}
                    </div>
                  </div>
                )}

                {!preAlert.container_id && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to Container
                    </label>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            linkPreAlertToContainer(preAlert.id, e.target.value);
                          }
                        }}
                        className="flex-1 border rounded-lg px-3 py-2"
                        defaultValue=""
                      >
                        <option value="">Select container...</option>
                        {containers
                          .filter((c) => c.status === 'expected')
                          .map((container) => (
                            <option key={container.id} value={container.id}>
                              {container.container_number} - {container.available_cbm.toFixed(2)} CBM
                              available
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'containers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {containers.length === 0 ? (
            <div className="col-span-2 bg-white rounded-lg shadow-md p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">No Containers</h3>
              <p className="text-gray-500 mb-4">Create your first container to get started</p>
              <button
                onClick={() => setShowContainerForm(true)}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Create Container
              </button>
            </div>
          ) : (
            containers.map((container) => (
              <div
                key={container.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {container.container_number}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(container.status)}`}>
                        🟡 {container.status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {container.container_type}
                      </span>
                    </div>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${getUtilizationColor(container.utilization_percentage)}`}>
                    <div className="text-2xl font-bold">
                      {container.utilization_percentage.toFixed(0)}%
                    </div>
                    <div className="text-xs">Utilized</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Agent
                    </div>
                    <div className="font-medium text-gray-900">{container.agent_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Origin
                    </div>
                    <div className="font-medium text-gray-900">{container.origin_country || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      ETA POD
                    </div>
                    <div className="font-medium text-gray-900">
                      {container.eta_pod
                        ? new Date(container.eta_pod).toLocaleDateString()
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Anchor className="w-4 h-4" />
                      Port of Discharge
                    </div>
                    <div className="font-medium text-gray-900">{container.pod_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Ship className="w-4 h-4" />
                      Vessel
                    </div>
                    <div className="font-medium text-gray-900">{container.vessel_name || 'N/A'}</div>
                  </div>
                </div>

                <div className="border-t pt-4 mb-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Total CBM</div>
                      <div className="text-lg font-bold text-gray-900">
                        {container.estimated_total_cbm.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Used</div>
                      <div className="text-lg font-bold text-blue-600">
                        {container.used_cbm.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Available</div>
                      <div className="text-lg font-bold text-green-600">
                        {container.available_cbm.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-600">Estimated Cost</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${container.estimated_container_cost.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Shipments</div>
                      <div className="text-xl font-bold text-gray-900">{container.shipment_count}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showPreAlertForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Pre-Alert</h3>
            <form onSubmit={createPreAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.agent_name}
                    onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Email
                  </label>
                  <input
                    type="email"
                    value={formData.agent_email}
                    onChange={(e) => setFormData({ ...formData, agent_email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BL Number
                  </label>
                  <input
                    type="text"
                    value={formData.bl_number}
                    onChange={(e) => setFormData({ ...formData, bl_number: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alert Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.alert_date}
                    onChange={(e) => setFormData({ ...formData, alert_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Packages
                  </label>
                  <input
                    type="number"
                    value={formData.total_packages}
                    onChange={(e) => setFormData({ ...formData, total_packages: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total CBM
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_cbm}
                    onChange={(e) => setFormData({ ...formData, total_cbm: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Weight (KG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_weight_kg}
                    onChange={(e) => setFormData({ ...formData, total_weight_kg: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commodity Description
                  </label>
                  <textarea
                    value={formData.commodity_description}
                    onChange={(e) =>
                      setFormData({ ...formData, commodity_description: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions
                  </label>
                  <textarea
                    value={formData.special_instructions}
                    onChange={(e) =>
                      setFormData({ ...formData, special_instructions: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Pre-Alert
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreAlertForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContainerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Container</h3>
            <form onSubmit={createContainer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Container Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={containerFormData.container_number}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, container_number: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="ABCD1234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Container Type *
                  </label>
                  <select
                    required
                    value={containerFormData.container_type}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, container_type: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="LCL">LCL</option>
                    <option value="20FT">20FT</option>
                    <option value="40FT">40FT</option>
                    <option value="40HC">40HC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={containerFormData.agent_name}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, agent_name: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Origin Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={containerFormData.origin_country}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, origin_country: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Port of Discharge (POD) *
                  </label>
                  <select
                    required
                    value={containerFormData.pod_code}
                    onChange={(e) => {
                      const selectedPort = ports.find(p => p.port_code === e.target.value);
                      setContainerFormData({
                        ...containerFormData,
                        pod_code: e.target.value,
                        pod_name: selectedPort?.port_name || '',
                      });
                    }}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Port/ICD...</option>
                    <optgroup label="Major Seaports">
                      {ports
                        .filter(p => p.port_type === 'seaport' && p.display_order <= 20)
                        .map(port => (
                          <option key={port.id} value={port.port_code}>
                            {port.port_name} - {port.city}, {port.state}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Inland Container Depots (ICDs)">
                      {ports
                        .filter(p => p.port_type === 'icd')
                        .map(port => (
                          <option key={port.id} value={port.port_code}>
                            {port.port_name} - {port.city}, {port.state}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Container Freight Stations (CFS)">
                      {ports
                        .filter(p => p.port_type === 'cfs')
                        .map(port => (
                          <option key={port.id} value={port.port_code}>
                            {port.port_name} - {port.city}, {port.state}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Other Ports">
                      {ports
                        .filter(p => p.port_type === 'seaport' && p.display_order > 20)
                        .map(port => (
                          <option key={port.id} value={port.port_code}>
                            {port.port_name} - {port.city}, {port.state}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ETA POD *
                  </label>
                  <input
                    type="date"
                    required
                    value={containerFormData.eta_pod}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, eta_pod: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Total CBM *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={containerFormData.estimated_total_cbm}
                    onChange={(e) =>
                      setContainerFormData({
                        ...containerFormData,
                        estimated_total_cbm: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Container Cost (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={containerFormData.estimated_container_cost}
                    onChange={(e) =>
                      setContainerFormData({
                        ...containerFormData,
                        estimated_container_cost: e.target.value,
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vessel Name
                  </label>
                  <input
                    type="text"
                    value={containerFormData.vessel_name}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, vessel_name: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voyage Number
                  </label>
                  <input
                    type="text"
                    value={containerFormData.voyage_number}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, voyage_number: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Port of Loading
                  </label>
                  <input
                    type="text"
                    value={containerFormData.port_of_loading}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, port_of_loading: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Line
                  </label>
                  <input
                    type="text"
                    value={containerFormData.shipping_line}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, shipping_line: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={containerFormData.notes}
                    onChange={(e) =>
                      setContainerFormData({ ...containerFormData, notes: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Create Container
                </button>
                <button
                  type="button"
                  onClick={() => setShowContainerForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
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
