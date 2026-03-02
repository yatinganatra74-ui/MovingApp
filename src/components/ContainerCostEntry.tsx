import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  Plus,
  Save,
  X,
  Ship,
  Calculator,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ContainerCost {
  id: string;
  cost_type: string;
  cost_name: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_inr: number;
  vendor_name: string;
  invoice_number: string;
  payment_status: string;
}

interface Container {
  id: string;
  container_number: string;
  estimated_total_cbm: number;
  status: string;
  shipment_count: number;
}

export default function ContainerCostEntry() {
  const { user } = useAuth();
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [containerCosts, setContainerCosts] = useState<ContainerCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [allocating, setAllocating] = useState(false);

  const [formData, setFormData] = useState({
    cost_type: 'thc',
    cost_name: '',
    amount: '',
    currency: 'INR',
    exchange_rate: '83.0',
    vendor_name: '',
    invoice_number: '',
    payment_status: 'pending',
  });

  useEffect(() => {
    loadContainers();
  }, []);

  useEffect(() => {
    if (selectedContainer) {
      loadContainerCosts();
    }
  }, [selectedContainer]);

  const loadContainers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('import_container_utilization')
        .select('*')
        .in('status', ['expected', 'landed'])
        .order('eta_pod');

      if (error) throw error;

      setContainers(data || []);
    } catch (error) {
      console.error('Error loading containers:', error);
      alert('Failed to load containers');
    } finally {
      setLoading(false);
    }
  };

  const loadContainerCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('container_costs')
        .select('*')
        .eq('container_id', selectedContainer)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContainerCosts(data || []);
    } catch (error) {
      console.error('Error loading costs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const costData = {
        container_id: selectedContainer,
        cost_type: formData.cost_type,
        cost_name: formData.cost_name,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchange_rate: formData.currency === 'INR' ? null : parseFloat(formData.exchange_rate),
        vendor_name: formData.vendor_name,
        invoice_number: formData.invoice_number,
        payment_status: formData.payment_status,
        created_by: user?.id,
      };

      const { error } = await supabase.from('container_costs').insert([costData]);

      if (error) throw error;

      alert('Cost added successfully!');
      setShowForm(false);
      resetForm();
      loadContainerCosts();
    } catch (error) {
      console.error('Error adding cost:', error);
      alert('Failed to add cost');
    }
  };

  const allocateCosts = async () => {
    if (!selectedContainer) {
      alert('Please select a container first');
      return;
    }

    if (
      !confirm(
        'Allocate container costs to all shipments?\n\nThis will:\n- Calculate cost per CBM\n- Distribute costs proportionally\n- Update all shipment profits\n- Mark container as LANDED'
      )
    ) {
      return;
    }

    try {
      setAllocating(true);

      const { data, error } = await supabase.rpc('allocate_container_costs', {
        p_container_id: selectedContainer,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(
          `✅ Costs allocated successfully!\n\nAllocated to ${data.count} shipments\nCost per CBM: ₹${data.cost_per_cbm.toFixed(2)}`
        );
        loadContainers();
      } else {
        alert('Failed to allocate costs: ' + (data?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error allocating costs:', error);
      alert('Failed to allocate costs');
    } finally {
      setAllocating(false);
    }
  };

  const deleteCost = async (costId: string) => {
    if (!confirm('Delete this cost entry?')) return;

    try {
      const { error } = await supabase.from('container_costs').delete().eq('id', costId);

      if (error) throw error;

      alert('Cost deleted successfully!');
      loadContainerCosts();
    } catch (error) {
      console.error('Error deleting cost:', error);
      alert('Failed to delete cost');
    }
  };

  const resetForm = () => {
    setFormData({
      cost_type: 'thc',
      cost_name: '',
      amount: '',
      currency: 'INR',
      exchange_rate: '83.0',
      vendor_name: '',
      invoice_number: '',
      payment_status: 'pending',
    });
  };

  const totalCostINR = containerCosts.reduce((sum, cost) => sum + (cost.amount_inr || 0), 0);
  const container = containers.find((c) => c.id === selectedContainer);

  const markCostsEntered = async () => {
    if (!selectedContainer || totalCostINR === 0) {
      alert('Please add costs before marking as entered');
      return;
    }

    const { data, error } = await supabase.rpc('mark_container_costs_entered', {
      p_container_id: selectedContainer
    });

    if (error) {
      alert('Error marking costs as entered: ' + error.message);
    } else if (data?.success) {
      alert('Container costs marked as entered!');
      loadContainers();
    } else {
      alert(data?.message || 'Failed to mark costs as entered');
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Container Cost Entry</h1>
        <p className="text-gray-600 mt-1">Enter actual costs and allocate to shipments</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Container</label>
        <select
          value={selectedContainer}
          onChange={(e) => setSelectedContainer(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4"
        >
          <option value="">Select a container...</option>
          {containers.map((container) => (
            <option key={container.id} value={container.id}>
              {container.container_number} - {container.status} ({container.shipment_count} shipments,{' '}
              {container.estimated_total_cbm.toFixed(2)} CBM)
            </option>
          ))}
        </select>

        {selectedContainer && container && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 mb-1 flex items-center gap-1">
                <Ship className="w-4 h-4" />
                Container
              </div>
              <div className="text-lg font-bold text-blue-900">{container.container_number}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 mb-1 flex items-center gap-1">
                <Package className="w-4 h-4" />
                Shipments
              </div>
              <div className="text-lg font-bold text-purple-900">{container.shipment_count}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
                <Calculator className="w-4 h-4" />
                Total CBM
              </div>
              <div className="text-lg font-bold text-green-900">{container.estimated_total_cbm.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600 mb-1 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Total Cost
              </div>
              <div className="text-lg font-bold text-orange-900">₹{totalCostINR.toLocaleString()}</div>
            </div>
          </div>
        )}

        {selectedContainer && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Cost
            </button>
            <button
              onClick={allocateCosts}
              disabled={allocating || containerCosts.length === 0}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              {allocating ? 'Allocating...' : 'Allocate Costs & Mark as Landed'}
            </button>
            <button
              onClick={markCostsEntered}
              disabled={containerCosts.length === 0 || totalCostINR === 0}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Mark Costs Entered
            </button>
          </div>
        )}
      </div>

      {selectedContainer && containerCosts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Cost Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Amount (INR)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Vendor</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Invoice</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {containerCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {cost.cost_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{cost.cost_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {cost.currency} {cost.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ₹{cost.amount_inr.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cost.vendor_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cost.invoice_number || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          cost.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : cost.payment_status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {cost.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteCost(cost.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-900">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-gray-900">₹{totalCostINR.toLocaleString()}</td>
                  <td colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedContainer && containerCosts.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Costs Added Yet</h3>
          <p className="text-gray-600 mb-4">
            Add container costs like THC, CFS, port handling, destuffing labor, etc.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Add First Cost
          </button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Container Cost</h3>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost Type *</label>
                  <select
                    required
                    value={formData.cost_type}
                    onChange={(e) => setFormData({ ...formData, cost_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="thc">THC (Terminal Handling Charges)</option>
                    <option value="cfs">CFS (Container Freight Station)</option>
                    <option value="port_handling">Port Handling</option>
                    <option value="destuffing">Destuffing Labor</option>
                    <option value="customs_exam">Customs Examination</option>
                    <option value="transport">Transport</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cost Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.cost_name}
                    onChange={(e) => setFormData({ ...formData, cost_name: e.target.value })}
                    placeholder="e.g., THC at Mumbai Port"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
                  <select
                    required
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                {formData.currency !== 'INR' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Exchange Rate *</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={formData.exchange_rate}
                      onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Name</label>
                  <input
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status *</label>
                <select
                  required
                  value={formData.payment_status}
                  onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Cost Allocation</p>
                    <p>
                      After adding all costs, click "Allocate Costs" to distribute them proportionally across
                      all shipments based on CBM. This will update profit calculations for each shipment.
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
                  Add Cost
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
