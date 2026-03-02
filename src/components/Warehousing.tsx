import { useState, useEffect } from 'react';
import { Warehouse, Package, MapPin, TrendingUp, DollarSign, Calendar, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WarehouseInventory {
  id: string;
  customer_name: string;
  customer_email: string;
  description: string;
  volume_cbm: number;
  item_count: number;
  storage_type: string;
  inward_date: string;
  expected_outward_date: string;
  storage_status: string;
  daily_rate_per_cbm: number;
  location_code: string;
  warehouse_name: string;
  section: string;
  days_in_storage: number;
  estimated_charges: number;
}

interface WarehouseCapacity {
  warehouse_name: string;
  section: string;
  location_type: string;
  is_climate_controlled: boolean;
  location_count: number;
  total_capacity: number;
  total_occupied: number;
  total_available: number;
  utilization_percent: number;
}

export default function Warehousing() {
  const [inventory, setInventory] = useState<WarehouseInventory[]>([]);
  const [capacity, setCapacity] = useState<WarehouseCapacity[]>([]);
  const [utilization, setUtilization] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inventoryRes, capacityRes, utilizationRes] = await Promise.all([
        supabase.from('warehouse_inventory').select('*').order('inward_date', { ascending: false }),
        supabase.from('warehouse_capacity_summary').select('*'),
        supabase.rpc('get_warehouse_utilization')
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (capacityRes.error) throw capacityRes.error;
      if (utilizationRes.error) throw utilizationRes.error;

      setInventory(inventoryRes.data || []);
      setCapacity(capacityRes.data || []);
      setUtilization(utilizationRes.data);
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = inventory.reduce((sum, item) => sum + item.estimated_charges, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading warehouse data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warehouse Management</h1>
          <p className="text-slate-600 mt-1">Storage inventory and capacity management</p>
        </div>
        <Warehouse className="w-8 h-8 text-blue-600" />
      </div>

      {utilization && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Capacity</p>
                <p className="text-2xl font-bold text-slate-900">
                  {utilization.total_capacity_cbm} CBM
                </p>
              </div>
              <Warehouse className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Occupied</p>
                <p className="text-2xl font-bold text-orange-600">
                  {utilization.occupied_cbm} CBM
                </p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Available</p>
                <p className="text-2xl font-bold text-green-600">
                  {utilization.available_cbm} CBM
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Utilization</p>
                <p className="text-2xl font-bold text-blue-600">
                  {utilization.utilization_percent}%
                </p>
              </div>
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#3b82f6"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - utilization.utilization_percent / 100)}`}
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Warehouse Capacity by Section
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {capacity.map((cap, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {cap.warehouse_name} - Section {cap.section}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {cap.location_type} | {cap.location_count} locations
                        {cap.is_climate_controlled && ' | Climate Controlled'}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {cap.utilization_percent?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${cap.utilization_percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm text-slate-600">
                    <span>{cap.total_occupied} CBM occupied</span>
                    <span>{cap.total_available} CBM available</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Revenue Summary
              </h3>
              <span className="text-2xl font-bold text-green-600">
                ${totalRevenue.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-slate-200">
                <span className="text-slate-700">Total Goods in Storage</span>
                <span className="font-semibold text-slate-900">{inventory.length}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-200">
                <span className="text-slate-700">Total Volume Stored</span>
                <span className="font-semibold text-slate-900">
                  {inventory.reduce((sum, item) => sum + item.volume_cbm, 0).toFixed(2)} CBM
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-200">
                <span className="text-slate-700">Average Daily Rate</span>
                <span className="font-semibold text-slate-900">
                  ${(inventory.reduce((sum, item) => sum + item.daily_rate_per_cbm, 0) / (inventory.length || 1)).toFixed(2)}/CBM
                </span>
              </div>
              <div className="flex items-center justify-between py-3 bg-green-50 rounded-lg px-3">
                <span className="font-bold text-green-900">Estimated Monthly Revenue</span>
                <span className="text-xl font-bold text-green-900">
                  ${(totalRevenue * 30 / (inventory.reduce((sum, item) => sum + item.days_in_storage, 0) || 1)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Current Inventory ({inventory.length} items)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Volume</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Days Stored</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Daily Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Charges</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {inventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-slate-900">{item.customer_name}</p>
                      <p className="text-sm text-slate-500">{item.customer_email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-900">{item.description}</p>
                    <p className="text-sm text-slate-500">{item.item_count} items</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">
                      {item.volume_cbm} CBM
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.location_code}</p>
                        <p className="text-xs text-slate-500">{item.warehouse_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900">{item.days_in_storage} days</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    ${item.daily_rate_per_cbm.toFixed(2)}/CBM
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-bold text-green-600">
                      ${item.estimated_charges.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      item.storage_status === 'IN_STORAGE' ? 'bg-blue-100 text-blue-800' :
                      item.storage_status === 'SCHEDULED_OUT' ? 'bg-orange-100 text-orange-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {item.storage_status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
