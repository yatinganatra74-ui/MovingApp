import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, DollarSign, TrendingUp, Lock, Archive, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface Container {
  id: string;
  container_number: string;
  container_type: string;
  eta: string;
  container_status: string;
  is_closed: boolean;
  closure_status: string;
  is_profit_locked: boolean;
  total_shipments: number;
  delivered_shipments: number;
  total_revenue: number;
  total_cost: number;
  forex_gain_loss: number;
  final_profit: number;
  profit_margin: number;
  closure_date: string;
  locked_at: string;
  archived_at: string;
}

interface ContainerFinancials {
  success: boolean;
  container_number: string;
  total_shipments: number;
  delivered_shipments: number;
  total_revenue: number;
  total_cost: number;
  forex_gain_loss: number;
  profit: number;
  margin_percent: number;
  can_close: boolean;
}

export default function ContainerClosure() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);
  const [financials, setFinancials] = useState<ContainerFinancials | null>(null);
  const [loading, setLoading] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [view, setView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    const { data, error } = await supabase
      .from('container_financial_dashboard')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContainers(data);
    }
  };

  const calculateFinancials = async (containerId: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('calculate_container_financials', {
      p_container_id: containerId
    });

    setLoading(false);

    if (!error && data) {
      setFinancials(data);
    } else {
      alert('Error calculating financials: ' + error?.message);
    }
  };

  const validateContainerCosts = async (containerId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('check_container_costs', {
      p_container_id: containerId
    });

    if (error || !data?.pass) {
      alert(data?.message || 'Container costs validation failed');
      return false;
    }
    return true;
  };

  const closeContainer = async () => {
    if (!selectedContainer || !financials?.can_close) {
      alert('Container cannot be closed. Ensure all shipments are delivered.');
      return;
    }

    const costsValid = await validateContainerCosts(selectedContainer.id);
    if (!costsValid) {
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('close_container', {
      p_container_id: selectedContainer.id,
      p_notes: closureNotes || null
    });

    setLoading(false);

    if (error) {
      alert('Error closing container: ' + error.message);
    } else if (data?.success) {
      alert('Container closed successfully!');
      setView('list');
      fetchContainers();
    }
  };

  const lockProfit = async (containerId: string) => {
    if (!confirm('Lock profit for this container? This cannot be undone.')) return;

    setLoading(true);
    const { data, error } = await supabase.rpc('lock_container_profit', {
      p_container_id: containerId
    });

    setLoading(false);

    if (error) {
      alert('Error locking profit: ' + error.message);
    } else if (data?.success) {
      alert('Profit locked successfully!');
      fetchContainers();
    }
  };

  const archiveContainer = async (containerId: string) => {
    if (!confirm('Archive this container? It will be moved to historical records.')) return;

    setLoading(true);
    const { data, error } = await supabase.rpc('archive_container', {
      p_container_id: containerId
    });

    setLoading(false);

    if (error) {
      alert('Error archiving container: ' + error.message);
    } else if (data?.success) {
      alert('Container archived successfully!');
      fetchContainers();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      archived: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      arrived: 'bg-green-100 text-green-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  if (view === 'detail' && selectedContainer && financials) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Container Closure: {selectedContainer.container_number}</h2>
          <button
            onClick={() => { setView('list'); setSelectedContainer(null); setFinancials(null); }}
            className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Back to List
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Revenue</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(financials.total_revenue)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Total Cost</span>
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(financials.total_cost)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Final Profit</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className={`text-2xl font-bold ${financials.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(financials.profit)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Profit Margin</span>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <p className={`text-2xl font-bold ${financials.margin_percent >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              {financials.margin_percent.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Container Number:</span>
              <span className="font-semibold">{financials.container_number}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Shipments:</span>
              <span className="font-semibold">
                {financials.delivered_shipments} / {financials.total_shipments} Delivered
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Total Revenue:</span>
              <span className="font-semibold text-green-600">{formatCurrency(financials.total_revenue)}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Total Cost:</span>
              <span className="font-semibold text-red-600">{formatCurrency(financials.total_cost)}</span>
            </div>

            {financials.forex_gain_loss !== 0 && (
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Forex Gain/Loss:</span>
                <span className={`font-semibold ${financials.forex_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Math.abs(financials.forex_gain_loss).toFixed(2)} {financials.forex_gain_loss >= 0 ? 'Gain' : 'Loss'}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-4 bg-gray-50 px-4 rounded-lg">
              <span className="text-lg font-semibold">Final Profit:</span>
              <span className={`text-xl font-bold ${financials.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(financials.profit)}
              </span>
            </div>

            <div className="flex justify-between items-center py-4 bg-blue-50 px-4 rounded-lg">
              <span className="text-lg font-semibold">Profit Margin:</span>
              <span className={`text-xl font-bold ${financials.margin_percent >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {financials.margin_percent.toFixed(2)}%
              </span>
            </div>
          </div>

          {financials.can_close && !selectedContainer.is_closed && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold mb-3">Close Container</h4>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closure Notes (Optional)
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Add any notes about this container closure..."
                />
              </div>
              <button
                onClick={closeContainer}
                disabled={loading}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
              >
                {loading ? 'Closing...' : 'Close Container & Lock Financials'}
              </button>
            </div>
          )}

          {!financials.can_close && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900">Cannot Close Container</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    All shipments must be delivered before closing the container.
                    Currently {financials.delivered_shipments} of {financials.total_shipments} shipments are delivered.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Container Closure & Final Profit</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Containers</p>
              <p className="text-2xl font-bold">{containers.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Open</p>
              <p className="text-2xl font-bold text-blue-600">
                {containers.filter(c => c.closure_status === 'open').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Closed</p>
              <p className="text-2xl font-bold text-gray-600">
                {containers.filter(c => c.closure_status === 'closed').length}
              </p>
            </div>
            <Lock className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Archived</p>
              <p className="text-2xl font-bold text-purple-600">
                {containers.filter(c => c.closure_status === 'archived').length}
              </p>
            </div>
            <Archive className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Container #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipments</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Forex G/L</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {containers.map(container => (
              <tr key={container.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{container.container_number}</div>
                  <div className="text-xs text-gray-500">{container.container_type}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    {container.delivered_shipments} / {container.total_shipments}
                  </div>
                  {container.delivered_shipments === container.total_shipments && container.total_shipments > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600 inline ml-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-yellow-600 inline ml-1" />
                  )}
                </td>
                <td className="px-6 py-4 text-right text-sm text-green-600 font-medium">
                  {formatCurrency(container.total_revenue)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-red-600 font-medium">
                  {formatCurrency(container.total_cost)}
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  {container.forex_gain_loss !== 0 && (
                    <span className={container.forex_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ₹{Math.abs(container.forex_gain_loss).toFixed(0)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm font-bold ${container.final_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(container.final_profit)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm font-semibold ${container.profit_margin >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    {container.profit_margin.toFixed(1)}%
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(container.closure_status)}`}>
                      {container.closure_status.toUpperCase()}
                    </span>
                    {container.is_profit_locked && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    {container.closure_status === 'open' && (
                      <button
                        onClick={() => {
                          setSelectedContainer(container);
                          calculateFinancials(container.id);
                          setView('detail');
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Review & Close
                      </button>
                    )}
                    {container.closure_status === 'closed' && !container.is_profit_locked && (
                      <button
                        onClick={() => lockProfit(container.id)}
                        className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                      >
                        Lock Profit
                      </button>
                    )}
                    {container.closure_status === 'closed' && container.is_profit_locked && (
                      <button
                        onClick={() => archiveContainer(container.id)}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Archive
                      </button>
                    )}
                    {container.closure_status === 'archived' && (
                      <span className="text-xs text-gray-500">Archived</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {containers.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No containers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
