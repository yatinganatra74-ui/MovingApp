import { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, Plus, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InventoryItem {
  id: string;
  material_name: string;
  material_category: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
  reorder_quantity: number;
  unit_cost: number;
  stock_value: number;
  stock_status: 'LOW' | 'MEDIUM' | 'GOOD';
  has_active_alert: boolean;
  supplier_name: string;
  storage_location: string;
}

interface LowStockAlert {
  id: string;
  material_id: string;
  material_name: string;
  current_stock: number;
  reorder_level: number;
  suggested_order_quantity: number;
  alert_date: string;
}

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchInventory();
    fetchAlerts();
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_status')
        .select('*')
        .eq('active', true)
        .order('material_name');

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('low_stock_alerts')
        .select(`
          *,
          packing_materials_inventory!inner(material_name)
        `)
        .eq('acknowledged', false)
        .order('alert_date', { ascending: false });

      if (error) throw error;

      const formattedAlerts = (data || []).map((alert: any) => ({
        ...alert,
        material_name: alert.packing_materials_inventory.material_name
      }));

      setAlerts(formattedAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const generateSuggestedPO = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('generate_suggested_po', {
        p_created_by: user?.id
      });

      if (error) throw error;

      alert('Purchase order generated successfully!');
      fetchAlerts();
    } catch (error) {
      console.error('Error generating PO:', error);
      alert('Failed to generate purchase order');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('low_stock_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.material_category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(inventory.map(i => i.material_category))];

  const stats = {
    totalValue: inventory.reduce((sum, item) => sum + item.stock_value, 0),
    lowStockItems: inventory.filter(i => i.stock_status === 'LOW').length,
    totalItems: inventory.length,
    activeAlerts: alerts.length
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading inventory...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Material
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-slate-900">${stats.totalValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Items</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalItems}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Alerts</p>
              <p className="text-2xl font-bold text-red-600">{stats.activeAlerts}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Low Stock Alerts ({alerts.length})</h3>
            </div>
            <button
              onClick={generateSuggestedPO}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              Generate Purchase Order
            </button>
          </div>

          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-white rounded p-3 border border-red-200">
                <div>
                  <p className="font-medium text-slate-900">{alert.material_name}</p>
                  <p className="text-sm text-slate-600">
                    Current: {alert.current_stock} | Reorder Level: {alert.reorder_level} |
                    Suggested Order: {alert.suggested_order_quantity}
                  </p>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-600" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Material</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Current Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Reorder Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Unit Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Stock Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Supplier</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredInventory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{item.material_name}</p>
                        <p className="text-sm text-slate-500">{item.storage_location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm">
                      {item.material_category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">
                      {item.current_stock} {item.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    {item.reorder_level} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                    ${item.unit_cost.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    ${item.stock_value.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      item.stock_status === 'LOW' ? 'bg-red-100 text-red-800' :
                      item.stock_status === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.stock_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {item.supplier_name || '-'}
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
