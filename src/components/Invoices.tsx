import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Download, FileText, DollarSign, Calendar, CheckCircle } from 'lucide-react';

interface Invoice {
  id: string;
  job_id: string;
  invoice_type: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  currency_id: string;
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  status: string;
  agent_name: string | null;
  agent_reference: string | null;
  notes: string | null;
  created_at: string;
  jobs?: {
    job_number: string;
    customers?: { name: string };
  };
  currencies?: {
    code: string;
    symbol: string;
  };
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [jobs, setJobs] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    job_id: '',
    invoice_type: 'customer_billing',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    currency_id: '',
    subtotal: 0,
    tax: 0,
    status: 'pending',
    agent_name: '',
    agent_reference: '',
    notes: ''
  });

  useEffect(() => {
    loadInvoices();
    loadData();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_invoices')
        .select(`
          *,
          jobs(job_number, customers(name)),
          currencies(code, symbol)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [jobsRes, currenciesRes] = await Promise.all([
        supabase.from('jobs').select('id, job_number, customers(name)').order('job_number'),
        supabase.from('currencies').select('*').eq('active', true)
      ]);

      setJobs(jobsRes.data || []);
      setCurrencies(currenciesRes.data || []);

      if (!formData.currency_id && currenciesRes.data?.[0]) {
        setFormData(prev => ({ ...prev, currency_id: currenciesRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateInvoiceNumber = (type: string) => {
    const prefix = type === 'agent_billing' ? 'AI' : 'CI';
    const date = new Date();
    return `${prefix}${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const total = formData.subtotal + formData.tax;
      const invoiceData = {
        ...formData,
        total,
        paid_amount: 0,
        invoice_number: editingInvoice?.invoice_number || generateInvoiceNumber(formData.invoice_type)
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from('agent_invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_invoices')
          .insert([invoiceData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToTally = async (invoice: Invoice) => {
    try {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Sales" ACTION="Create">
            <DATE>${new Date(invoice.invoice_date).toLocaleDateString('en-GB').replace(/\//g, '')}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${invoice.invoice_number}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${invoice.invoice_type === 'agent_billing' ? invoice.agent_name : invoice.jobs?.customers?.name}</PARTYLEDGERNAME>
            <REFERENCE>${invoice.invoice_type === 'agent_billing' ? invoice.agent_reference : invoice.jobs?.job_number}</REFERENCE>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${invoice.invoice_type === 'agent_billing' ? invoice.agent_name : invoice.jobs?.customers?.name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${invoice.total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Moving Services</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Tax</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.tax.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tally_${invoice.invoice_number}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      await supabase
        .from('agent_invoices')
        .update({ tally_exported: true, tally_export_date: new Date().toISOString() })
        .eq('id', invoice.id);

      loadInvoices();
    } catch (error) {
      console.error('Error exporting to Tally:', error);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.jobs?.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.agent_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || invoice.invoice_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const stats = {
    total: invoices.reduce((sum, inv) => sum + inv.total, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0),
    pending: invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.total, 0)
  };

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
          <h1 className="text-3xl font-bold text-slate-900">Invoicing & Billing</h1>
          <p className="text-slate-600 mt-1">Manage agent and customer invoices</p>
        </div>
        <button
          onClick={() => {
            setEditingInvoice(null);
            setFormData({
              job_id: '',
              invoice_type: 'customer_billing',
              invoice_date: new Date().toISOString().split('T')[0],
              due_date: '',
              currency_id: currencies[0]?.id || '',
              subtotal: 0,
              tax: 0,
              status: 'pending',
              agent_name: '',
              agent_reference: '',
              notes: ''
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">${stats.total.toFixed(2)}</div>
          <div className="text-sm text-slate-600">Total Invoiced</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">${stats.paid.toFixed(2)}</div>
          <div className="text-sm text-slate-600">Paid</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">${stats.pending.toFixed(2)}</div>
          <div className="text-sm text-slate-600">Pending</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="customer_billing">Customer Billing</option>
              <option value="agent_billing">Agent Billing</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Customer/Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-900">{invoice.invoice_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      invoice.invoice_type === 'agent_billing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {invoice.invoice_type === 'agent_billing' ? 'Agent' : 'Customer'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        {invoice.invoice_type === 'agent_billing' ? invoice.agent_name : invoice.jobs?.customers?.name}
                      </div>
                      <div className="text-sm text-slate-600">{invoice.jobs?.job_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {invoice.currencies?.symbol}{invoice.total.toFixed(2)}
                      <span className="text-xs text-slate-600">{invoice.currencies?.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => exportToTally(invoice)}
                      className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Tally Export
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {searchQuery ? 'No invoices found matching your search' : 'No invoices yet'}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Job *</label>
                  <select
                    required
                    value={formData.job_id}
                    onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="">Select job</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.customers?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Type *</label>
                  <select
                    required
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="customer_billing">Customer Billing</option>
                    <option value="agent_billing">Agent Billing</option>
                  </select>
                </div>

                {formData.invoice_type === 'agent_billing' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Agent Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.agent_name}
                        onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Agent Reference</label>
                      <input
                        type="text"
                        value={formData.agent_reference}
                        onChange={(e) => setFormData({ ...formData, agent_reference: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Currency *</label>
                  <select
                    required
                    value={formData.currency_id}
                    onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    {currencies.map(currency => (
                      <option key={currency.id} value={currency.id}>
                        {currency.code} - {currency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Subtotal *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.subtotal}
                    onChange={(e) => setFormData({ ...formData, subtotal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tax}
                    onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partially Paid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                <div className="md:col-span-2 bg-slate-50 rounded-lg p-4">
                  <div className="text-lg font-bold text-slate-900">
                    Total: ${(formData.subtotal + formData.tax).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingInvoice(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
