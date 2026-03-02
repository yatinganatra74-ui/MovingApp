import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Search, DollarSign, Package, Calendar, Send, Eye, Edit2, Trash2, CheckCircle, Download, Mail } from 'lucide-react';
import { downloadQuotePDF, getQuotePDFBase64 } from '../lib/quotePdfGenerator';

interface Customer {
  id: string;
  name: string;
  company_name: string;
  email: string;
}

interface Tariff {
  id: string;
  tariff_name: string;
  tariff_code: string;
  origin_port: string;
  destination_port: string;
  service_type: string;
  shipment_type: string;
  is_agent_rate: boolean;
  carrier_name: string;
  currency: string;
  transit_time_days: number;
}

interface TariffRate {
  id: string;
  slab_name: string;
  min_cbm: number;
  max_cbm: number | null;
  rate_per_cbm: number;
  minimum_charge: number;
}

interface FCLRate {
  id: string;
  container_type: string;
  rate_per_container: number;
  baf_amount: number;
  caf_amount: number;
  includes_baf: boolean;
  includes_caf: boolean;
}

interface TariffCharge {
  id: string;
  charge_type: string;
  charge_name: string;
  charge_amount: number;
  is_per_shipment: boolean;
  is_optional: boolean;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  customer_name?: string;
  origin_port: string;
  destination_port: string;
  estimated_cbm: number;
  shipment_type: string;
  container_type: string;
  number_of_containers: number;
  is_agent_quote: boolean;
  buying_rate: number;
  selling_rate: number;
  margin_amount: number;
  margin_percentage: number;
  total_amount: number;
  currency: string;
  quote_status: string;
  quoted_at: string;
  valid_until: string;
}

interface LineItem {
  item_type: string;
  description: string;
  quantity: number;
  unit_type: string;
  unit_rate: number;
  amount: number;
  is_included: boolean;
  display_order: number;
}

export default function GroupageQuoteGenerator() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const [formData, setFormData] = useState({
    customer_id: '',
    tariff_id: '',
    estimated_cbm: 0,
    estimated_weight_kg: 0,
    number_of_packages: 0,
    number_of_containers: 1,
    container_type: '20FT',
    commodity_description: '',
    discount_percentage: 0,
    valid_days: 30,
    incoterm: 'EXW',
    special_instructions: '',
    customer_reference: '',
    is_agent_quote: false,
    agent_markup_percentage: 15
  });

  const [generatedLineItems, setGeneratedLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quotesRes, customersRes, tariffsRes] = await Promise.all([
        supabase
          .from('groupage_quotes')
          .select('*')
          .order('quoted_at', { ascending: false }),
        supabase
          .from('customers')
          .select('id, name, company_name, email')
          .order('name'),
        supabase
          .from('groupage_tariffs')
          .select('*')
          .eq('is_active', true)
          .order('tariff_name')
      ]);

      if (quotesRes.data) {
        const quotesWithCustomers = await Promise.all(
          quotesRes.data.map(async (quote) => {
            const { data: customer } = await supabase
              .from('customers')
              .select('name, company_name')
              .eq('id', quote.customer_id)
              .single();

            return {
              ...quote,
              customer_name: customer?.company_name || customer?.name
            };
          })
        );
        setQuotes(quotesWithCustomers);
      }

      if (customersRes.data) setCustomers(customersRes.data);
      if (tariffsRes.data) setTariffs(tariffsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTariffChange = async (tariffId: string) => {
    setFormData({ ...formData, tariff_id: tariffId });
    if (!tariffId) return;

    const selectedTariff = tariffs.find(t => t.id === tariffId);
    if (!selectedTariff) return;
  };

  const calculateQuote = async () => {
    if (!formData.tariff_id) {
      alert('Please select a tariff');
      return;
    }

    const selectedTariff = tariffs.find(t => t.id === formData.tariff_id);
    if (!selectedTariff) return;

    try {
      const items: LineItem[] = [];
      let displayOrder = 0;

      if (selectedTariff.shipment_type === 'FCL') {
        const { data: fclRates } = await supabase
          .from('groupage_fcl_rates')
          .select('*')
          .eq('tariff_id', formData.tariff_id)
          .eq('container_type', formData.container_type)
          .maybeSingle();

        if (fclRates) {
          const baseRate = fclRates.rate_per_container * formData.number_of_containers;
          const bafTotal = fclRates.baf_amount * formData.number_of_containers;
          const cafTotal = fclRates.caf_amount * formData.number_of_containers;

          items.push({
            item_type: 'freight',
            description: `FCL ${formData.container_type} x ${formData.number_of_containers}`,
            quantity: formData.number_of_containers,
            unit_type: 'Container',
            unit_rate: fclRates.rate_per_container,
            amount: baseRate,
            is_included: true,
            display_order: displayOrder++
          });

          if (fclRates.baf_amount > 0 && !fclRates.includes_baf) {
            items.push({
              item_type: 'surcharge',
              description: 'BAF (Bunker Adjustment Factor)',
              quantity: formData.number_of_containers,
              unit_type: 'Container',
              unit_rate: fclRates.baf_amount,
              amount: bafTotal,
              is_included: true,
              display_order: displayOrder++
            });
          }

          if (fclRates.caf_amount > 0 && !fclRates.includes_caf) {
            items.push({
              item_type: 'surcharge',
              description: 'CAF (Currency Adjustment Factor)',
              quantity: formData.number_of_containers,
              unit_type: 'Container',
              unit_rate: fclRates.caf_amount,
              amount: cafTotal,
              is_included: true,
              display_order: displayOrder++
            });
          }
        }
      } else {
        if (!formData.estimated_cbm) {
          alert('Please enter CBM volume for LCL');
          return;
        }

        const { data: rates } = await supabase
          .from('groupage_tariff_rates')
          .select('*')
          .eq('tariff_id', formData.tariff_id)
          .order('min_cbm');

        if (rates) {
          const applicableRate = rates.find(rate => {
            if (rate.max_cbm === null) {
              return formData.estimated_cbm >= rate.min_cbm;
            }
            return formData.estimated_cbm >= rate.min_cbm && formData.estimated_cbm < rate.max_cbm;
          });

          if (applicableRate) {
            const freightAmount = Math.max(
              formData.estimated_cbm * applicableRate.rate_per_cbm,
              applicableRate.minimum_charge || 0
            );

            items.push({
              item_type: 'freight',
              description: `LCL Ocean Freight - ${applicableRate.slab_name}`,
              quantity: formData.estimated_cbm,
              unit_type: 'CBM',
              unit_rate: applicableRate.rate_per_cbm,
              amount: freightAmount,
              is_included: true,
              display_order: displayOrder++
            });
          }
        }
      }

      const { data: charges } = await supabase
        .from('groupage_tariff_charges')
        .select('*')
        .eq('tariff_id', formData.tariff_id);

      if (charges) {
        charges.forEach(charge => {
          items.push({
            item_type: charge.charge_type,
            description: charge.charge_name,
            quantity: 1,
            unit_type: charge.is_per_shipment ? 'Per Shipment' : 'Lumpsum',
            unit_rate: charge.charge_amount,
            amount: charge.charge_amount,
            is_included: !charge.is_optional,
            display_order: displayOrder++
          });
        });
      }

      if (formData.is_agent_quote && formData.agent_markup_percentage > 0) {
        const baseTotal = items.filter(i => i.is_included).reduce((sum, i) => sum + i.amount, 0);
        const markupAmount = (baseTotal * formData.agent_markup_percentage) / 100;

        items.push({
          item_type: 'markup',
          description: `Agent Markup (${formData.agent_markup_percentage}%)`,
          quantity: 1,
          unit_type: 'Percentage',
          unit_rate: formData.agent_markup_percentage,
          amount: markupAmount,
          is_included: true,
          display_order: displayOrder++
        });
      }

      setGeneratedLineItems(items);
      alert('Quote calculated! Review the line items below.');
    } catch (error) {
      console.error('Error calculating quote:', error);
      alert('Failed to calculate quote');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (generatedLineItems.length === 0) {
      alert('Please calculate the quote first');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      const selectedTariff = tariffs.find(t => t.id === formData.tariff_id);

      const { data: quoteNumber } = await supabase.rpc('generate_groupage_quote_number');

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + formData.valid_days);

      const baseTotal = generatedLineItems
        .filter(item => item.is_included && item.item_type !== 'markup')
        .reduce((sum, item) => sum + item.amount, 0);

      const sellingTotal = generatedLineItems
        .filter(item => item.is_included)
        .reduce((sum, item) => sum + item.amount, 0);

      const { data: quoteData, error: quoteError } = await supabase
        .from('groupage_quotes')
        .insert([{
          quote_number: quoteNumber,
          customer_id: formData.customer_id,
          tariff_id: formData.tariff_id,
          origin_port: selectedTariff?.origin_port,
          destination_port: selectedTariff?.destination_port,
          estimated_cbm: formData.estimated_cbm,
          estimated_weight_kg: formData.estimated_weight_kg,
          number_of_packages: formData.number_of_packages,
          number_of_containers: formData.number_of_containers,
          container_type: formData.container_type,
          shipment_type: selectedTariff?.shipment_type || 'LCL',
          commodity_description: formData.commodity_description,
          currency: selectedTariff?.currency || 'USD',
          discount_percentage: formData.discount_percentage,
          is_agent_quote: formData.is_agent_quote,
          buying_rate: baseTotal,
          selling_rate: sellingTotal,
          margin_amount: sellingTotal - baseTotal,
          margin_percentage: baseTotal > 0 ? ((sellingTotal - baseTotal) / baseTotal) * 100 : 0,
          quote_status: 'draft',
          valid_until: validUntil.toISOString().split('T')[0],
          incoterm: formData.incoterm,
          special_instructions: formData.special_instructions,
          customer_reference: formData.customer_reference,
          quoted_by: user.user?.id
        }])
        .select()
        .single();

      if (quoteError) throw quoteError;

      const lineItemsData = generatedLineItems.map(item => ({
        quote_id: quoteData.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('groupage_quote_line_items')
        .insert(lineItemsData);

      if (itemsError) throw itemsError;

      await supabase.rpc('calculate_groupage_quote_totals', {
        p_quote_id: quoteData.id
      });

      alert('Quote created successfully!');
      setShowForm(false);
      setGeneratedLineItems([]);
      loadData();
    } catch (error: any) {
      console.error('Error creating quote:', error);
      alert(error.message || 'Failed to create quote');
    }
  };

  const handleViewQuote = async (quote: Quote) => {
    setViewingQuote(quote);

    const { data: items } = await supabase
      .from('groupage_quote_line_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('display_order');

    if (items) setLineItems(items);
  };

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      const { data: lineItemsData } = await supabase
        .from('groupage_quote_line_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('display_order');

      const customer = customers.find(c => c.id === quote.customer_id);

      if (!customer || !lineItemsData) {
        alert('Unable to load quote details');
        return;
      }

      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      let logoUrl = null;
      if (companySettings?.logo_url) {
        const { data: publicUrl } = supabase.storage
          .from('company-logos')
          .getPublicUrl(companySettings.logo_url);
        logoUrl = publicUrl.publicUrl;
      }

      const subtotal = lineItemsData
        .filter(item => item.is_included)
        .reduce((sum: number, item: any) => sum + item.amount, 0);

      const pdfData = {
        quote_number: quote.quote_number,
        quote_date: quote.quoted_at,
        valid_until: quote.valid_until,
        customer: {
          name: customer.name,
          company_name: customer.company_name || customer.name,
          email: customer.email,
        },
        shipment: {
          origin_port: quote.origin_port,
          destination_port: quote.destination_port,
          shipment_type: quote.shipment_type || 'LCL',
          incoterm: quote.incoterm,
          estimated_cbm: quote.estimated_cbm,
          estimated_weight_kg: quote.estimated_weight_kg,
          number_of_packages: quote.number_of_packages,
          container_type: quote.container_type,
          number_of_containers: quote.number_of_containers,
          commodity_description: quote.commodity_description,
        },
        lineItems: lineItemsData.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit_type: item.unit_type,
          unit_rate: item.unit_rate,
          amount: item.amount,
          is_included: item.is_included,
        })),
        totals: {
          subtotal,
          discount_percentage: quote.discount_percentage,
          discount_amount: (subtotal * (quote.discount_percentage || 0)) / 100,
          total: quote.total_amount,
          currency: quote.currency,
        },
        company: {
          name: companySettings?.company_name || 'Your Freight Company',
          address: companySettings?.company_address || '123 Logistics Street, Trade City',
          phone: companySettings?.company_phone || '+1-234-567-8900',
          email: companySettings?.company_email || 'quotes@yourfreight.com',
          website: companySettings?.company_website || 'www.yourfreight.com',
          logo_url: logoUrl || undefined,
          primary_color: companySettings?.primary_color || '#1F4E78',
        },
        notes: quote.special_instructions,
        terms_and_conditions: companySettings?.terms_and_conditions,
      };

      downloadQuotePDF(pdfData);
      alert('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const handleSendEmail = async (quote: Quote) => {
    try {
      const customer = customers.find(c => c.id === quote.customer_id);

      if (!customer) {
        alert('Customer not found');
        return;
      }

      const message = prompt('Add a personal message (optional):');

      const emailData = {
        to: customer.email,
        subject: `Quotation ${quote.quote_number} - ${quote.origin_port} to ${quote.destination_port}`,
        customerName: customer.name,
        quoteNumber: quote.quote_number,
        quoteDetails: {
          origin: quote.origin_port,
          destination: quote.destination_port,
          shipmentType: quote.shipment_type || 'LCL',
          total: quote.total_amount.toFixed(2),
          currency: quote.currency,
          validUntil: new Date(quote.valid_until).toLocaleDateString(),
        },
        message: message || undefined,
      };

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (result.success) {
        await supabase
          .from('groupage_quotes')
          .update({ quote_status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', quote.id);

        alert('Quote email sent successfully!');
        loadData();
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(error.message || 'Failed to send email');
    }
  };

  const handleUpdateStatus = async (quoteId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('groupage_quotes')
        .update({
          quote_status: status,
          ...(status === 'accepted' ? { accepted_at: new Date().toISOString() } : {})
        })
        .eq('id', quoteId);

      if (error) throw error;
      alert('Quote status updated!');
      loadData();
      setViewingQuote(null);
    } catch (error: any) {
      console.error('Error updating quote:', error);
      alert(error.message || 'Failed to update quote');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading quotes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Groupage Quote Generator</h2>
          <p className="text-gray-600">Create and manage groupage shipping quotes</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setFormData({
              customer_id: '',
              tariff_id: '',
              estimated_cbm: 0,
              estimated_weight_kg: 0,
              number_of_packages: 0,
              commodity_description: '',
              discount_percentage: 0,
              valid_days: 30,
              incoterm: 'EXW',
              special_instructions: '',
              customer_reference: ''
            });
            setGeneratedLineItems([]);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Quote
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Total Quotes</p>
          <p className="text-2xl font-bold text-blue-600">{quotes.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Draft</p>
          <p className="text-2xl font-bold text-yellow-600">
            {quotes.filter(q => q.quote_status === 'draft').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Sent</p>
          <p className="text-2xl font-bold text-blue-600">
            {quotes.filter(q => q.quote_status === 'sent').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Accepted</p>
          <p className="text-2xl font-bold text-green-600">
            {quotes.filter(q => q.quote_status === 'accepted').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Quote No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Route</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Volume</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Valid Until</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium">{quote.quote_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-900">{quote.customer_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {quote.origin_port} → {quote.destination_port}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="h-3 w-3 text-gray-400" />
                      <span>{quote.estimated_cbm} CBM</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold">
                      {quote.currency} {quote.total_amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-3 w-3" />
                      {new Date(quote.valid_until).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      quote.quote_status === 'accepted' ? 'bg-green-100 text-green-800' :
                      quote.quote_status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      quote.quote_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {quote.quote_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewQuote(quote)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(quote)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSendEmail(quote)}
                        className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {quotes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No quotes found</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create Groupage Quote</h3>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name || customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tariff *
                  </label>
                  <select
                    required
                    value={formData.tariff_id}
                    onChange={(e) => handleTariffChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Tariff</option>
                    {tariffs.map(tariff => (
                      <option key={tariff.id} value={tariff.id}>
                        {tariff.tariff_name} ({tariff.origin_port} → {tariff.destination_port})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {tariffs.find(t => t.id === formData.tariff_id)?.shipment_type === 'FCL' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Container Type *
                    </label>
                    <select
                      required
                      value={formData.container_type}
                      onChange={(e) => setFormData({ ...formData, container_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="20FT">20FT</option>
                      <option value="40FT">40FT</option>
                      <option value="40HC">40HC</option>
                      <option value="45HC">45HC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Containers *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.number_of_containers}
                      onChange={(e) => setFormData({ ...formData, number_of_containers: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (KG)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.estimated_weight_kg}
                      onChange={(e) => setFormData({ ...formData, estimated_weight_kg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated CBM *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.estimated_cbm}
                      onChange={(e) => setFormData({ ...formData, estimated_cbm: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (KG)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.estimated_weight_kg}
                      onChange={(e) => setFormData({ ...formData, estimated_weight_kg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Packages
                    </label>
                    <input
                      type="number"
                      value={formData.number_of_packages}
                      onChange={(e) => setFormData({ ...formData, number_of_packages: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commodity Description
                </label>
                <input
                  type="text"
                  value={formData.commodity_description}
                  onChange={(e) => setFormData({ ...formData, commodity_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-6 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_agent_quote}
                    onChange={(e) => setFormData({ ...formData, is_agent_quote: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">This is an Agent Quote</span>
                </label>
                {formData.is_agent_quote && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Markup %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.agent_markup_percentage}
                      onChange={(e) => setFormData({ ...formData, agent_markup_percentage: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Days
                  </label>
                  <input
                    type="number"
                    value={formData.valid_days}
                    onChange={(e) => setFormData({ ...formData, valid_days: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Incoterm
                  </label>
                  <select
                    value={formData.incoterm}
                    onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="EXW">EXW</option>
                    <option value="FOB">FOB</option>
                    <option value="CIF">CIF</option>
                    <option value="DDP">DDP</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={calculateQuote}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Calculate Quote
                </button>
              </div>

              {generatedLineItems.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Quote Line Items</h4>
                  <div className="space-y-2">
                    {generatedLineItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-gray-600">
                            {item.quantity} {item.unit_type} × {item.unit_rate.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.amount.toFixed(2)}</p>
                          {!item.is_included && (
                            <span className="text-xs text-gray-500">Optional</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded font-bold">
                      <span>Total</span>
                      <span>
                        {generatedLineItems
                          .filter(item => item.is_included)
                          .reduce((sum, item) => sum + item.amount, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={generatedLineItems.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Quote Details</h3>
                <p className="text-sm text-gray-600">{viewingQuote.quote_number}</p>
              </div>
              <button
                onClick={() => setViewingQuote(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{viewingQuote.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Route</p>
                  <p className="font-medium">{viewingQuote.origin_port} → {viewingQuote.destination_port}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Volume</p>
                  <p className="font-medium">{viewingQuote.estimated_cbm} CBM</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valid Until</p>
                  <p className="font-medium">{new Date(viewingQuote.valid_until).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Line Items</h4>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{item.description}</p>
                        <p className="text-xs text-gray-600">
                          {item.quantity} {item.unit_type} × {item.unit_rate}
                        </p>
                      </div>
                      <p className="font-semibold">{viewingQuote.currency} {item.amount.toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between p-3 bg-blue-50 rounded font-bold">
                    <span>Total Amount</span>
                    <span>{viewingQuote.currency} {viewingQuote.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {viewingQuote.quote_status === 'draft' && (
                  <button
                    onClick={() => handleUpdateStatus(viewingQuote.id, 'sent')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                    Mark as Sent
                  </button>
                )}
                {viewingQuote.quote_status === 'sent' && (
                  <button
                    onClick={() => handleUpdateStatus(viewingQuote.id, 'accepted')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark as Accepted
                  </button>
                )}
                <button
                  onClick={() => setViewingQuote(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
