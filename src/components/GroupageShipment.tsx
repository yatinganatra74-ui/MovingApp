import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Package } from 'lucide-react';

interface GroupageShipmentProps {
  shipment: any;
  containers: any[];
  onClose: () => void;
}

interface JobAllocation {
  id?: string;
  job_id: string;
  allocated_space: number;
  cost_share: number;
  job?: {
    job_number: string;
    customers?: { name: string };
  };
}

export default function GroupageShipment({ shipment, containers, onClose }: GroupageShipmentProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<JobAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    container_id: shipment?.container_id || '',
    shipment_name: shipment?.shipment_name || '',
    departure_date: shipment?.departure_date?.split('T')[0] || '',
    arrival_date: shipment?.arrival_date?.split('T')[0] || '',
    status: shipment?.status || 'planning'
  });

  useEffect(() => {
    loadJobs();
    if (shipment) {
      loadAllocations();
    }
  }, []);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, customers(name)')
        .in('status', ['scheduled', 'in-progress'])
        .order('job_number');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  };

  const loadAllocations = async () => {
    try {
      const { data, error } = await supabase
        .from('groupage_allocations')
        .select(`
          *,
          jobs(job_number, customers(name))
        `)
        .eq('groupage_shipment_id', shipment.id);

      if (error) throw error;
      setAllocations(data?.map(a => ({
        id: a.id,
        job_id: a.job_id,
        allocated_space: a.allocated_space,
        cost_share: a.cost_share,
        job: a.jobs
      })) || []);
    } catch (error) {
      console.error('Error loading allocations:', error);
    }
  };

  const addAllocation = () => {
    setAllocations([...allocations, {
      job_id: '',
      allocated_space: 0,
      cost_share: 0
    }]);
  };

  const updateAllocation = (index: number, field: keyof JobAllocation, value: any) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const totalSpace = allocations.reduce((sum, a) => sum + a.allocated_space, 0);
  const totalCost = allocations.reduce((sum, a) => sum + a.cost_share, 0);

  const selectedContainer = containers.find(c => c.id === formData.container_id);
  const getContainerCapacity = (type: string) => {
    switch (type) {
      case 'FCL-20': return 1165;
      case 'FCL-40': return 2350;
      case 'FCL-40HC': return 2700;
      case 'LCL': return 500;
      case 'Groupage': return 2000;
      default: return 0;
    }
  };

  const containerCapacity = selectedContainer ? getContainerCapacity(selectedContainer.container_type) : 0;
  const utilizationPercent = containerCapacity > 0 ? (totalSpace / containerCapacity) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const shipmentData = {
        ...formData,
        total_capacity_used: totalSpace
      };

      let shipmentId = shipment?.id;

      if (shipment) {
        const { error } = await supabase
          .from('groupage_shipments')
          .update(shipmentData)
          .eq('id', shipment.id);

        if (error) throw error;

        await supabase
          .from('groupage_allocations')
          .delete()
          .eq('groupage_shipment_id', shipment.id);
      } else {
        const { data, error } = await supabase
          .from('groupage_shipments')
          .insert([shipmentData])
          .select()
          .single();

        if (error) throw error;
        shipmentId = data.id;
      }

      if (allocations.length > 0) {
        const allocationsToInsert = allocations
          .filter(a => a.job_id)
          .map(a => ({
            groupage_shipment_id: shipmentId,
            job_id: a.job_id,
            allocated_space: a.allocated_space,
            cost_share: a.cost_share
          }));

        if (allocationsToInsert.length > 0) {
          const { error } = await supabase
            .from('groupage_allocations')
            .insert(allocationsToInsert);

          if (error) throw error;
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving groupage shipment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {shipment ? 'Edit Groupage Shipment' : 'New Groupage Shipment'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Shipment Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.shipment_name}
                  onChange={(e) => setFormData({ ...formData, shipment_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  placeholder="e.g., Dubai to London - Feb 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Container *
                </label>
                <select
                  required
                  value={formData.container_id}
                  onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Select container</option>
                  {containers.map(container => (
                    <option key={container.id} value={container.id}>
                      {container.container_number} - {container.container_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="planning">Planning</option>
                  <option value="loading">Loading</option>
                  <option value="in-transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={formData.departure_date}
                  onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arrival Date
                </label>
                <input
                  type="date"
                  value={formData.arrival_date}
                  onChange={(e) => setFormData({ ...formData, arrival_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>
            </div>

            {containerCapacity > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Container Utilization</span>
                  <span className="text-lg font-bold text-slate-900">
                    {totalSpace.toFixed(1)} / {containerCapacity} cu ft ({utilizationPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      utilizationPercent > 90 ? 'bg-green-500' :
                      utilizationPercent > 70 ? 'bg-blue-500' :
                      utilizationPercent > 50 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Job Allocations</h3>
                <button
                  type="button"
                  onClick={addAllocation}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Job
                </button>
              </div>

              <div className="space-y-3">
                {allocations.map((allocation, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-lg">
                    <select
                      value={allocation.job_id}
                      onChange={(e) => updateAllocation(index, 'job_id', e.target.value)}
                      className="col-span-5 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Select job</option>
                      {jobs.map(job => (
                        <option key={job.id} value={job.id}>
                          {job.job_number} - {job.customers?.name}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Space (cu ft)"
                        value={allocation.allocated_space}
                        onChange={(e) => updateAllocation(index, 'allocated_space', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Cost Share ($)"
                        value={allocation.cost_share}
                        onChange={(e) => updateAllocation(index, 'cost_share', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAllocation(index)}
                      className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {allocations.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No jobs allocated yet. Click "Add Job" to start.
                  </div>
                )}
              </div>

              {allocations.length > 0 && (
                <div className="mt-4 bg-slate-100 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600">Total Space Allocated:</span>
                      <span className="ml-2 font-bold text-slate-900">{totalSpace.toFixed(1)} cu ft</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Total Cost Share:</span>
                      <span className="ml-2 font-bold text-slate-900">${totalCost.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Jobs Allocated:</span>
                      <span className="ml-2 font-bold text-slate-900">{allocations.filter(a => a.job_id).length}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Avg Cost per Job:</span>
                      <span className="ml-2 font-bold text-slate-900">
                        ${allocations.length > 0 ? (totalCost / allocations.filter(a => a.job_id).length).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : shipment ? 'Update Shipment' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
