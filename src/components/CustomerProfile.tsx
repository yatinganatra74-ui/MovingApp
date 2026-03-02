import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { documentStorage, Document } from '../lib/documentStorage';
import { X, Plus, Trash2, MapPin, User, Phone, Mail, Briefcase, Upload, Download, FileText, Building, Shield, Settings } from 'lucide-react';

interface CustomerProfileProps {
  customerId: string | null;
  onClose: () => void;
}

interface Address {
  id?: string;
  address_type: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

interface Contact {
  id?: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  designation: string;
  is_primary: boolean;
}

export default function CustomerProfile({ customerId, onClose }: CustomerProfileProps) {
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'addresses' | 'contacts' | 'documents' | 'kyc' | 'preferences'>('info');
  const [kyc, setKyc] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    customer_type: 'individual',
    email: '',
    phone: '',
    tax_id: '',
    notes: ''
  });

  useEffect(() => {
    if (customerId) {
      loadCustomer();
      loadAddresses();
      loadContacts();
      loadDocuments();
      loadKYC();
      loadPreferences();
    }
  }, [customerId]);

  const loadCustomer = async () => {
    if (!customerId) return;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (data) {
      setCustomer(data);
      setFormData({
        name: data.name || '',
        company_name: data.company_name || '',
        customer_type: data.customer_type || 'individual',
        email: data.email || '',
        phone: data.phone || '',
        tax_id: data.tax_id || '',
        notes: data.notes || ''
      });
    }
  };

  const loadAddresses = async () => {
    if (!customerId) return;

    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false });

    setAddresses(data || []);
  };

  const loadContacts = async () => {
    if (!customerId) return;

    const { data } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false });

    setContacts(data || []);
  };

  const loadDocuments = async () => {
    if (!customerId) return;

    try {
      const docs = await documentStorage.getDocuments('customer', customerId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadKYC = async () => {
    if (!customerId) return;

    const { data } = await supabase
      .from('customer_kyc')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    setKyc(data || {
      pan_number: '',
      gst_number: '',
      aadhar_number: '',
      passport_number: '',
      passport_expiry: '',
      visa_details: '',
      credit_limit: 0,
      credit_days: 0,
      kyc_verified: false,
      notes: ''
    });
  };

  const loadPreferences = async () => {
    if (!customerId) return;

    const { data } = await supabase
      .from('customer_move_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    setPreferences(data || {
      preferred_service_type: 'door-to-door',
      packing_required: true,
      insurance_required: false,
      storage_required: false,
      preferred_transport_mode: 'road',
      special_requirements: '',
      default_origin_port: '',
      default_destination_port: ''
    });
  };

  const handleSaveCustomer = async () => {
    setLoading(true);
    try {
      if (customerId) {
        await supabase
          .from('customers')
          .update(formData)
          .eq('id', customerId);
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!customerId) return;

    const newAddress: Address = {
      address_type: 'pickup',
      address_line1: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_primary: addresses.length === 0
    };

    setAddresses([...addresses, newAddress]);
  };

  const handleSaveAddresses = async () => {
    if (!customerId) return;

    try {
      await supabase
        .from('customer_addresses')
        .delete()
        .eq('customer_id', customerId);

      const addressesToSave = addresses.map(addr => ({
        ...addr,
        customer_id: customerId,
        id: undefined
      }));

      await supabase
        .from('customer_addresses')
        .insert(addressesToSave);

      loadAddresses();
    } catch (error) {
      console.error('Error saving addresses:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customerId || !e.target.files?.length) return;

    const file = e.target.files[0];

    try {
      await documentStorage.uploadDocument({
        entityType: 'customer',
        entityId: customerId,
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

  const handleSaveKYC = async () => {
    if (!customerId || !kyc) return;

    try {
      const { data: existing } = await supabase
        .from('customer_kyc')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('customer_kyc')
          .update(kyc)
          .eq('customer_id', customerId);
      } else {
        await supabase
          .from('customer_kyc')
          .insert([{ ...kyc, customer_id: customerId }]);
      }

      alert('KYC information saved successfully');
      loadKYC();
    } catch (error) {
      console.error('Error saving KYC:', error);
      alert('Failed to save KYC information');
    }
  };

  const handleSavePreferences = async () => {
    if (!customerId || !preferences) return;

    try {
      const { data: existing } = await supabase
        .from('customer_move_preferences')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('customer_move_preferences')
          .update(preferences)
          .eq('customer_id', customerId);
      } else {
        await supabase
          .from('customer_move_preferences')
          .insert([{ ...preferences, customer_id: customerId }]);
      }

      alert('Move preferences saved successfully');
      loadPreferences();
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {customerId ? 'Customer Profile' : 'New Customer'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex gap-2 px-6">
            {[
              { id: 'info', label: 'Information', icon: User },
              { id: 'kyc', label: 'KYC', icon: Shield },
              { id: 'preferences', label: 'Move Preferences', icon: Settings },
              { id: 'addresses', label: 'Addresses', icon: MapPin },
              { id: 'contacts', label: 'Contacts', icon: Phone },
              { id: 'documents', label: 'Documents', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 max-h-[600px] overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Type
                  </label>
                  <select
                    value={formData.customer_type}
                    onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="individual">Individual</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {formData.customer_type === 'corporate' ? 'Contact Name' : 'Full Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {formData.customer_type === 'corporate' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tax ID</label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveCustomer}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Customer Information'}
              </button>
            </div>
          )}

          {activeTab === 'kyc' && customerId && kyc && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">PAN Number</label>
                  <input
                    type="text"
                    value={kyc.pan_number || ''}
                    onChange={(e) => setKyc({ ...kyc, pan_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">GST Number</label>
                  <input
                    type="text"
                    value={kyc.gst_number || ''}
                    onChange={(e) => setKyc({ ...kyc, gst_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Aadhar Number</label>
                  <input
                    type="text"
                    value={kyc.aadhar_number || ''}
                    onChange={(e) => setKyc({ ...kyc, aadhar_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="1234 5678 9012"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Passport Number</label>
                  <input
                    type="text"
                    value={kyc.passport_number || ''}
                    onChange={(e) => setKyc({ ...kyc, passport_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="A1234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Passport Expiry</label>
                  <input
                    type="date"
                    value={kyc.passport_expiry || ''}
                    onChange={(e) => setKyc({ ...kyc, passport_expiry: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Visa Details</label>
                  <input
                    type="text"
                    value={kyc.visa_details || ''}
                    onChange={(e) => setKyc({ ...kyc, visa_details: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Credit Limit</label>
                  <input
                    type="number"
                    value={kyc.credit_limit || 0}
                    onChange={(e) => setKyc({ ...kyc, credit_limit: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Credit Days</label>
                  <input
                    type="number"
                    value={kyc.credit_days || 0}
                    onChange={(e) => setKyc({ ...kyc, credit_days: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={kyc.kyc_verified || false}
                    onChange={(e) => setKyc({ ...kyc, kyc_verified: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">KYC Verified</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={kyc.credit_approved || false}
                    onChange={(e) => setKyc({ ...kyc, credit_approved: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Credit Approved</label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">KYC Notes</label>
                  <textarea
                    rows={3}
                    value={kyc.notes || ''}
                    onChange={(e) => setKyc({ ...kyc, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveKYC}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Save KYC Information
              </button>
            </div>
          )}

          {activeTab === 'preferences' && customerId && preferences && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Service Type</label>
                  <select
                    value={preferences.preferred_service_type || 'door-to-door'}
                    onChange={(e) => setPreferences({ ...preferences, preferred_service_type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="door-to-door">Door to Door</option>
                    <option value="door-to-port">Door to Port</option>
                    <option value="port-to-door">Port to Door</option>
                    <option value="port-to-port">Port to Port</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Transport Mode</label>
                  <select
                    value={preferences.preferred_transport_mode || 'road'}
                    onChange={(e) => setPreferences({ ...preferences, preferred_transport_mode: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="road">Road</option>
                    <option value="air">Air</option>
                    <option value="sea">Sea</option>
                    <option value="rail">Rail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Default Origin Port</label>
                  <input
                    type="text"
                    value={preferences.default_origin_port || ''}
                    onChange={(e) => setPreferences({ ...preferences, default_origin_port: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Mumbai Port"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Default Destination Port</label>
                  <input
                    type="text"
                    value={preferences.default_destination_port || ''}
                    onChange={(e) => setPreferences({ ...preferences, default_destination_port: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Singapore Port"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.packing_required || false}
                    onChange={(e) => setPreferences({ ...preferences, packing_required: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Packing Required</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.insurance_required || false}
                    onChange={(e) => setPreferences({ ...preferences, insurance_required: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Insurance Required</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.storage_required || false}
                    onChange={(e) => setPreferences({ ...preferences, storage_required: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-slate-700">Storage Required</label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Special Requirements</label>
                  <textarea
                    rows={3}
                    value={preferences.special_requirements || ''}
                    onChange={(e) => setPreferences({ ...preferences, special_requirements: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special handling requirements..."
                  />
                </div>
              </div>

              <button
                onClick={handleSavePreferences}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Save Move Preferences
              </button>
            </div>
          )}

          {activeTab === 'addresses' && customerId && (
            <div className="space-y-4">
              {addresses.map((addr, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={addr.address_type}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].address_type = e.target.value;
                        setAddresses(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="pickup">Pickup Address</option>
                      <option value="delivery">Delivery Address</option>
                      <option value="billing">Billing Address</option>
                      <option value="office">Office Address</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={addr.is_primary}
                        onChange={(e) => {
                          const updated = addresses.map((a, i) => ({
                            ...a,
                            is_primary: i === idx ? e.target.checked : false
                          }));
                          setAddresses(updated);
                        }}
                        className="w-4 h-4"
                      />
                      <label className="text-sm text-slate-700">Primary Address</label>
                    </div>

                    <input
                      type="text"
                      placeholder="Address Line 1"
                      value={addr.address_line1}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].address_line1 = e.target.value;
                        setAddresses(updated);
                      }}
                      className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />

                    <input
                      type="text"
                      placeholder="Address Line 2"
                      value={addr.address_line2 || ''}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].address_line2 = e.target.value;
                        setAddresses(updated);
                      }}
                      className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />

                    <input
                      type="text"
                      placeholder="City"
                      value={addr.city}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].city = e.target.value;
                        setAddresses(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />

                    <input
                      type="text"
                      placeholder="State"
                      value={addr.state}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].state = e.target.value;
                        setAddresses(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />

                    <input
                      type="text"
                      placeholder="Postal Code"
                      value={addr.postal_code}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].postal_code = e.target.value;
                        setAddresses(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />

                    <input
                      type="text"
                      placeholder="Country"
                      value={addr.country}
                      onChange={(e) => {
                        const updated = [...addresses];
                        updated[idx].country = e.target.value;
                        setAddresses(updated);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <button
                    onClick={() => setAddresses(addresses.filter((_, i) => i !== idx))}
                    className="mt-3 text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddAddress}
                className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Address
              </button>

              <button
                onClick={handleSaveAddresses}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Save All Addresses
              </button>
            </div>
          )}

          {activeTab === 'documents' && customerId && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">Upload customer documents</p>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  <Upload className="w-5 h-5" />
                  Choose File
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                </label>
              </div>

              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="font-medium text-slate-900">{doc.document_name}</p>
                        <p className="text-sm text-slate-600">
                          {new Date(doc.uploaded_at).toLocaleDateString()} • {(doc.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                ))}

                {documents.length === 0 && (
                  <p className="text-center py-8 text-slate-500">No documents uploaded yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
