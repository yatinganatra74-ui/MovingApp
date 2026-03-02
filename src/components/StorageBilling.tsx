import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, FileText, Plus, Eye, X, Check, Clock, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StorageRateSheet {
  id: string;
  name: string;
  currency: string;
  free_days: number;
  base_unit: string;
  billing_cycle: string;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
}

interface StorageRateSlab {
  id?: string;
  from_days: number;
  to_days: number | null;
  rate_per_unit_per_month: number;
  rate_per_unit_per_day: number | null;
}

interface StorageInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  arrival_date: string;
  delivery_date: string;
  free_days: number;
  chargeable_days: number;
  chargeable_months: number;
  billing_quantity: number;
  billing_unit: string;
  rate_per_unit_per_month: number;
  subtotal: number;
  total_amount: number;
  currency: string;
  amount_in_inr: number;
  status: string;
  rate_sheet_name: string;
}

export default function StorageBilling() {
  const { user } = useAuth();
  const [rateSheets, setRateSheets] = useState<StorageRateSheet[]>([]);
  const [invoices, setInvoices] = useState<StorageInvoice[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);

  const [showNewRateSheet, setShowNewRateSheet] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'invoices' | 'rates'>('invoices');

  const [newRateSheet, setNewRateSheet] = useState({
    name: '',
    currency: 'USD',
    free_days: 7,
    base_unit: 'cbm',
    billing_cycle: 'monthly',
    effective_from: new Date().toISOString().split('T')[0],
  });

  const [slabs, setSlabs] = useState<StorageRateSlab[]>([
    { from_days: 1, to_days: 30, rate_per_unit_per_month: 0, rate_per_unit_per_day: null },
  ]);

  const [newInvoice, setNewInvoice] = useState({
    customer_id: '',
    rate_sheet_id: '',
    arrival_date: '',
    delivery_date: '',
    volume_cbm: 0,
    weight_kg: 0,
  });

  const [calculatedCharges, setCalculatedCharges] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (newInvoice.arrival_date && newInvoice.delivery_date && newInvoice.rate_sheet_id && newInvoice.volume_cbm > 0) {
      calculateCharges();
    }
  }, [newInvoice.arrival_date, newInvoice.delivery_date, newInvoice.rate_sheet_id, newInvoice.volume_cbm, newInvoice.weight_kg]);

  const loadData = async () => {
    const [rateSheetsRes, invoicesRes, customersRes, ratesRes] = await Promise.all([
      supabase.from('storage_rate_sheets').select('*').order('created_at', { ascending: false }),
      supabase.from('storage_invoice_summary').select('*').order('invoice_date', { ascending: false }),
      supabase.from('customers').select('id, name, email').order('name'),
      supabase.from('exchange_rates').select('*').order('effective_date', { ascending: false }),
    ]);

    if (rateSheetsRes.data) setRateSheets(rateSheetsRes.data);
    if (invoicesRes.data) setInvoices(invoicesRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    if (ratesRes.data) setExchangeRates(ratesRes.data);
  };

  const calculateCharges = async () => {
    const rateSheet = rateSheets.find(rs => rs.id === newInvoice.rate_sheet_id);
    if (!rateSheet) return;

    const { data, error } = await supabase.rpc('calculate_storage_charges', {
      p_arrival_date: newInvoice.arrival_date,
      p_delivery_date: newInvoice.delivery_date,
      p_free_days: rateSheet.free_days,
      p_rate_sheet_id: newInvoice.rate_sheet_id,
      p_volume_cbm: newInvoice.volume_cbm,
      p_weight_kg: newInvoice.weight_kg || null,
    });

    if (error) {
      console.error('Error calculating charges:', error);
      return;
    }

    if (data && data.length > 0) {
      setCalculatedCharges(data[0]);
    }
  };

  const createRateSheet = async () => {
    if (!newRateSheet.name || slabs.length === 0) {
      alert('Please fill in all required fields and add at least one slab');
      return;
    }

    const { data, error } = await supabase
      .from('storage_rate_sheets')
      .insert([newRateSheet])
      .select()
      .single();

    if (error) {
      console.error('Error creating rate sheet:', error);
      alert('Failed to create rate sheet');
      return;
    }

    const slabsToInsert = slabs.map(slab => ({
      storage_rate_sheet_id: data.id,
      from_days: slab.from_days,
      to_days: slab.to_days,
      rate_per_unit_per_month: slab.rate_per_unit_per_month,
      rate_per_unit_per_day: slab.rate_per_unit_per_day || slab.rate_per_unit_per_month / 30,
    }));

    const { error: slabError } = await supabase
      .from('storage_rate_slabs')
      .insert(slabsToInsert);

    if (slabError) {
      console.error('Error creating slabs:', slabError);
      alert('Failed to create rate slabs');
      return;
    }

    await loadData();
    setShowNewRateSheet(false);
    setNewRateSheet({
      name: '',
      currency: 'USD',
      free_days: 7,
      base_unit: 'cbm',
      billing_cycle: 'monthly',
      effective_from: new Date().toISOString().split('T')[0],
    });
    setSlabs([{ from_days: 1, to_days: 30, rate_per_unit_per_month: 0, rate_per_unit_per_day: null }]);
  };

  const generateInvoice = async () => {
    if (!newInvoice.customer_id || !newInvoice.rate_sheet_id || !newInvoice.arrival_date || !newInvoice.delivery_date) {
      alert('Please fill in all required fields');
      return;
    }

    const { data, error } = await supabase.rpc('generate_storage_invoice', {
      p_shipment_id: null,
      p_arrival_date: newInvoice.arrival_date,
      p_delivery_date: newInvoice.delivery_date,
      p_volume_cbm: newInvoice.volume_cbm,
      p_weight_kg: newInvoice.weight_kg || 0,
      p_customer_id: newInvoice.customer_id,
      p_rate_sheet_id: newInvoice.rate_sheet_id,
      p_created_by: user?.id,
    });

    if (error) {
      console.error('Error generating invoice:', error);
      alert('Failed to generate invoice: ' + error.message);
      return;
    }

    await loadData();
    setShowNewInvoice(false);
    setNewInvoice({
      customer_id: '',
      rate_sheet_id: '',
      arrival_date: '',
      delivery_date: '',
      volume_cbm: 0,
      weight_kg: 0,
    });
    setCalculatedCharges(null);
  };

  const viewInvoiceDetails = async (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setShowInvoiceDetails(true);

    const { data } = await supabase
      .from('storage_invoice_line_items')
      .select('*')
      .eq('storage_invoice_id', invoiceId);

    if (data) setInvoiceLineItems(data);
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    const updates: any = { status };
    if (status === 'paid') {
      updates.paid_date = new Date().toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from('storage_invoices')
      .update(updates)
      .eq('id', invoiceId);

    if (error) {
      console.error('Error updating invoice:', error);
      return;
    }

    await loadData();
  };

  const addSlab = () => {
    setSlabs([...slabs, { from_days: 1, to_days: null, rate_per_unit_per_month: 0, rate_per_unit_per_day: null }]);
  };

  const updateSlab = (index: number, field: keyof StorageRateSlab, value: any) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], [field]: value };
    setSlabs(updated);
  };

  const removeSlab = (index: number) => {
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (inv.amount_in_inr || 0), 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + (inv.amount_in_inr || 0), 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount_in_inr || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Storage Billing</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-2 rounded-lg ${activeTab === 'rates' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Rate Sheets
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{totalInvoiceAmount.toFixed(0)} INR</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-orange-600">{pendingAmount.toFixed(0)} INR</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-2xl font-bold text-green-600">{paidAmount.toFixed(0)} INR</p>
            </div>
            <Check className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {activeTab === 'invoices' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewInvoice(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Generate Invoice
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{invoice.invoice_number}</div>
                        <div className="text-xs text-gray-500">{invoice.rate_sheet_name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{invoice.customer_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{new Date(invoice.arrival_date).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">to {new Date(invoice.delivery_date).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900">{invoice.chargeable_days} days</div>
                        <div className="text-xs text-gray-500">{invoice.chargeable_months} months</div>
                        <div className="text-xs text-green-600">{invoice.free_days} free</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {invoice.billing_quantity} {invoice.billing_unit.toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{invoice.amount_in_inr.toFixed(2)} INR</div>
                        <div className="text-xs text-gray-500">
                          {invoice.total_amount.toFixed(2)} {invoice.currency}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewInvoiceDetails(invoice.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {invoice.status === 'pending' && (
                            <button
                              onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'rates' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewRateSheet(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Rate Sheet
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rateSheets.map((rateSheet) => (
              <div key={rateSheet.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{rateSheet.name}</h3>
                    <p className="text-sm text-gray-500">{rateSheet.currency}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rateSheet.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {rateSheet.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Free Days:</span>
                    <span className="font-medium">{rateSheet.free_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Billing Unit:</span>
                    <span className="font-medium">{rateSheet.base_unit.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cycle:</span>
                    <span className="font-medium">{rateSheet.billing_cycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Effective From:</span>
                    <span className="font-medium">{new Date(rateSheet.effective_from).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showNewRateSheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create Storage Rate Sheet</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newRateSheet.name}
                    onChange={(e) => setNewRateSheet({ ...newRateSheet, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Dubai Warehouse Storage 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    value={newRateSheet.currency}
                    onChange={(e) => setNewRateSheet({ ...newRateSheet, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Free Days *</label>
                  <input
                    type="number"
                    value={newRateSheet.free_days}
                    onChange={(e) => setNewRateSheet({ ...newRateSheet, free_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Unit *</label>
                  <select
                    value={newRateSheet.base_unit}
                    onChange={(e) => setNewRateSheet({ ...newRateSheet, base_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cbm">CBM</option>
                    <option value="weight">Weight (KG)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={newRateSheet.effective_from}
                    onChange={(e) => setNewRateSheet({ ...newRateSheet, effective_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">Rate Slabs</h4>
                  <button
                    type="button"
                    onClick={addSlab}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Slab
                  </button>
                </div>

                <div className="space-y-2">
                  {slabs.map((slab, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-lg">
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="From days"
                          value={slab.from_days}
                          onChange={(e) => updateSlab(index, 'from_days', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="To days (blank = unlimited)"
                          value={slab.to_days || ''}
                          onChange={(e) => updateSlab(index, 'to_days', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate per unit per month"
                          value={slab.rate_per_unit_per_month}
                          onChange={(e) => updateSlab(index, 'rate_per_unit_per_month', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlab(index)}
                        className="col-span-1 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowNewRateSheet(false)}
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

      {showNewInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Generate Storage Invoice</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                  <select
                    value={newInvoice.customer_id}
                    onChange={(e) => setNewInvoice({ ...newInvoice, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Sheet *</label>
                  <select
                    value={newInvoice.rate_sheet_id}
                    onChange={(e) => setNewInvoice({ ...newInvoice, rate_sheet_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Rate Sheet</option>
                    {rateSheets.filter(rs => rs.is_active).map(rs => (
                      <option key={rs.id} value={rs.id}>{rs.name} ({rs.currency})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date *</label>
                  <input
                    type="date"
                    value={newInvoice.arrival_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, arrival_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date *</label>
                  <input
                    type="date"
                    value={newInvoice.delivery_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Volume (CBM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newInvoice.volume_cbm || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, volume_cbm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newInvoice.weight_kg || ''}
                    onChange={(e) => setNewInvoice({ ...newInvoice, weight_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {calculatedCharges && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Calculated Charges</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-blue-700">Total Days:</p>
                      <p className="font-medium text-blue-900">{calculatedCharges.total_days} days</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Chargeable Days:</p>
                      <p className="font-medium text-blue-900">{calculatedCharges.chargeable_days} days</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Chargeable Months:</p>
                      <p className="font-medium text-blue-900">{calculatedCharges.chargeable_months} months</p>
                    </div>
                    <div>
                      <p className="text-blue-700">Rate/Unit/Month:</p>
                      <p className="font-medium text-blue-900">{calculatedCharges.rate_per_unit_per_month}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-blue-700">Subtotal:</p>
                      <p className="text-xl font-bold text-blue-900">{calculatedCharges.subtotal}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowNewInvoice(false);
                    setCalculatedCharges(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Generate Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvoiceDetails && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Invoice Details</h3>
              <button
                onClick={() => {
                  setShowInvoiceDetails(false);
                  setSelectedInvoice(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {invoiceLineItems.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">{item.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Period:</p>
                      <p className="font-medium">
                        {new Date(item.from_date).toLocaleDateString()} - {new Date(item.to_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Days:</p>
                      <p className="font-medium">{item.days} days</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Quantity:</p>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Rate:</p>
                      <p className="font-medium">{item.rate}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Amount:</p>
                      <p className="text-lg font-bold text-gray-900">{item.amount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}