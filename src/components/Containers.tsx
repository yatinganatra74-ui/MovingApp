import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Package, Users, DollarSign, TrendingUp } from 'lucide-react';
import GroupageShipment from './GroupageShipment';

interface Container {
  id: string;
  container_number: string;
  container_type: string;
  capacity: number;
  status: string;
  current_location: string | null;
}

interface GroupageShipment {
  id: string;
  container_id: string;
  shipment_name: string;
  departure_date: string | null;
  arrival_date: string | null;
  status: string;
  total_capacity_used: number;
  created_at: string;
  containers?: Container;
}

export default function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [groupageShipments, setGroupageShipments] = useState<GroupageShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupageModal, setShowGroupageModal] = useState(false);
  const [viewingShipment, setViewingShipment] = useState<GroupageShipment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'containers' | 'groupage'>('groupage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [containersRes, shipmentsRes] = await Promise.all([
        supabase.from('containers').select('*').order('container_number'),
        supabase.from('groupage_shipments').select('*, containers(*)').order('created_at', { ascending: false })
      ]);

      setContainers(containersRes.data || []);
      setGroupageShipments(shipmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'planning':
        return 'bg-yellow-100 text-yellow-800';
      case 'loading':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getContainerTypeDetails = (type: string) => {
    switch (type) {
      case 'FCL-20':
        return { capacity: 1165, unit: 'cu ft', label: "20' FCL" };
      case 'FCL-40':
        return { capacity: 2350, unit: 'cu ft', label: "40' FCL" };
      case 'FCL-40HC':
        return { capacity: 2700, unit: 'cu ft', label: "40' HC" };
      case 'LCL':
        return { capacity: 500, unit: 'cu ft', label: 'LCL' };
      case 'Groupage':
        return { capacity: 2000, unit: 'cu ft', label: 'Groupage' };
      default:
        return { capacity: 0, unit: 'cu ft', label: type };
    }
  };

  const filteredContainers = containers.filter(container =>
    container.container_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    container.container_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredShipments = groupageShipments.filter(shipment =>
    shipment.shipment_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shipment.containers?.container_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Container Management</h1>
          <p className="text-slate-600 mt-1">Manage containers and groupage shipments</p>
        </div>
        <button
          onClick={() => {
            setViewingShipment(null);
            setShowGroupageModal(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Groupage Shipment
        </button>
      </div>

      <div className="flex gap-2 bg-white rounded-lg p-1 border border-slate-200 w-fit">
        <button
          onClick={() => setView('groupage')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            view === 'groupage'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Groupage Shipments
        </button>
        <button
          onClick={() => setView('containers')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            view === 'containers'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Containers
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${view}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
        </div>

        {view === 'groupage' ? (
          <div className="p-6 space-y-4">
            {filteredShipments.map((shipment) => {
              const containerDetails = getContainerTypeDetails(shipment.containers?.container_type || '');
              const utilizationPercent = (shipment.total_capacity_used / containerDetails.capacity) * 100;

              return (
                <div
                  key={shipment.id}
                  className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setViewingShipment(shipment);
                    setShowGroupageModal(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{shipment.shipment_name}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Container: {shipment.containers?.container_number} ({containerDetails.label})
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(shipment.status)}`}>
                      {shipment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Departure</div>
                      <div className="font-semibold text-slate-900">
                        {shipment.departure_date ? new Date(shipment.departure_date).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Arrival</div>
                      <div className="font-semibold text-slate-900">
                        {shipment.arrival_date ? new Date(shipment.arrival_date).toLocaleDateString() : 'Not set'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Capacity Used</div>
                      <div className="font-semibold text-slate-900">
                        {shipment.total_capacity_used.toFixed(1)} / {containerDetails.capacity} {containerDetails.unit}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">Utilization</div>
                      <div className="font-semibold text-slate-900">
                        {utilizationPercent.toFixed(1)}%
                      </div>
                    </div>
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
              );
            })}

            {filteredShipments.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {searchQuery ? 'No groupage shipments found' : 'No groupage shipments yet'}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Container #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredContainers.map((container) => {
                  const details = getContainerTypeDetails(container.container_type);
                  return (
                    <tr key={container.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-600" />
                          <span className="font-semibold text-slate-900">{container.container_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          {details.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {details.capacity} {details.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {container.current_location || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(container.status)}`}>
                          {container.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredContainers.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {searchQuery ? 'No containers found' : 'No containers yet'}
              </div>
            )}
          </div>
        )}
      </div>

      {showGroupageModal && (
        <GroupageShipment
          shipment={viewingShipment}
          containers={containers}
          onClose={() => {
            setShowGroupageModal(false);
            setViewingShipment(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
