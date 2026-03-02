import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, DollarSign, Download, Eye, CheckCircle, Clock, AlertCircle, IndianRupee } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: 'agent' | 'local_client';
  shipment_draft_id: string;
  bill_to_name: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  total_inr: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  invoice_status: 'draft' | 'sent' | 'paid';
  draft_number?: string;
}

interface InvoiceItem {
  line_number: number;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface MiscCharge {
  id?: string;
  charge_type: string;
  description: string;
  amount: number;
  currency: string;
  quantity: number;
  unit_price: number;
  bill_to: 'agent' | 'client' | 'both';
  is_billable: boolean;
}

export default function BillingInvoices() {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    shipment_id: '',
    invoice_type: 'agent' as 'agent' | 'local_client'
  });

  const [chargeForm, setChargeForm] = useState<MiscCharge>({
    charge_type: 'labor',
    description: '',
    amount: 0,
    currency: 'INR',
    quantity: 1,
    unit_price: 0,
    bill_to: 'client',
    is_billable: true
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'bank_transfer',
    transaction_reference: '',
    bank_exchange_rate: 0,
    actual_inr_amount: 0
  });

  useEffect(() => {
    fetchInvoices();
    fetchShipments();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('shipment_invoices')
      .select(`
        *,
        shipment_drafts!inner(draft_number)
      `)
      .order('invoice_date', { ascending: false });

    if (!error && data) {
      const formatted = data.map(inv => ({
        ...inv,
        draft_number: inv.shipment_drafts?.draft_number
      }));
      setInvoices(formatted);
    }
  };

  const fetchShipments = async () => {
    const { data } = await supabase
      .from('shipment_drafts')
      .select('id, draft_number, client_name, agent_name, status')
      .in('status', ['warehouse_received', 'ready_for_delivery', 'delivered'])
      .order('created_at', { ascending: false });

    if (data) setShipments(data);
  };

  const fetchInvoiceDetails = async (invoiceId: string) => {
    const { data: invoice } = await supabase
      .from('shipment_invoices')
      .select('*, shipment_drafts!inner(draft_number)')
      .eq('id', invoiceId)
      .single();

    const { data: items } = await supabase
      .from('shipment_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('line_number');

    if (invoice) {
      setSelectedInvoice({
        ...invoice,
        draft_number: invoice.shipment_drafts?.draft_number
      });
    }
    if (items) setInvoiceItems(items);
  };

  const generateInvoice = async () => {
    setLoading(true);
    const functionName = createForm.invoice_type === 'agent'
      ? 'create_agent_invoice'
      : 'create_local_invoice';

    const { data, error } = await supabase.rpc(functionName, {
      p_shipment_id: createForm.shipment_id
    });

    setLoading(false);

    if (error) {
      alert('Error generating invoice: ' + error.message);
      return;
    }

    if (data?.success) {
      alert(`Invoice ${data.invoice_number} generated successfully!`);
      setView('list');
      fetchInvoices();
    } else {
      alert('Error: ' + (data?.error || 'Unknown error'));
    }
  };

  const addMiscCharge = async () => {
    if (!createForm.shipment_id || !chargeForm.description) {
      alert('Please select shipment and enter description');
      return;
    }

    const { error } = await supabase
      .from('miscellaneous_charges')
      .insert([{
        shipment_draft_id: createForm.shipment_id,
        ...chargeForm,
        amount: chargeForm.quantity * chargeForm.unit_price
      }]);

    if (error) {
      alert('Error adding charge: ' + error.message);
    } else {
      alert('Charge added successfully!');
      setChargeForm({
        charge_type: 'labor',
        description: '',
        amount: 0,
        currency: 'INR',
        quantity: 1,
        unit_price: 0,
        bill_to: 'client',
        is_billable: true
      });
    }
  };

  const recordPayment = async () => {
    if (!selectedInvoice || paymentForm.amount <= 0) {
      alert('Please enter valid payment amount');
      return;
    }

    if (selectedInvoice.currency !== 'INR' && (!paymentForm.bank_exchange_rate || !paymentForm.actual_inr_amount)) {
      alert('Please enter bank exchange rate and actual INR amount received');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('record_payment_with_forex', {
      p_invoice_id: selectedInvoice.id,
      p_amount: paymentForm.amount,
      p_currency: selectedInvoice.currency,
      p_bank_rate: paymentForm.bank_exchange_rate || 1,
      p_actual_inr: paymentForm.actual_inr_amount || paymentForm.amount,
      p_payment_date: new Date().toISOString().split('T')[0],
      p_method: paymentForm.payment_method
    });

    setLoading(false);

    if (error) {
      alert('Error recording payment: ' + error.message);
    } else if (data?.success) {
      const forexMsg = data.forex_gain_loss !== 0
        ? `\nForex ${data.forex_gain_loss > 0 ? 'Gain' : 'Loss'}: ₹${Math.abs(data.forex_gain_loss).toFixed(2)}`
        : '';
      alert(`Payment recorded successfully!${forexMsg}`);
      fetchInvoiceDetails(selectedInvoice.id);
      setPaymentForm({ amount: 0, payment_method: 'bank_transfer', transaction_reference: '', bank_exchange_rate: 0, actual_inr_amount: 0 });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      unpaid: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800'
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Generate Invoice</h2>
          <button
            onClick={() => setView('list')}
            className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Back to List
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Type
              </label>
              <select
                value={createForm.invoice_type}
                onChange={(e) => setCreateForm({...createForm, invoice_type: e.target.value as any})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="agent">Agent Invoice (Foreign Currency)</option>
                <option value="local_client">Local Client Invoice (INR)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Shipment
              </label>
              <select
                value={createForm.shipment_id}
                onChange={(e) => setCreateForm({...createForm, shipment_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Choose shipment...</option>
                {shipments.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.draft_number} - {s.client_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {createForm.invoice_type === 'local_client' && createForm.shipment_id && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Add Miscellaneous Charges</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Charge Type
                  </label>
                  <select
                    value={chargeForm.charge_type}
                    onChange={(e) => setChargeForm({...chargeForm, charge_type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="labor">Extra Labor</option>
                    <option value="insurance">Insurance</option>
                    <option value="duty">Custom Duty</option>
                    <option value="special_service">Special Service</option>
                    <option value="packaging">Packaging Material</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bill To
                  </label>
                  <select
                    value={chargeForm.bill_to}
                    onChange={(e) => setChargeForm({...chargeForm, bill_to: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="client">Client</option>
                    <option value="agent">Agent</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={chargeForm.description}
                    onChange={(e) => setChargeForm({...chargeForm, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Extra labor for unpacking"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={chargeForm.quantity}
                    onChange={(e) => setChargeForm({...chargeForm, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    value={chargeForm.unit_price}
                    onChange={(e) => setChargeForm({...chargeForm, unit_price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <span className="text-lg font-semibold">
                    Total: ₹{(chargeForm.quantity * chargeForm.unit_price).toFixed(2)}
                  </span>
                  <button
                    onClick={addMiscCharge}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Charge
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={generateInvoice}
              disabled={!createForm.shipment_id || loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedInvoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
          <button
            onClick={() => { setView('list'); setSelectedInvoice(null); }}
            className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Back to List
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="border-b pb-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedInvoice.invoice_number}</h3>
                <p className="text-sm text-gray-500">
                  {selectedInvoice.invoice_type === 'agent' ? 'Agent Invoice' : 'Local Client Invoice'}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(selectedInvoice.payment_status)}`}>
                  {selectedInvoice.payment_status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Bill To:</span>
                <p className="font-medium">{selectedInvoice.bill_to_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Invoice Date:</span>
                <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Due Date:</span>
                <p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Shipment:</span>
                <p className="font-medium">{selectedInvoice.draft_number}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-3">Line Items</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map(item => (
                    <tr key={item.line_number} className="border-t">
                      <td className="px-4 py-3 text-sm">{item.line_number}</td>
                      <td className="px-4 py-3 text-sm">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(item.unit_price, selectedInvoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(item.amount, selectedInvoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
              </div>
              {selectedInvoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({selectedInvoice.currency === 'INR' ? 'GST 18%' : 'Tax'}):</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.tax_amount, selectedInvoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}</span>
              </div>
              {selectedInvoice.currency !== 'INR' && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>INR Equivalent:</span>
                  <span>₹{selectedInvoice.total_inr?.toFixed(2)}</span>
                </div>
              )}
              {selectedInvoice.paid_amount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Paid:</span>
                    <span>-{formatCurrency(selectedInvoice.paid_amount, selectedInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-red-600 border-t pt-2">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(selectedInvoice.balance_due, selectedInvoice.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {selectedInvoice.payment_status !== 'paid' && (
            <div className="mt-6 border-t pt-6">
              <h4 className="font-semibold mb-3">Record Payment</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({selectedInvoice.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                    <option value="credit_card">Credit Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transaction Ref
                  </label>
                  <input
                    type="text"
                    value={paymentForm.transaction_reference}
                    onChange={(e) => setPaymentForm({...paymentForm, transaction_reference: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {selectedInvoice.currency !== 'INR' && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h5 className="font-semibold text-amber-900 mb-3">Forex Conversion Details</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Exchange Rate
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentForm.bank_exchange_rate}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          setPaymentForm({
                            ...paymentForm,
                            bank_exchange_rate: rate,
                            actual_inr_amount: paymentForm.amount * rate
                          });
                        }}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={`e.g., ${selectedInvoice.exchange_rate}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Invoice rate: {selectedInvoice.exchange_rate}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Actual INR Received
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentForm.actual_inr_amount}
                        onChange={(e) => setPaymentForm({...paymentForm, actual_inr_amount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Expected: ₹{(paymentForm.amount * selectedInvoice.exchange_rate).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {paymentForm.bank_exchange_rate > 0 && paymentForm.actual_inr_amount > 0 && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Forex Impact:</span>
                        <span className={`text-sm font-bold ${
                          paymentForm.actual_inr_amount - (paymentForm.amount * selectedInvoice.exchange_rate) > 0
                            ? 'text-green-600'
                            : paymentForm.actual_inr_amount - (paymentForm.amount * selectedInvoice.exchange_rate) < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {paymentForm.actual_inr_amount - (paymentForm.amount * selectedInvoice.exchange_rate) > 0 ? 'Gain: ' : 'Loss: '}
                          ₹{Math.abs(paymentForm.actual_inr_amount - (paymentForm.amount * selectedInvoice.exchange_rate)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={recordPayment}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Recording...' : 'Record Payment'}
                </button>
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
        <h2 className="text-2xl font-bold text-gray-900">Billing & Invoices</h2>
        <button
          onClick={() => setView('create')}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold">{invoices.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <p className="text-2xl font-bold text-green-600">
                {invoices.filter(i => i.payment_status === 'paid').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {invoices.filter(i => i.payment_status === 'partial').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unpaid</p>
              <p className="text-2xl font-bold text-red-600">
                {invoices.filter(i => i.payment_status === 'unpaid').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map(invoice => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{invoice.invoice_number}</div>
                  <div className="text-xs text-gray-500">{invoice.draft_number}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    invoice.invoice_type === 'agent'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {invoice.invoice_type === 'agent' ? 'Agent' : 'Local Client'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{invoice.bill_to_name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <div className="font-medium">{formatCurrency(invoice.total_amount, invoice.currency)}</div>
                  {invoice.currency !== 'INR' && (
                    <div className="text-xs text-gray-500">₹{invoice.total_inr?.toFixed(2)}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(invoice.payment_status)}`}>
                    {invoice.payment_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => {
                      setView('detail');
                      fetchInvoiceDetails(invoice.id);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {invoices.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No invoices yet</p>
            <button
              onClick={() => setView('create')}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Generate your first invoice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
