import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, Users, DollarSign, Briefcase } from 'lucide-react';

interface CrewMember {
  id: string;
  name: string;
  employee_id: string;
  role: string;
  phone: string | null;
  email: string | null;
  hourly_rate: number;
  active: boolean;
  created_at: string;
}

export default function Crew() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    role: 'packer',
    phone: '',
    email: '',
    hourly_rate: 15,
    active: true
  });

  useEffect(() => {
    loadCrew();
  }, []);

  const loadCrew = async () => {
    try {
      const { data, error } = await supabase
        .from('crew_members')
        .select('*')
        .order('name');

      if (error) throw error;
      setCrew(data || []);
    } catch (error) {
      console.error('Error loading crew:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingMember) {
        const { error } = await supabase
          .from('crew_members')
          .update(formData)
          .eq('id', editingMember.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crew_members')
          .insert([formData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingMember(null);
      setFormData({
        name: '',
        employee_id: '',
        role: 'packer',
        phone: '',
        email: '',
        hourly_rate: 15,
        active: true
      });
      loadCrew();
    } catch (error) {
      console.error('Error saving crew member:', error);
    }
  };

  const handleEdit = (member: CrewMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      employee_id: member.employee_id,
      role: member.role,
      phone: member.phone || '',
      email: member.email || '',
      hourly_rate: member.hourly_rate,
      active: member.active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this crew member?')) return;

    try {
      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCrew();
    } catch (error) {
      console.error('Error deleting crew member:', error);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('crew_members')
        .update({ active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadCrew();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredCrew = crew.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCrew = crew.filter(m => m.active).length;
  const roles = Array.from(new Set(crew.map(m => m.role)));

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
          <h1 className="text-3xl font-bold text-slate-900">Crew Management</h1>
          <p className="text-slate-600 mt-1">Manage staff and crew members</p>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setFormData({
              name: '',
              employee_id: '',
              role: 'packer',
              phone: '',
              email: '',
              hourly_rate: 15,
              active: true
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Crew Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{crew.length}</div>
          <div className="text-sm text-slate-600">Total Crew</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{activeCrew}</div>
          <div className="text-sm text-slate-600">Active Members</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Briefcase className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{roles.length}</div>
          <div className="text-sm text-slate-600">Different Roles</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search crew members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Employee ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Hourly Rate
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
              {filteredCrew.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      {member.email && (
                        <div className="text-sm text-slate-600">{member.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {member.employee_id}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <DollarSign className="w-4 h-4" />
                      {member.hourly_rate.toFixed(2)}/hr
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(member.id, member.active)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        member.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {member.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCrew.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {searchQuery ? 'No crew members found matching your search' : 'No crew members yet'}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingMember ? 'Edit Crew Member' : 'Add New Crew Member'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="packer">Packer</option>
                  <option value="loader">Loader</option>
                  <option value="driver">Driver</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="helper">Helper</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hourly Rate *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-500"
                />
                <label htmlFor="active" className="text-sm font-medium text-slate-700">
                  Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingMember(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {editingMember ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
