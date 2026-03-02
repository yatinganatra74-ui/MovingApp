import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Search, Building2, Mail, Phone, MapPin, Plus, X, Edit2, Trash2, FileText, DollarSign } from 'lucide-react';

interface Customer {
  id: string;
  company_id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  customer_type: string;
  move_type: string;
  tax_id?: string;
  notes?: string;
  created_at: string;
}

interface CustomerAddress {
  id?: string;
  address_type: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

interface CustomerContact {
  id?: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  designation: string;
  is_primary: boolean;
}

interface CustomerRevenue {
  total_quotes: number;
  total_jobs: number;
  total_revenue: number;
  total_profit: number;
}

export default function Customers() {
  const { userProfile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [revenue, setRevenue] = useState<CustomerRevenue | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    customer_type: 'individual',
    move_type: 'individual',
    tax_id: '',
    notes: ''
  });

  useEffect(() => {
    if (userProfile) {
      fetchCustomers();
    }
  }, [userProfile]);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', userProfile?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetails = async (customerId: string) => {
    try {
      const [addressesRes, contactsRes, revenueRes] = await Promise.all([
        supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', customerId),
        supabase
          .from('customer_contacts')
          .select('*')
          .eq('customer_id', customerId),
        supabase
          .from('customer_revenue_summary')
          .select('*')
          .eq('customer_id', customerId)
          .maybeSingle()
      ]);

      if (addressesRes.error) throw addressesRes.error;
      if (contactsRes.error) throw contactsRes.error;

      setAddresses(addressesRes.data || []);
      setContacts(contactsRes.data || []);
      setRevenue(revenueRes.data);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const filterCustomers = () => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.company_name?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.phone?.includes(term)
    );
    setFilteredCustomers(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('customers').insert([{
        company_id: userProfile?.company_id,
        ...formData
      }]);

      if (error) throw error;

      setFormData({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        address: '',
        customer_type: 'individual',
        move_type: 'individual',
        tax_id: '',
        notes: ''
      });
      setShowForm(false);
      fetchCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer');
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
      fetchCustomers();
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(null);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-600">Manage your customer database</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          New Customer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Corporate Move</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.move_type === 'corporate').length}
              </p>
            </div>
            <Building2 className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Individual Move</p>
              <p className="text-2xl font-bold text-gray-900">
                {customers.filter(c => c.move_type === 'individual').length}
              </p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCustomer?.id === customer.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    {customer.company_name && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {customer.company_name}
                      </p>
                    )}
                    {customer.email && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </p>
                    )}
                    {customer.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    customer.move_type === 'corporate'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {customer.move_type === 'corporate' ? 'Corporate Move' : 'Individual Move'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {selectedCustomer ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h3>
                  {selectedCustomer.company_name && (
                    <p className="text-gray-600">{selectedCustomer.company_name}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteCustomer(selectedCustomer.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {revenue && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-600">Total Jobs</p>
                    <p className="text-lg font-bold text-gray-900">{revenue.total_jobs}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Revenue</p>
                    <p className="text-lg font-bold text-green-600">
                      ${revenue.total_revenue?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Quotes</p>
                    <p className="text-lg font-bold text-gray-900">{revenue.total_quotes}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Profit</p>
                    <p className="text-lg font-bold text-blue-600">
                      ${revenue.total_profit?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                <div className="space-y-2 text-sm">
                  {selectedCustomer.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedCustomer.email}
                    </p>
                  )}
                  {selectedCustomer.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedCustomer.phone}
                    </p>
                  )}
                  {selectedCustomer.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {selectedCustomer.address}
                    </p>
                  )}
                  {selectedCustomer.tax_id && (
                    <p className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      Tax ID: {selectedCustomer.tax_id}
                    </p>
                  )}
                </div>
              </div>

              {addresses.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Addresses</h4>
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="p-2 bg-gray-50 rounded text-sm">
                        <p className="font-medium text-gray-900 capitalize">
                          {addr.address_type}
                          {addr.is_primary && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-gray-600">{addr.address_line1}</p>
                        {addr.address_line2 && (
                          <p className="text-gray-600">{addr.address_line2}</p>
                        )}
                        <p className="text-gray-600">
                          {addr.city}, {addr.state} {addr.postal_code}
                        </p>
                        <p className="text-gray-600">{addr.country}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {contacts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Contact Persons</h4>
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="p-2 bg-gray-50 rounded text-sm">
                        <p className="font-medium text-gray-900">
                          {contact.contact_name}
                          {contact.is_primary && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </p>
                        {contact.designation && (
                          <p className="text-gray-600">{contact.designation}</p>
                        )}
                        {contact.contact_email && (
                          <p className="text-gray-600">{contact.contact_email}</p>
                        )}
                        {contact.contact_phone && (
                          <p className="text-gray-600">{contact.contact_phone}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCustomer.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {selectedCustomer.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a customer to view details
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Customer</h3>
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
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Type *
                  </label>
                  <select
                    required
                    value={formData.customer_type}
                    onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="individual">Individual</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Move Type *
                  </label>
                  <select
                    required
                    value={formData.move_type}
                    onChange={(e) => setFormData({ ...formData, move_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="individual">Individual Move</option>
                    <option value="corporate">Corporate Move</option>
                  </select>
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
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
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
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
