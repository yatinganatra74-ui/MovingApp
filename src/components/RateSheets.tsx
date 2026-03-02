import React, { useState, useEffect } from 'react';
import { Download, Upload, Plus, Edit2, Trash2, FileSpreadsheet, Search, Filter, Layers, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RateSheet {
  id: string;
  name: string;
  type: 'import' | 'export';
  agent_id: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  currency: string;
  base_currency: string;
  version: number;
  notes: string | null;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
}

interface RateSlab {
  id?: string;
  rate_sheet_id?: string;
  charge_type: 'destination_handling' | 'origin_handling' | 'freight' | 'storage_monthly' | 'storage_daily' | 'other';
  transport_mode?: 'SEA' | 'AIR';
  from_cbm: number;
  to_cbm: number | null;
  rate_per_cbm: number;
  from_kg?: number;
  to_kg?: number | null;
  rate_per_kg?: number;
  currency: string;
  description: string;
}

interface FixedCharge {
  id?: string;
  rate_sheet_id?: string;
  charge_name: string;
  charge_type: 'documentation' | 'admin' | 'customs_clearance' | 'insurance' | 'inspection' | 'fumigation' | 'other';
  amount: number;
  currency: string;
  is_mandatory: boolean;
  description: string;
}

export default function RateSheets() {
  const { user } = useAuth();
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'import' | 'export'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [newSheet, setNewSheet] = useState({
    name: '',
    type: 'import' as 'import' | 'export',
    transport_mode: 'SEA' as 'SEA' | 'AIR' | 'BOTH',
    agent_id: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    base_currency: 'USD',
    notes: '',
  });

  const [slabs, setSlabs] = useState<RateSlab[]>([]);
  const [fixedCharges, setFixedCharges] = useState<FixedCharge[]>([]);
  const [showSlabForm, setShowSlabForm] = useState(false);
  const [showChargeForm, setShowChargeForm] = useState(false);

  const [newSlab, setNewSlab] = useState<RateSlab>({
    charge_type: 'freight',
    transport_mode: 'SEA',
    from_cbm: 0,
    to_cbm: 5,
    rate_per_cbm: 0,
    from_kg: 0,
    to_kg: 100,
    rate_per_kg: 0,
    currency: 'USD',
    description: '',
  });

  const [newCharge, setNewCharge] = useState<FixedCharge>({
    charge_name: '',
    charge_type: 'documentation',
    amount: 0,
    currency: 'USD',
    is_mandatory: false,
    description: '',
  });

  const [testCBM, setTestCBM] = useState<number>(0);
  const [calculatedCost, setCalculatedCost] = useState<any>(null);

  useEffect(() => {
    loadRateSheets();
    loadAgents();
  }, []);

  useEffect(() => {
    if (selectedSheet) {
      loadSlabsAndCharges(selectedSheet);
    }
  }, [selectedSheet]);

  const loadAgents = async () => {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, type')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading agents:', error);
      return;
    }

    setAgents(data || []);
  };

  const loadRateSheets = async () => {
    const { data, error } = await supabase
      .from('rate_sheets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading rate sheets:', error);
      return;
    }

    setRateSheets(data || []);
  };

  const loadSlabsAndCharges = async (sheetId: string) => {
    const [slabsResult, chargesResult] = await Promise.all([
      supabase.from('rate_sheet_slabs').select('*').eq('rate_sheet_id', sheetId).order('charge_type').order('from_cbm'),
      supabase.from('rate_sheet_fixed_charges').select('*').eq('rate_sheet_id', sheetId).order('charge_name'),
    ]);

    if (slabsResult.data) setSlabs(slabsResult.data);
    if (chargesResult.data) setFixedCharges(chargesResult.data);
  };

  const createRateSheet = async () => {
    if (!newSheet.name) {
      alert('Please enter a rate sheet name');
      return;
    }

    const { data, error } = await supabase
      .from('rate_sheets')
      .insert([{
        ...newSheet,
        agent_id: newSheet.agent_id || null,
        created_by: user?.id,
        currency: newSheet.base_currency,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating rate sheet:', error);
      alert('Failed to create rate sheet');
      return;
    }

    setRateSheets([data, ...rateSheets]);
    setShowNewSheet(false);
    setNewSheet({
      name: '',
      type: 'import',
      agent_id: '',
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      base_currency: 'USD',
      notes: '',
    });
    setSelectedSheet(data.id);
  };

  const addSlab = async () => {
    if (!selectedSheet) return;

    if (newSlab.from_cbm < 0) {
      alert('From CBM must be 0 or greater');
      return;
    }

    if (newSlab.to_cbm !== null && newSlab.to_cbm <= newSlab.from_cbm) {
      alert('To CBM must be greater than From CBM');
      return;
    }

    const { data, error } = await supabase
      .from('rate_sheet_slabs')
      .insert([{ ...newSlab, rate_sheet_id: selectedSheet }])
      .select()
      .single();

    if (error) {
      console.error('Error adding slab:', error);
      alert('Failed to add slab');
      return;
    }

    setSlabs([...slabs, data]);
    setShowSlabForm(false);
    setNewSlab({
      charge_type: 'destination_handling',
      from_cbm: 0,
      to_cbm: 5,
      rate_per_cbm: 0,
      currency: 'USD',
      description: '',
    });
  };

  const addCharge = async () => {
    if (!selectedSheet || !newCharge.charge_name) return;

    const { data, error } = await supabase
      .from('rate_sheet_fixed_charges')
      .insert([{ ...newCharge, rate_sheet_id: selectedSheet }])
      .select()
      .single();

    if (error) {
      console.error('Error adding charge:', error);
      alert('Failed to add charge');
      return;
    }

    setFixedCharges([...fixedCharges, data]);
    setShowChargeForm(false);
    setNewCharge({
      charge_name: '',
      charge_type: 'documentation',
      amount: 0,
      currency: 'USD',
      is_mandatory: false,
      description: '',
    });
  };

  const deleteSlab = async (id: string) => {
    if (!confirm('Delete this slab?')) return;

    const { error } = await supabase
      .from('rate_sheet_slabs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting slab:', error);
      return;
    }

    setSlabs(slabs.filter(s => s.id !== id));
  };

  const deleteCharge = async (id: string) => {
    if (!confirm('Delete this charge?')) return;

    const { error } = await supabase
      .from('rate_sheet_fixed_charges')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting charge:', error);
      return;
    }

    setFixedCharges(fixedCharges.filter(c => c.id !== id));
  };

  const calculateTestCost = async () => {
    if (!selectedSheet || testCBM <= 0) {
      alert('Please enter a valid CBM amount');
      return;
    }

    const { data, error } = await supabase
      .rpc('calculate_shipment_cost', {
        p_rate_sheet_id: selectedSheet,
        p_cbm: testCBM,
        p_include_charges: ['destination_handling', 'documentation', 'admin']
      });

    if (error) {
      console.error('Error calculating cost:', error);
      return;
    }

    setCalculatedCost(data);
  };

  const exportToCSV = () => {
    if (!selectedSheet) return;

    const sheet = rateSheets.find(s => s.id === selectedSheet);
    if (!sheet) return;

    const slabsCSV = [
      ['Charge Type', 'From CBM', 'To CBM', 'Rate per CBM', 'Currency', 'Description'],
      ...slabs.map(s => [
        s.charge_type, s.from_cbm, s.to_cbm || 'Unlimited', s.rate_per_cbm, s.currency, s.description || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const chargesCSV = [
      ['Charge Name', 'Charge Type', 'Amount', 'Currency', 'Mandatory', 'Description'],
      ...fixedCharges.map(c => [
        c.charge_name, c.charge_type, c.amount, c.currency, c.is_mandatory ? 'Yes' : 'No', c.description || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const fullCSV = `Rate Sheet: ${sheet.name}\nVersion: ${sheet.version}\nType: ${sheet.type}\nCurrency: ${sheet.base_currency}\n\nSLABS:\n${slabsCSV}\n\nFIXED CHARGES:\n${chargesCSV}`;

    const blob = new Blob([fullCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.name.replace(/\s/g, '_')}_v${sheet.version}.csv`;
    a.click();
  };

  const filteredSheets = rateSheets.filter(sheet => {
    const matchesType = filterType === 'all' || sheet.type === filterType;
    const matchesSearch = sheet.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const groupedSlabs = slabs.reduce((acc, slab) => {
    if (!acc[slab.charge_type]) {
      acc[slab.charge_type] = [];
    }
    acc[slab.charge_type].push(slab);
    return acc;
  }, {} as Record<string, RateSlab[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Slab-Based Rate Sheets</h2>
        <button
          onClick={() => setShowNewSheet(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Rate Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search rate sheets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setFilterType('all')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('import')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
                  filterType === 'import'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Import
              </button>
              <button
                onClick={() => setFilterType('export')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${
                  filterType === 'export'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Export
              </button>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  onClick={() => setSelectedSheet(sheet.id)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedSheet === sheet.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{sheet.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${
                          sheet.type === 'import'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {sheet.type.toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          sheet.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {sheet.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                          v{sheet.version}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {sheet.base_currency} • From {new Date(sheet.effective_from).toLocaleDateString()}
                      </p>
                    </div>
                    <Layers className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedSheet ? (
            <>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Rate Sheet Details</h3>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Test Rate Calculator
                  </h4>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter CBM"
                      value={testCBM || ''}
                      onChange={(e) => setTestCBM(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={calculateTestCost}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Calculate
                    </button>
                  </div>
                  {calculatedCost && calculatedCost.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-gray-700">Calculated Costs:</p>
                      {calculatedCost.map((cost: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded">
                          <span>{cost.description}</span>
                          <span className="font-medium">{cost.amount.toFixed(2)} {cost.currency}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold bg-blue-100 p-2 rounded border-t-2 border-blue-300">
                        <span>Total:</span>
                        <span>
                          {calculatedCost.reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0).toFixed(2)}{' '}
                          {calculatedCost[0]?.currency}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Layers className="w-5 h-5" />
                        Rate Slabs ({slabs.length})
                      </h4>
                      <button
                        onClick={() => setShowSlabForm(!showSlabForm)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Slab
                      </button>
                    </div>

                    {showSlabForm && (
                      <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <select
                            value={newSlab.transport_mode}
                            onChange={(e) => setNewSlab({ ...newSlab, transport_mode: e.target.value as 'SEA' | 'AIR' })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="SEA">Sea Freight (CBM)</option>
                            <option value="AIR">Air Freight (KG)</option>
                          </select>
                          <select
                            value={newSlab.charge_type}
                            onChange={(e) => setNewSlab({ ...newSlab, charge_type: e.target.value as any })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="freight">Freight</option>
                            <option value="destination_handling">Destination Handling</option>
                            <option value="origin_handling">Origin Handling</option>
                            <option value="storage_monthly">Storage (Monthly)</option>
                            <option value="storage_daily">Storage (Daily)</option>
                            <option value="other">Other</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Currency"
                            value={newSlab.currency}
                            onChange={(e) => setNewSlab({ ...newSlab, currency: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {newSlab.transport_mode === 'SEA' ? (
                          <div className="grid grid-cols-3 gap-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="From CBM"
                              value={newSlab.from_cbm || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, from_cbm: parseFloat(e.target.value) || 0 })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="To CBM (leave empty for unlimited)"
                              value={newSlab.to_cbm || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, to_cbm: e.target.value ? parseFloat(e.target.value) : null })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Rate per CBM"
                              value={newSlab.rate_per_cbm || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, rate_per_cbm: parseFloat(e.target.value) || 0 })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="From KG"
                              value={newSlab.from_kg || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, from_kg: parseFloat(e.target.value) || 0 })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="To KG (leave empty for unlimited)"
                              value={newSlab.to_kg || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, to_kg: e.target.value ? parseFloat(e.target.value) : null })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Rate per KG"
                              value={newSlab.rate_per_kg || ''}
                              onChange={(e) => setNewSlab({ ...newSlab, rate_per_kg: parseFloat(e.target.value) || 0 })}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="Description"
                          value={newSlab.description}
                          onChange={(e) => setNewSlab({ ...newSlab, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowSlabForm(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addSlab}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Add Slab
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {Object.entries(groupedSlabs).map(([chargeType, chargeSlabs]) => (
                        <div key={chargeType} className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-900 mb-3 capitalize">
                            {chargeType.replace(/_/g, ' ')}
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left">CBM Range</th>
                                  <th className="px-3 py-2 text-left">Rate per CBM</th>
                                  <th className="px-3 py-2 text-left">Description</th>
                                  <th className="px-3 py-2 text-left">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {chargeSlabs.map((slab) => (
                                  <tr key={slab.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 font-medium">
                                      {slab.from_cbm} - {slab.to_cbm || '∞'} CBM
                                    </td>
                                    <td className="px-3 py-2">
                                      {slab.rate_per_cbm} {slab.currency}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{slab.description || '-'}</td>
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={() => slab.id && deleteSlab(slab.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Fixed Charges ({fixedCharges.length})</h4>
                      <button
                        onClick={() => setShowChargeForm(!showChargeForm)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Charge
                      </button>
                    </div>

                    {showChargeForm && (
                      <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Charge Name"
                            value={newCharge.charge_name}
                            onChange={(e) => setNewCharge({ ...newCharge, charge_name: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <select
                            value={newCharge.charge_type}
                            onChange={(e) => setNewCharge({ ...newCharge, charge_type: e.target.value as any })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="documentation">Documentation</option>
                            <option value="admin">Admin Fee</option>
                            <option value="customs_clearance">Customs Clearance</option>
                            <option value="insurance">Insurance</option>
                            <option value="inspection">Inspection</option>
                            <option value="fumigation">Fumigation</option>
                            <option value="other">Other</option>
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={newCharge.amount || ''}
                            onChange={(e) => setNewCharge({ ...newCharge, amount: parseFloat(e.target.value) || 0 })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Currency"
                            value={newCharge.currency}
                            onChange={(e) => setNewCharge({ ...newCharge, currency: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <label className="flex items-center gap-2 px-3 py-2 col-span-2">
                            <input
                              type="checkbox"
                              checked={newCharge.is_mandatory}
                              onChange={(e) => setNewCharge({ ...newCharge, is_mandatory: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700">Mandatory (auto-apply to shipments)</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          placeholder="Description"
                          value={newCharge.description}
                          onChange={(e) => setNewCharge({ ...newCharge, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowChargeForm(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addCharge}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Add Charge
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fixedCharges.map((charge) => (
                        <div key={charge.id} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{charge.charge_name}</h5>
                              <div className="flex gap-2 mt-1">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded capitalize">
                                  {charge.charge_type.replace(/_/g, ' ')}
                                </span>
                                {charge.is_mandatory && (
                                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                    Mandatory
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-900 mt-2">
                                {charge.amount} {charge.currency}
                              </p>
                              {charge.description && (
                                <p className="text-xs text-gray-500 mt-1">{charge.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => charge.id && deleteCharge(charge.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Rate Sheet Selected</h3>
              <p className="text-gray-600">Select a rate sheet from the list to manage slabs and charges</p>
            </div>
          )}
        </div>
      </div>

      {showNewSheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Rate Sheet</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newSheet.name}
                  onChange={(e) => setNewSheet({ ...newSheet, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Agent A - Q1 2024 Rates"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                <select
                  value={newSheet.agent_id}
                  onChange={(e) => setNewSheet({ ...newSheet, agent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Agent</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={newSheet.type}
                  onChange={(e) => setNewSheet({ ...newSheet, type: e.target.value as 'import' | 'export' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="import">Import</option>
                  <option value="export">Export</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Currency *</label>
                <input
                  type="text"
                  value={newSheet.base_currency}
                  onChange={(e) => setNewSheet({ ...newSheet, base_currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="USD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
                <input
                  type="date"
                  value={newSheet.effective_from}
                  onChange={(e) => setNewSheet({ ...newSheet, effective_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                <input
                  type="date"
                  value={newSheet.effective_to}
                  onChange={(e) => setNewSheet({ ...newSheet, effective_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newSheet.notes}
                  onChange={(e) => setNewSheet({ ...newSheet, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowNewSheet(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createRateSheet}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Rate Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}