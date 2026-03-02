import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Upload, Save, Image as ImageIcon, Palette } from 'lucide-react';

interface CompanySettings {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  tax_id: string | null;
  bank_details: string | null;
  terms_and_conditions: string;
  quote_footer_text: string;
}

export default function CompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // First get the user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: companyUser, error: companyError } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!companyUser) throw new Error('No company assigned');

      // Get company settings
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyUser.company_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('No settings found');

      setSettings(data);

      if (data.logo_url) {
        const { data: publicUrl } = supabase.storage
          .from('company-logos')
          .getPublicUrl(data.logo_url);
        setLogoPreview(publicUrl.publicUrl);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      alert('Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo must be less than 2MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile || !settings) {
      console.error('No logo file or settings', { logoFile, settings });
      return;
    }

    setUploading(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      console.log('Uploading logo:', { fileName, filePath, fileSize: logoFile.size });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Delete old logo if exists
      if (settings.logo_url) {
        console.log('Removing old logo:', settings.logo_url);
        const { error: removeError } = await supabase.storage
          .from('company-logos')
          .remove([settings.logo_url]);

        if (removeError) {
          console.warn('Failed to remove old logo:', removeError);
        }
      }

      // Update database
      console.log('Updating settings with new logo URL:', filePath);
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ logo_url: filePath })
        .eq('id', settings.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      // Update local state
      setSettings({ ...settings, logo_url: filePath });

      // Update preview
      const { data: publicUrl } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);
      setLogoPreview(publicUrl.publicUrl);

      alert('Logo uploaded successfully!');
      setLogoFile(null);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert(`Failed to upload logo: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          company_address: settings.company_address,
          company_phone: settings.company_phone,
          company_email: settings.company_email,
          company_website: settings.company_website,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          tax_id: settings.tax_id,
          bank_details: settings.bank_details,
          terms_and_conditions: settings.terms_and_conditions,
          quote_footer_text: settings.quote_footer_text,
        })
        .eq('id', settings.id);

      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!settings) {
    return <div className="text-center py-12 text-gray-500">No settings found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Settings</h2>
          <p className="text-gray-600">Manage your company branding and information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-600" />
              Company Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={settings.company_address}
                  onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={settings.company_phone}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  value={settings.company_website}
                  onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax ID
                </label>
                <input
                  type="text"
                  value={settings.tax_id || ''}
                  onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-gray-600" />
              Brand Colors
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.secondary_color}
                    onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                    className="h-10 w-20 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color}
                    onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Bank Details</h3>
            <textarea
              value={settings.bank_details || ''}
              onChange={(e) => setSettings({ ...settings, bank_details: e.target.value })}
              rows={4}
              placeholder="Bank name, account number, SWIFT code, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Terms & Conditions</h3>
            <textarea
              value={settings.terms_and_conditions}
              onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Quote Footer Text</h3>
            <input
              type="text"
              value={settings.quote_footer_text}
              onChange={(e) => setSettings({ ...settings, quote_footer_text: e.target.value })}
              placeholder="Thank you message for quotes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gray-600" />
              Company Logo
            </h3>

            <div className="space-y-4">
              {logoPreview && (
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload New Logo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>

              {logoFile && (
                <button
                  onClick={handleUploadLogo}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Logo Usage</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Appears on PDF quotes</li>
              <li>• Shown in email headers</li>
              <li>• Displayed in CRM header</li>
              <li>• Used on invoices</li>
            </ul>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
