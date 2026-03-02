import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateJobNumber, getJobStatusHistory } from '../lib/jobNumbering';
import { documentStorage, Document } from '../lib/documentStorage';
import { X, Plus, Trash2, DollarSign, TrendingUp, Users, Upload, Download, FileText, History, Clock } from 'lucide-react';

interface JobDetailsProps {
  job: any;
  onClose: () => void;
}

export default function JobDetails({ job, onClose }: JobDetailsProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [moveTypes, setMoveTypes] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [destinationCosts, setDestinationCosts] = useState<any[]>([]);
  const [crewAssignments, setCrewAssignments] = useState<any[]>([]);
  const [crewMembers, setCrewMembers] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'costs' | 'documents' | 'history'>('details');

  const [formData, setFormData] = useState({
    quote_id: job?.quote_id || '',
    customer_id: job?.customer_id || '',
    move_type_id: job?.move_type_id || '',
    scheduled_date: job?.scheduled_date?.split('T')[0] || '',
    completion_date: job?.completion_date?.split('T')[0] || '',
    status: job?.status || 'scheduled',
    origin_address: job?.origin_address || '',
    destination_address: job?.destination_address || '',
    notes: job?.notes || ''
  });

  const [newCost, setNewCost] = useState({
    cost_category: 'customs',
    description: '',
    cost_amount: 0,
    currency_id: '',
    billed_amount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [quotesRes, customersRes, moveTypesRes, currenciesRes, crewRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('status', 'accepted'),
        supabase.from('customers').select('*'),
        supabase.from('move_types').select('*').eq('active', true),
        supabase.from('currencies').select('*').eq('active', true),
        supabase.from('crew_members').select('*').eq('active', true)
      ]);

      setQuotes(quotesRes.data || []);
      setCustomers(customersRes.data || []);
      setMoveTypes(moveTypesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCrewMembers(crewRes.data || []);

      if (!newCost.currency_id && currenciesRes.data?.[0]) {
        setNewCost(prev => ({ ...prev, currency_id: currenciesRes.data[0].id }));
      }

      if (job) {
        const [costsRes, crewRes] = await Promise.all([
          supabase.from('destination_costs').select('*, currencies(code, symbol)').eq('job_id', job.id),
          supabase.from('crew_assignments').select('*, crew_members(name, role)').eq('job_id', job.id)
        ]);

        setDestinationCosts(costsRes.data || []);
        setCrewAssignments(crewRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateJobNumber = () => {
    const date = new Date();
    return `J${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
  };

  const loadStatusHistory = async () => {
    if (!job?.id) return;
    const history = await getJobStatusHistory(job.id);
    setStatusHistory(history);
  };

  const loadDocuments = async () => {
    if (!job?.id) return;
    try {
      const docs = await documentStorage.getDocuments('job', job.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let jobNumber = job?.job_number;

      if (!jobNumber) {
        jobNumber = await generateJobNumber();
      }

      const jobData = {
        ...formData,
        job_number: jobNumber
      };

      if (job) {
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', job.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert([jobData]);

        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!job?.id || !e.target.files?.length) return;

    const file = e.target.files[0];

    try {
      await documentStorage.uploadDocument({
        entityType: 'job',
        entityId: job.id,
        documentType: 'general',
        file
      });

      loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      await documentStorage.downloadDocument(doc);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const addDestinationCost = async () => {
    if (!job?.id || !newCost.description) return;

    try {
      const profitMargin = newCost.billed_amount - newCost.cost_amount;

      const { error } = await supabase
        .from('destination_costs')
        .insert([{
          job_id: job.id,
          ...newCost,
          profit_margin: profitMargin
        }]);

      if (error) throw error;

      setNewCost({
        cost_category: 'customs',
        description: '',
        cost_amount: 0,
        currency_id: newCost.currency_id,
        billed_amount: 0
      });

      loadData();
    } catch (error) {
      console.error('Error adding cost:', error);
    }
  };

  const deleteCost = async (costId: string) => {
    try {
      const { error } = await supabase
        .from('destination_costs')
        .delete()
        .eq('id', costId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting cost:', error);
    }
  };

  const totalCosts = destinationCosts.reduce((sum, cost) => sum + cost.cost_amount, 0);
  const totalBilled = destinationCosts.reduce((sum, cost) => sum + cost.billed_amount, 0);
  const totalProfit = totalBilled - totalCosts;
  const profitMarginPercent = totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {job ? `Job ${job.job_number}` : 'New Job'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quote</label>
                <select
                  value={formData.quote_id}
                  onChange={(e) => setFormData({ ...formData, quote_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">No quote selected</option>
                  {quotes.map(quote => (
                    <option key={quote.id} value={quote.id}>{quote.quote_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Select customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Move Type *</label>
                <select
                  required
                  value={formData.move_type_id}
                  onChange={(e) => setFormData({ ...formData, move_type_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Select move type</option>
                  {moveTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Scheduled Date</label>
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Completion Date</label>
                <input
                  type="date"
                  value={formData.completion_date}
                  onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Origin Address</label>
                <input
                  type="text"
                  value={formData.origin_address}
                  onChange={(e) => setFormData({ ...formData, origin_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Destination Address</label>
                <input
                  type="text"
                  value={formData.destination_address}
                  onChange={(e) => setFormData({ ...formData, destination_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>

            {job && (
              <>
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Destination Costs & Profitability
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-red-600 mb-1">Total Costs</div>
                      <div className="text-2xl font-bold text-red-700">${totalCosts.toFixed(2)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-blue-600 mb-1">Total Billed</div>
                      <div className="text-2xl font-bold text-blue-700">${totalBilled.toFixed(2)}</div>
                    </div>
                    <div className={`rounded-lg p-4 border ${totalProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className={`text-sm mb-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit</div>
                      <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${totalProfit.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="text-sm text-slate-600 mb-1">Margin</div>
                      <div className="text-2xl font-bold text-slate-700">{profitMarginPercent.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-slate-900 mb-3">Add Destination Cost</h4>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                      <select
                        value={newCost.cost_category}
                        onChange={(e) => setNewCost({ ...newCost, cost_category: e.target.value })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="customs">Customs</option>
                        <option value="port_handling">Port Handling</option>
                        <option value="delivery">Delivery</option>
                        <option value="storage">Storage</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description"
                        value={newCost.description}
                        onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                        className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Cost"
                        value={newCost.cost_amount}
                        onChange={(e) => setNewCost({ ...newCost, cost_amount: parseFloat(e.target.value) || 0 })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Billed"
                        value={newCost.billed_amount}
                        onChange={(e) => setNewCost({ ...newCost, billed_amount: parseFloat(e.target.value) || 0 })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={addDestinationCost}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {destinationCosts.map((cost) => (
                      <div key={cost.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                        <div className="flex-1 grid grid-cols-5 gap-4">
                          <div>
                            <div className="text-xs text-slate-500 uppercase">{cost.cost_category}</div>
                            <div className="font-medium text-slate-900">{cost.description}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Cost</div>
                            <div className="font-semibold text-red-700">
                              {cost.currencies?.symbol}{cost.cost_amount.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Billed</div>
                            <div className="font-semibold text-blue-700">
                              {cost.currencies?.symbol}{cost.billed_amount.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Profit</div>
                            <div className={`font-semibold ${cost.profit_margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {cost.currencies?.symbol}{cost.profit_margin.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Margin</div>
                            <div className="font-semibold text-slate-700">
                              {cost.cost_amount > 0 ? ((cost.profit_margin / cost.cost_amount) * 100).toFixed(1) : '0'}%
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCost(cost.id)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
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
              {loading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
