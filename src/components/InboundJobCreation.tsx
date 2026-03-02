import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Ship, Plus, Search, Package, Calendar, MapPin, User, FileText, CheckCircle } from 'lucide-react';

interface InboundShipment {
  id: string;
  shipment_number: string;
  agent_id: string;
  agent_name?: string;
  shipper_name: string;
  consignee_name: string;
  port_of_loading: string;
  port_of_discharge: string;
  eta: string;
  ata: string;
  total_packages: number;
  total_gross_weight_kg: number;
  total_volume_cbm: number;
  shipment_type: string;
  pre_alert_received: boolean;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  country: string;
}

interface Customer {
  id: string;
  name: string;
  company_name: string;
}

export default function InboundJobCreation() {
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<InboundShipment | null>(null);

  const [jobFormData, setJobFormData] = useState({
    customer_id: '',
    job_type: 'import',
    service_type: 'port-to-door',
    pickup_location: '',
    delivery_location: '',
    scheduled_date: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shipmentsRes, agentsRes, customersRes] = await Promise.all([
        supabase
          .from('import_shipments')
          .select('*')
          .order('eta', { ascending: false }),
        supabase
          .from('agents')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('customers')
          .select('id, name, company_name')
          .order('name')
      ]);

      if (shipmentsRes.data) {
        const shipmentsWithAgents = await Promise.all(
          shipmentsRes.data.map(async (shipment) => {
            if (shipment.agent_id) {
              const { data: agent } = await supabase
                .from('agents')
                .select('name')
                .eq('id', shipment.agent_id)
                .single();

              return { ...shipment, agent_name: agent?.name };
            }
            return shipment;
          })
        );
        setShipments(shipmentsWithAgents);
      }

      if (agentsRes.data) setAgents(agentsRes.data);
      if (customersRes.data) setCustomers(customersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter(shipment => {
    const matchesAgent = selectedAgent === 'all' || shipment.agent_id === selectedAgent;
    const matchesSearch = searchTerm === '' ||
      shipment.shipment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.shipper_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.consignee_name?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesAgent && matchesSearch;
  });

  const handleCreateJob = (shipment: InboundShipment) => {
    setSelectedShipment(shipment);
    setJobFormData({
      customer_id: '',
      job_type: 'import',
      service_type: 'port-to-door',
      pickup_location: shipment.port_of_discharge || '',
      delivery_location: shipment.consignee_address || '',
      scheduled_date: shipment.eta || new Date().toISOString().split('T')[0],
      notes: `Import shipment from ${shipment.shipper_name}\nShipment: ${shipment.shipment_number}\nAgent: ${shipment.agent_name || 'N/A'}`
    });
    setShowJobForm(true);
  };

  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShipment) return;

    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          ...jobFormData,
          status: 'pending',
          origin: selectedShipment.port_of_loading,
          destination: selectedShipment.port_of_discharge,
          assigned_agent_id: selectedShipment.agent_id,
          shipment_number: selectedShipment.shipment_number,
          total_volume: selectedShipment.total_volume_cbm,
          total_weight: selectedShipment.total_gross_weight_kg,
          package_count: selectedShipment.total_packages
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      await supabase
        .from('import_shipments')
        .update({ job_created: true, job_id: jobData.id })
        .eq('id', selectedShipment.id);

      alert('Job created successfully!');
      setShowJobForm(false);
      setSelectedShipment(null);
      loadData();
    } catch (error: any) {
      console.error('Error creating job:', error);
      alert(error.message || 'Failed to create job');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading inbound shipments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inbound Shipment Job Creation</h2>
          <p className="text-gray-600">Create jobs from shipments consigned by overseas agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Total Inbound</p>
          <p className="text-2xl font-bold text-blue-600">{shipments.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Pre-Alert Received</p>
          <p className="text-2xl font-bold text-green-600">
            {shipments.filter(s => s.pre_alert_received).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Arrived</p>
          <p className="text-2xl font-bold text-purple-600">
            {shipments.filter(s => s.ata).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Overseas Agents</p>
          <p className="text-2xl font-bold text-orange-600">
            {agents.filter(a => a.type === 'international').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search shipments, shipper, consignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.country})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Shipment No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Shipper/Consignee</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ETA/ATA</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Details</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredShipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-900">{shipment.shipment_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{shipment.agent_name || 'No Agent'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{shipment.shipper_name}</p>
                    <p className="text-sm text-gray-600">{shipment.consignee_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      <span>{shipment.port_of_loading}</span>
                      <span className="text-gray-400">→</span>
                      <span>{shipment.port_of_discharge}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {shipment.ata ? (
                        <div className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span>Arrived: {new Date(shipment.ata).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-blue-700">
                          <Calendar className="h-4 w-4" />
                          <span>ETA: {new Date(shipment.eta).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{shipment.total_packages} pkgs</span>
                      </div>
                      <div>{shipment.total_gross_weight_kg} kg</div>
                      <div>{shipment.total_volume_cbm} CBM</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {shipment.pre_alert_received && (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Pre-Alert
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        shipment.shipment_type === 'FCL'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {shipment.shipment_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleCreateJob(shipment)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Create Job
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredShipments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Ship className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No inbound shipments found</p>
            </div>
          )}
        </div>
      </div>

      {showJobForm && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Create Job from Inbound Shipment</h3>
                <p className="text-sm text-gray-600">Shipment: {selectedShipment.shipment_number}</p>
              </div>
              <button
                onClick={() => setShowJobForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FileText className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">Shipment Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-700">Agent:</span> {selectedShipment.agent_name}
                </div>
                <div>
                  <span className="text-blue-700">Type:</span> {selectedShipment.shipment_type}
                </div>
                <div>
                  <span className="text-blue-700">Shipper:</span> {selectedShipment.shipper_name}
                </div>
                <div>
                  <span className="text-blue-700">Consignee:</span> {selectedShipment.consignee_name}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitJob} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={jobFormData.customer_id}
                  onChange={(e) => setJobFormData({ ...jobFormData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name || customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Type
                  </label>
                  <select
                    value={jobFormData.job_type}
                    onChange={(e) => setJobFormData({ ...jobFormData, job_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="import">Import</option>
                    <option value="export">Export</option>
                    <option value="domestic">Domestic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type
                  </label>
                  <select
                    value={jobFormData.service_type}
                    onChange={(e) => setJobFormData({ ...jobFormData, service_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="port-to-door">Port to Door</option>
                    <option value="port-to-port">Port to Port</option>
                    <option value="door-to-door">Door to Door</option>
                    <option value="door-to-port">Door to Port</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Location
                </label>
                <input
                  type="text"
                  value={jobFormData.pickup_location}
                  onChange={(e) => setJobFormData({ ...jobFormData, pickup_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Location *
                </label>
                <input
                  type="text"
                  required
                  value={jobFormData.delivery_location}
                  onChange={(e) => setJobFormData({ ...jobFormData, delivery_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={jobFormData.scheduled_date}
                  onChange={(e) => setJobFormData({ ...jobFormData, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Notes
                </label>
                <textarea
                  rows={4}
                  value={jobFormData.notes}
                  onChange={(e) => setJobFormData({ ...jobFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowJobForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
