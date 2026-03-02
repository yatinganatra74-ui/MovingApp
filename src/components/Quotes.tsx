import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, X, Search, DollarSign, Calendar, Building2, MapPin, ArrowRight, CheckCircle } from 'lucide-react';

interface Quote {
  id: string;
  company_id: string;
  customer_id: string;
  move_type_id?: string;
  origin: string;
  destination: string;
  total_volume?: number;
  total_price?: number;
  status: string;
  quote_date: string;
  valid_until?: string;
  notes?: string;
  converted_to_job_id?: string;
  customers?: { name: string };
  move_types?: { name: string };
}

export default function Quotes() {
  const { userProfile } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [moveTypes, setMoveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    customer_id: '',
    move_type_id: '',
    origin: '',
    destination: '',
    total_volume: '',
    total_price: '',
    quote_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: ''
  });

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
  }, [userProfile]);

  useEffect(() => {
    filterQuotes();
  }, [quotes, searchTerm, statusFilter]);

  const fetchData = async () => {
    try {
      const [quotesRes, customersRes, moveTypesRes] = await Promise.all([
        supabase
          .from('quotes')
          .select('*, customers(name), move_types(name)')
          .eq('company_id', userProfile?.company_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', userProfile?.company_id)
          .order('name'),
        supabase
          .from('move_types')
          .select('*')
          .eq('company_id', userProfile?.company_id)
          .eq('active', true)
      ]);

      if (quotesRes.error) throw quotesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (moveTypesRes.error) throw moveTypesRes.error;

      setQuotes(quotesRes.data || []);
      setCustomers(customersRes.data || []);
      setMoveTypes(moveTypesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQuotes = () => {
    let filtered = [...quotes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(quote =>
        quote.customers?.name.toLowerCase().includes(term) ||
        quote.origin.toLowerCase().includes(term) ||
        quote.destination.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(quote => quote.status === statusFilter);
    }

    setFilteredQuotes(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('quotes').insert([{
        company_id: userProfile?.company_id,
        customer_id: formData.customer_id,
        move_type_id: formData.move_type_id || null,
        origin: formData.origin,
        destination: formData.destination,
        total_volume: formData.total_volume ? parseFloat(formData.total_volume) : null,
        total_price: formData.total_price ? parseFloat(formData.total_price) : null,
        quote_date: formData.quote_date,
        valid_until: formData.valid_until || null,
        notes: formData.notes || null,
        status: 'draft'
      }]);

      if (error) throw error;

      setFormData({
        customer_id: '',
        move_type_id: '',
        origin: '',
        destination: '',
        total_volume: '',
        total_price: '',
        quote_date: new Date().toISOString().split('T')[0],
        valid_until: '',
        notes: ''
      });
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Error creating quote:', error);
      alert('Failed to create quote');
    }
  };

  const updateQuoteStatus = async (quoteId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating quote status:', error);
    }
  };

  const convertToJob = async (quoteId: string) => {
    if (!confirm('Convert this quote to a job?')) return;

    try {
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) return;

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          company_id: userProfile?.company_id,
          customer_id: quote.customer_id,
          move_type_id: quote.move_type_id,
          origin: quote.origin,
          destination: quote.destination,
          status: 'pending',
          total_price: quote.total_price,
          notes: `Converted from Quote - ${quote.notes || ''}`
        }])
        .select()
        .single();

      if (jobError) throw jobError;

      await supabase
        .from('quotes')
        .update({
          converted_to_job_id: job.id,
          status: 'accepted'
        })
        .eq('id', quoteId);

      alert('Quote converted to job successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error converting to job:', error);
      alert(error.message || 'Failed to convert quote to job');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalValue: quotes.reduce((sum, q) => sum + (q.total_price || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quotes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quotes</h2>
          <p className="text-gray-600">Manage customer quotes and proposals</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          New Quote
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Quotes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
            </div>
            <FileText className="h-8 w-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sent</p>
              <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalValue.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Details</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{quote.customers?.name}</p>
                      {quote.move_types && (
                        <p className="text-sm text-gray-600">{quote.move_types.name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p className="text-gray-900 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {quote.origin}
                      </p>
                      <p className="text-gray-600 flex items-center gap-1 pl-4">
                        → {quote.destination}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {quote.total_volume && (
                        <p className="text-gray-900">{quote.total_volume} CBM</p>
                      )}
                      {quote.total_price && (
                        <p className="text-green-600 font-semibold">
                          ${quote.total_price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p className="text-gray-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(quote.quote_date).toLocaleDateString()}
                      </p>
                      {quote.valid_until && (
                        <p className="text-gray-600">
                          Valid until {new Date(quote.valid_until).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={quote.status}
                      onChange={(e) => updateQuoteStatus(quote.id, e.target.value)}
                      disabled={quote.converted_to_job_id !== null}
                      className={`text-xs font-medium rounded-full px-3 py-1 border-0 ${getStatusColor(quote.status)}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {quote.status === 'accepted' && !quote.converted_to_job_id && (
                      <button
                        onClick={() => convertToJob(quote.id)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center gap-1"
                      >
                        <ArrowRight className="h-3 w-3" />
                        Job
                      </button>
                    )}
                    {quote.converted_to_job_id && (
                      <span className="text-xs text-green-600">Converted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredQuotes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No quotes found
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Quote</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Move Type
                  </label>
                  <select
                    value={formData.move_type_id}
                    onChange={(e) => setFormData({ ...formData, move_type_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Move Type</option>
                    {moveTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origin *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Volume (CBM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_volume}
                    onChange={(e) => setFormData({ ...formData, total_volume: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total_price}
                    onChange={(e) => setFormData({ ...formData, total_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.quote_date}
                    onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
