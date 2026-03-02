import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, Calculator, DollarSign } from 'lucide-react';
import RateSheetLookup from './RateSheetLookup';

interface QuoteFormProps {
  quote: any;
  onClose: () => void;
}

interface Survey {
  id: string;
  total_volume: number;
  customers?: { name: string };
  move_types?: { name: string };
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface LineItem {
  description: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export default function QuoteForm({ quote, onClose }: QuoteFormProps) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    survey_id: quote?.survey_id || '',
    currency_id: quote?.currency_id || '',
    quote_date: quote?.quote_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    valid_until: quote?.valid_until?.split('T')[0] || '',
    status: quote?.status || 'draft',
    notes: quote?.notes || ''
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.survey_id) {
      generateLineItems();
    }
  }, [formData.survey_id]);

  const loadData = async () => {
    try {
      const [surveysRes, currenciesRes, materialsRes] = await Promise.all([
        supabase.from('surveys').select('id, total_volume, customers(name), move_types(name)').eq('status', 'completed'),
        supabase.from('currencies').select('*').eq('active', true),
        supabase.from('material_types').select('*').eq('active', true)
      ]);

      setSurveys(surveysRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setMaterials(materialsRes.data || []);

      if (!formData.currency_id && currenciesRes.data?.[0]) {
        setFormData(prev => ({ ...prev, currency_id: currenciesRes.data[0].id }));
      }

      if (quote) {
        const { data: items } = await supabase
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', quote.id);

        setLineItems(items || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const generateLineItems = async () => {
    if (lineItems.length > 0) return;

    const survey = surveys.find(s => s.id === formData.survey_id);
    if (!survey) return;

    const volume = survey.total_volume;
    const items: LineItem[] = [];

    items.push({
      description: 'Packing Services',
      category: 'labor',
      quantity: Math.ceil(volume / 100),
      unit_price: 500,
      amount: Math.ceil(volume / 100) * 500
    });

    const smallBoxes = Math.ceil(volume * 0.3 / 1.5);
    const mediumBoxes = Math.ceil(volume * 0.5 / 3);
    const largeBoxes = Math.ceil(volume * 0.2 / 4.5);

    items.push({
      description: 'Small Cartons',
      category: 'materials',
      quantity: smallBoxes,
      unit_price: 2.5,
      amount: smallBoxes * 2.5
    });

    items.push({
      description: 'Medium Cartons',
      category: 'materials',
      quantity: mediumBoxes,
      unit_price: 3.5,
      amount: mediumBoxes * 3.5
    });

    items.push({
      description: 'Large Cartons',
      category: 'materials',
      quantity: largeBoxes,
      unit_price: 4.5,
      amount: largeBoxes * 4.5
    });

    const bubbleRolls = Math.ceil(volume / 50);
    items.push({
      description: 'Bubble Roll',
      category: 'materials',
      quantity: bubbleRolls,
      unit_price: 15,
      amount: bubbleRolls * 15
    });

    items.push({
      description: 'Tape & Packing Supplies',
      category: 'materials',
      quantity: 1,
      unit_price: 50,
      amount: 50
    });

    items.push({
      description: 'Loading Services',
      category: 'labor',
      quantity: Math.ceil(volume / 150),
      unit_price: 400,
      amount: Math.ceil(volume / 150) * 400
    });

    items.push({
      description: 'Transportation',
      category: 'transport',
      quantity: 1,
      unit_price: Math.ceil(volume / 100) * 300,
      amount: Math.ceil(volume / 100) * 300
    });

    items.push({
      description: 'Unloading Services',
      category: 'labor',
      quantity: Math.ceil(volume / 150),
      unit_price: 400,
      amount: Math.ceil(volume / 150) * 400
    });

    if (survey.move_types?.name === 'International Move') {
      items.push({
        description: 'International Shipping',
        category: 'transport',
        quantity: volume,
        unit_price: 15,
        amount: volume * 15
      });

      items.push({
        description: 'Customs Clearance',
        category: 'transport',
        quantity: 1,
        unit_price: 500,
        amount: 500
      });
    }

    setLineItems(items);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      description: '',
      category: 'materials',
      quantity: 1,
      unit_price: 0,
      amount: 0
    }]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      updated[index].amount = updated[index].quantity * updated[index].unit_price;
    }

    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleRateSelected = (rateData: any) => {
    const items: LineItem[] = [];

    items.push({
      description: `Freight - ${rateData.lane.service_type} (${rateData.lane.origin_port} → ${rateData.lane.destination_port})`,
      category: 'transport',
      quantity: 1,
      unit_price: rateData.lane.base_rate,
      amount: rateData.lane.base_rate
    });

    if (rateData.lane.fuel_surcharge > 0) {
      items.push({
        description: 'Fuel Surcharge',
        category: 'transport',
        quantity: 1,
        unit_price: rateData.lane.fuel_surcharge,
        amount: rateData.lane.fuel_surcharge
      });
    }

    if (rateData.lane.security_fee > 0) {
      items.push({
        description: 'Security Fee',
        category: 'transport',
        quantity: 1,
        unit_price: rateData.lane.security_fee,
        amount: rateData.lane.security_fee
      });
    }

    if (rateData.lane.terminal_handling > 0) {
      items.push({
        description: 'Terminal Handling',
        category: 'transport',
        quantity: 1,
        unit_price: rateData.lane.terminal_handling,
        amount: rateData.lane.terminal_handling
      });
    }

    if (rateData.lane.documentation_fee > 0) {
      items.push({
        description: 'Documentation Fee',
        category: 'transport',
        quantity: 1,
        unit_price: rateData.lane.documentation_fee,
        amount: rateData.lane.documentation_fee
      });
    }

    rateData.charges
      .filter((charge: any) => charge.is_mandatory)
      .forEach((charge: any) => {
        items.push({
          description: charge.charge_name,
          category: charge.charge_type,
          quantity: 1,
          unit_price: charge.amount,
          amount: charge.amount
        });
      });

    setLineItems([...lineItems, ...items]);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax;

  const generateQuoteNumber = () => {
    const date = new Date();
    return `Q${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const quoteData = {
        ...formData,
        quote_number: quote?.quote_number || generateQuoteNumber(),
        subtotal,
        tax,
        total,
        created_by: user?.id
      };

      let quoteId = quote?.id;

      if (quote) {
        const { error } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quote.id);

        if (error) throw error;

        await supabase.from('quote_line_items').delete().eq('quote_id', quote.id);
      } else {
        const { data, error } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();

        if (error) throw error;
        quoteId = data.id;
      }

      if (lineItems.length > 0) {
        const itemsToInsert = lineItems.map(item => ({
          quote_id: quoteId,
          ...item
        }));

        const { error } = await supabase
          .from('quote_line_items')
          .insert(itemsToInsert);

        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCurrency = currencies.find(c => c.id === formData.currency_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">
            {quote ? 'View/Edit Quote' : 'New Quote'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Survey *</label>
                <select
                  required
                  value={formData.survey_id}
                  onChange={(e) => setFormData({ ...formData, survey_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Select survey</option>
                  {surveys.map(survey => (
                    <option key={survey.id} value={survey.id}>
                      {survey.customers?.name} - {survey.total_volume.toFixed(1)} cu ft
                    </option>
                  ))}
                </select>
              </div>

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
                <label className="block text-sm font-medium text-slate-700 mb-2">Quote Date *</label>
                <input
                  type="date"
                  required
                  value={formData.quote_date}
                  onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Valid Until</label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
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
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
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

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Line Items</h3>
                <div className="flex gap-2">
                  <RateSheetLookup
                    onRateSelected={handleRateSelected}
                    shipmentType="export"
                  />
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="col-span-4 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateLineItem(index, 'category', e.target.value)}
                      className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="materials">Materials</option>
                      <option value="labor">Labor</option>
                      <option value="transport">Transport</option>
                      <option value="warehousing">Warehousing</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                    <div className="col-span-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        {item.amount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-100 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedCurrency?.symbol}{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">Tax ({taxRate}%):</span>
                  <span className="font-semibold text-slate-900">
                    {selectedCurrency?.symbol}{tax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-300">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-slate-900">
                    {selectedCurrency?.symbol}{total.toFixed(2)} {selectedCurrency?.code}
                  </span>
                </div>
              </div>
            </div>
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
              {loading ? 'Saving...' : quote ? 'Update Quote' : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
