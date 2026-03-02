import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Search, Phone, Mail, Building2, Calendar, TrendingUp, Filter, X, CheckCircle, Users } from 'lucide-react';

interface Lead {
  id: string;
  company_id: string;
  lead_source: string;
  status: string;
  contact_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  move_type?: string;
  estimated_volume_cbm?: number;
  move_date?: string;
  lead_score: number;
  assigned_to?: string;
  notes?: string;
  vehicle_types?: string[];
  vehicle_quantities?: { motorbike?: number; motorcar?: number };
  created_at: string;
}

interface LeadFormData {
  lead_source: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  move_type: string;
  estimated_volume_cbm: string;
  move_date: string;
  notes: string;
  vehicle_types: string[];
  vehicle_quantities: { motorbike: number; motorcar: number };
}

export default function Leads() {
  const { user, userProfile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const [formData, setFormData] = useState<LeadFormData>({
    lead_source: 'website',
    contact_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    move_type: 'local_move',
    estimated_volume_cbm: '',
    move_date: '',
    notes: '',
    vehicle_types: [],
    vehicle_quantities: { motorbike: 0, motorcar: 0 }
  });

  useEffect(() => {
    if (userProfile) {
      fetchLeads();
    }
  }, [userProfile]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userProfile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.contact_name.toLowerCase().includes(term) ||
        lead.company_name?.toLowerCase().includes(term) ||
        lead.email?.toLowerCase().includes(term) ||
        lead.phone?.includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(lead => lead.lead_source === sourceFilter);
    }

    setFilteredLeads(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('leads').insert([{
        company_id: userProfile?.company_id,
        lead_source: formData.lead_source,
        contact_name: formData.contact_name,
        company_name: formData.company_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        move_type: formData.move_type || null,
        estimated_volume_cbm: formData.estimated_volume_cbm ? parseFloat(formData.estimated_volume_cbm) : null,
        move_date: formData.move_date || null,
        notes: formData.notes || null,
        vehicle_types: formData.move_type === 'automobile_move' ? formData.vehicle_types : null,
        vehicle_quantities: formData.move_type === 'automobile_move' ? formData.vehicle_quantities : null,
        assigned_to: user?.id
      }]);

      if (error) throw error;

      setFormData({
        lead_source: 'website',
        contact_name: '',
        company_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        move_type: 'local_move',
        estimated_volume_cbm: '',
        move_date: '',
        notes: '',
        vehicle_types: [],
        vehicle_quantities: { motorbike: 0, motorcar: 0 }
      });
      setShowForm(false);
      fetchLeads();
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Failed to create lead');
    }
  };

  const convertToCustomer = async (leadId: string) => {
    if (!confirm('Convert this lead to a customer?')) return;

    try {
      const { data, error } = await supabase.rpc('convert_lead_to_customer', {
        p_lead_id: leadId,
        p_company_id: userProfile?.company_id,
        p_converted_by: user?.id
      });

      if (error) throw error;

      alert('Lead successfully converted to customer!');
      fetchLeads();
    } catch (error: any) {
      console.error('Error converting lead:', error);
      alert(error.message || 'Failed to convert lead');
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'unqualified': return 'bg-red-100 text-red-800';
      case 'converted': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600 font-bold';
    if (score >= 50) return 'text-yellow-600 font-semibold';
    return 'text-red-600';
  };

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lead Management</h2>
          <p className="text-gray-600">Capture and nurture potential customers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="h-5 w-5" />
          New Lead
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">New Leads</p>
              <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
            </div>
            <UserPlus className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Qualified</p>
              <p className="text-2xl font-bold text-green-600">{stats.qualified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Converted</p>
              <p className="text-2xl font-bold text-purple-600">{stats.converted}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search leads..."
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
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="unqualified">Unqualified</option>
            <option value="converted">Converted</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Sources</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="social">Social Media</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Source</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Move Info</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Score</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{lead.contact_name}</p>
                      {lead.company_name && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {lead.company_name}
                        </p>
                      )}
                      {lead.email && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </p>
                      )}
                      {lead.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      {lead.lead_source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {lead.move_type && (
                        <p className="text-gray-900 capitalize">{lead.move_type}</p>
                      )}
                      {lead.estimated_volume_cbm && (
                        <p className="text-gray-600">{lead.estimated_volume_cbm} CBM</p>
                      )}
                      {lead.move_date && (
                        <p className="text-gray-600 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(lead.move_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span className={getScoreColor(lead.lead_score)}>
                        {lead.lead_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                      disabled={lead.status === 'converted'}
                      className={`text-xs font-medium rounded-full px-3 py-1 border-0 ${getStatusColor(lead.status)}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="unqualified">Unqualified</option>
                      <option value="converted">Converted</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {lead.status === 'qualified' && (
                      <button
                        onClick={() => convertToCustomer(lead.id)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Convert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No leads found
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Lead</h3>
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
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Source *
                  </label>
                  <select
                    required
                    value={formData.lead_source}
                    onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="social">Social Media</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Move Type
                  </label>
                  <select
                    value={formData.move_type}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        move_type: e.target.value,
                        vehicle_types: e.target.value === 'automobile_move' ? formData.vehicle_types : [],
                        vehicle_quantities: e.target.value === 'automobile_move' ? formData.vehicle_quantities : { motorbike: 0, motorcar: 0 }
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="local_move">Local Move</option>
                    <option value="office_move">Office Move</option>
                    <option value="inbound_move">Inbound Move</option>
                    <option value="outbound_move">Outbound Move</option>
                    <option value="automobile_move">Automobile Move</option>
                  </select>
                </div>

                {formData.move_type === 'automobile_move' && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Types *
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.vehicle_types.includes('motorbike')}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...formData.vehicle_types, 'motorbike']
                                : formData.vehicle_types.filter(t => t !== 'motorbike');
                              setFormData({
                                ...formData,
                                vehicle_types: newTypes,
                                vehicle_quantities: {
                                  ...formData.vehicle_quantities,
                                  motorbike: e.target.checked ? 1 : 0
                                }
                              });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span>Motorbike</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.vehicle_types.includes('motorcar')}
                            onChange={(e) => {
                              const newTypes = e.target.checked
                                ? [...formData.vehicle_types, 'motorcar']
                                : formData.vehicle_types.filter(t => t !== 'motorcar');
                              setFormData({
                                ...formData,
                                vehicle_types: newTypes,
                                vehicle_quantities: {
                                  ...formData.vehicle_quantities,
                                  motorcar: e.target.checked ? 1 : 0
                                }
                              });
                            }}
                            className="rounded border-gray-300"
                          />
                          <span>Motorcar</span>
                        </label>
                      </div>
                    </div>

                    {formData.vehicle_types.includes('motorbike') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Motorbikes *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.vehicle_quantities.motorbike}
                          onChange={(e) => setFormData({
                            ...formData,
                            vehicle_quantities: {
                              ...formData.vehicle_quantities,
                              motorbike: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    )}

                    {formData.vehicle_types.includes('motorcar') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Motorcars *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.vehicle_quantities.motorcar}
                          onChange={(e) => setFormData({
                            ...formData,
                            vehicle_quantities: {
                              ...formData.vehicle_quantities,
                              motorcar: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Volume (CBM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_volume_cbm}
                    onChange={(e) => setFormData({ ...formData, estimated_volume_cbm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Move Date
                  </label>
                  <input
                    type="date"
                    value={formData.move_date}
                    onChange={(e) => setFormData({ ...formData, move_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
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
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
