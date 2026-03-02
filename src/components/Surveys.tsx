import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SurveyForm from './SurveyForm';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Eye, Trash2, Package, FileText, Calendar, User, ArrowRight } from 'lucide-react';

export default function Surveys() {
  const { userProfile } = useAuth();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [moveTypes, setMoveTypes] = useState<any[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNewSurvey, setShowNewSurvey] = useState(false);

  const [newSurvey, setNewSurvey] = useState({
    customer_id: '',
    move_type_id: '',
    survey_date: new Date().toISOString().split('T')[0],
    survey_type: 'physical',
    survey_mode: 'manual',
    origin_address: '',
    destination_address: '',
    surveyor_name: '',
    notes: ''
  });

  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [userProfile]);

  const loadData = async () => {
    const [surveysRes, customersRes, moveTypesRes] = await Promise.all([
      supabase
        .from('surveys')
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
        .eq('active', true)
        .order('name')
    ]);

    if (surveysRes.data) setSurveys(surveysRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    if (moveTypesRes.data) setMoveTypes(moveTypesRes.data);
  };

  const handleCreateSurvey = async () => {
    if (!newSurvey.customer_id) {
      alert('Please select a customer');
      return;
    }

    console.log('Creating survey with data:', {
      ...newSurvey,
      company_id: userProfile?.company_id
    });

    const { data, error } = await supabase
      .from('surveys')
      .insert([{
        ...newSurvey,
        company_id: userProfile?.company_id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating survey:', error);
      alert(`Failed to create survey: ${error.message}`);
      return;
    }

    console.log('Survey created successfully:', data);

    setShowNewSurvey(false);
    setSelectedSurvey(data.id);
    setShowForm(true);
    loadData();
  };

  const convertToQuote = async (surveyId: string) => {
    if (!confirm('Convert this survey to a quote?')) return;

    try {
      const survey = surveys.find(s => s.id === surveyId);
      if (!survey) return;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([{
          company_id: userProfile?.company_id,
          customer_id: survey.customer_id,
          move_type_id: survey.move_type_id,
          origin: survey.origin_address,
          destination: survey.destination_address,
          total_volume: survey.total_volume_cbm,
          status: 'draft',
          quote_date: new Date().toISOString().split('T')[0],
          notes: `Converted from Survey - ${survey.notes || ''}`
        }])
        .select()
        .single();

      if (quoteError) throw quoteError;

      await supabase
        .from('surveys')
        .update({ converted_to_quote_id: quote.id })
        .eq('id', surveyId);

      alert('Survey converted to quote successfully!');
      loadData();
    } catch (error: any) {
      console.error('Error converting to quote:', error);
      alert(error.message || 'Failed to convert survey to quote');
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    if (!confirm('Delete this survey? This will also delete all associated items.')) return;

    await supabase.from('surveys').delete().eq('id', id);
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Surveys</h1>
        <button
          onClick={() => setShowNewSurvey(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Survey
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {surveys.map(survey => (
          <div key={survey.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {survey.customers?.name || 'Unknown Customer'}
                </h3>
                <p className="text-sm text-slate-600">{survey.move_types?.name}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(survey.status)}`}>
                {survey.status}
              </span>
            </div>

            <div className="space-y-2 mb-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(survey.survey_date).toLocaleDateString()}</span>
              </div>

              {survey.surveyor_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{survey.surveyor_name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{survey.total_items_count || 0} items</span>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>{survey.total_volume_cbm?.toFixed(2) || '0.00'} CBM</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedSurvey(survey.id);
                  setShowForm(true);
                }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              {!survey.converted_to_quote_id && survey.status === 'completed' && (
                <button
                  onClick={() => convertToQuote(survey.id)}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  Quote
                </button>
              )}
              <button
                onClick={() => handleDeleteSurvey(survey.id)}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {surveys.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No surveys yet</p>
            <p className="text-sm">Create your first survey to get started</p>
          </div>
        )}
      </div>

      {showNewSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Survey</h2>

            {customers.length === 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>No customers found.</strong> Please go to the <strong>Customers</strong> page to add customers first.
                </p>
              </div>
            )}

            {moveTypes.length === 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>No move types found.</strong> Move types define the type of move (Local, Domestic, Inbound, Outbound, etc.).
                  Please contact your administrator to set up move types.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer *</label>
                <select
                  value={newSurvey.customer_id}
                  onChange={(e) => setNewSurvey({ ...newSurvey, customer_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={customers.length === 0}
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">Add customers from the Customers page</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Move Type *</label>
                <select
                  value={newSurvey.move_type_id}
                  onChange={(e) => setNewSurvey({ ...newSurvey, move_type_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={moveTypes.length === 0}
                >
                  <option value="">Select Move Type</option>
                  {moveTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} {type.description && `- ${type.description}`}
                    </option>
                  ))}
                </select>
                {moveTypes.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">Examples: Local Move, Domestic Move, International Inbound, International Outbound</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Survey Date</label>
                  <input
                    type="date"
                    value={newSurvey.survey_date}
                    onChange={(e) => setNewSurvey({ ...newSurvey, survey_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Surveyor Name</label>
                  <input
                    type="text"
                    value={newSurvey.surveyor_name}
                    onChange={(e) => setNewSurvey({ ...newSurvey, surveyor_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Origin Address</label>
                <input
                  type="text"
                  value={newSurvey.origin_address}
                  onChange={(e) => setNewSurvey({ ...newSurvey, origin_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Destination Address</label>
                <input
                  type="text"
                  value={newSurvey.destination_address}
                  onChange={(e) => setNewSurvey({ ...newSurvey, destination_address: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  rows={3}
                  value={newSurvey.notes}
                  onChange={(e) => setNewSurvey({ ...newSurvey, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewSurvey(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSurvey}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create & Start Survey
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && selectedSurvey && (
        <SurveyForm
          surveyId={selectedSurvey}
          onClose={() => {
            setShowForm(false);
            setSelectedSurvey(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
