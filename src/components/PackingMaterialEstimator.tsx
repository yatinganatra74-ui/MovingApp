import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Calculator, Download, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface PackingMaterialEstimatorProps {
  surveyId: string;
  onClose?: () => void;
}

interface MaterialBreakdown {
  [key: string]: {
    material: string;
    quantity: number;
    unit: string;
  };
}

export default function PackingMaterialEstimator({ surveyId, onClose }: PackingMaterialEstimatorProps) {
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [materials, setMaterials] = useState<MaterialBreakdown>({});
  const [survey, setSurvey] = useState<any>(null);
  const [itemCount, setItemCount] = useState(0);
  const [savedEstimate, setSavedEstimate] = useState<any>(null);

  useEffect(() => {
    loadSurveyData();
    checkExistingEstimate();
  }, [surveyId]);

  const loadSurveyData = async () => {
    const { data: surveyData } = await supabase
      .from('surveys')
      .select('*, customers(name)')
      .eq('id', surveyId)
      .maybeSingle();

    if (surveyData) {
      setSurvey(surveyData);
    }

    const { data: itemsData, count } = await supabase
      .from('survey_items_detailed')
      .select('*', { count: 'exact' })
      .eq('survey_id', surveyId);

    if (count !== null) {
      setItemCount(count);
    }
  };

  const checkExistingEstimate = async () => {
    const { data } = await supabase
      .from('packing_material_estimates')
      .select('*')
      .eq('survey_id', surveyId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSavedEstimate(data);
      setMaterials(data.material_breakdown || {});
    }
  };

  const handleGenerateEstimate = async () => {
    setEstimating(true);
    try {
      const { data, error } = await supabase.rpc('estimate_survey_materials_complete', {
        p_survey_id: surveyId
      });

      if (error) throw error;

      setMaterials(data || {});
    } catch (error) {
      console.error('Error generating estimate:', error);
      alert('Failed to generate estimate');
    } finally {
      setEstimating(false);
    }
  };

  const handleSaveEstimate = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('packing_material_estimates')
        .insert([{
          survey_id: surveyId,
          material_breakdown: materials,
          total_cost: 0,
          approved: false
        }]);

      if (error) throw error;

      alert('Estimate saved successfully!');
      checkExistingEstimate();
    } catch (error) {
      console.error('Error saving estimate:', error);
      alert('Failed to save estimate');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEstimate = async () => {
    if (!savedEstimate) return;

    const { error } = await supabase
      .from('packing_material_estimates')
      .update({
        approved: true,
        approved_at: new Date().toISOString()
      })
      .eq('id', savedEstimate.id);

    if (!error) {
      alert('Estimate approved!');
      checkExistingEstimate();
    }
  };

  const exportToCSV = () => {
    const rows = [['Material', 'Quantity', 'Unit']];

    Object.values(materials).forEach(mat => {
      rows.push([mat.material, mat.quantity.toFixed(2), mat.unit]);
    });

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packing-materials-${surveyId}.csv`;
    a.click();
  };

  const materialEntries = Object.entries(materials);
  const hasEstimate = materialEntries.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6" />
              Packing Material Estimator
            </h2>
            {survey && (
              <p className="text-sm text-slate-600 mt-1">
                {survey.customers?.name} | {itemCount} items
              </p>
            )}
          </div>
          {savedEstimate && savedEstimate.approved && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Approved</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {!hasEstimate && (
          <div className="text-center py-12">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Generate Material Estimate
            </h3>
            <p className="text-slate-600 mb-6">
              Automatically calculate required packing materials based on survey items
            </p>
            <button
              onClick={handleGenerateEstimate}
              disabled={estimating || itemCount === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              <Calculator className="w-5 h-5" />
              {estimating ? 'Calculating...' : 'Generate Estimate'}
            </button>
            {itemCount === 0 && (
              <p className="text-sm text-orange-600 mt-4 flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4" />
                Add items to the survey first
              </p>
            )}
          </div>
        )}

        {hasEstimate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Material Breakdown</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateEstimate}
                  disabled={estimating}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Recalculate
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materialEntries.map(([key, mat]) => (
                <div key={key} className={`rounded-lg p-4 border ${
                  mat.type === 'formula_based'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{mat.material}</h4>
                      {mat.formula && (
                        <p className="text-xs text-slate-600 mt-1">{mat.formula}</p>
                      )}
                      <div className="mt-2">
                        <span className={`text-2xl font-bold ${
                          mat.type === 'formula_based' ? 'text-blue-600' : 'text-slate-900'
                        }`}>
                          {mat.quantity.toFixed(2)}
                        </span>
                        <span className="text-sm text-slate-600 ml-2">{mat.unit}</span>
                      </div>
                    </div>
                    <Package className={`w-5 h-5 ${
                      mat.type === 'formula_based' ? 'text-blue-400' : 'text-slate-400'
                    }`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">Item-Based Materials</h4>
                <p className="text-sm text-slate-700">
                  Calculated per item using rule-based matching of item types, fragility,
                  and dimensions. Each item gets specific materials based on its characteristics.
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Volume-Based Materials</h4>
                <p className="text-sm text-blue-800">
                  Calculated using total CBM and item counts with industry-standard formulas.
                  Includes cartons, tape, stretch film, and other consumables.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              {!savedEstimate && (
                <button
                  onClick={handleSaveEstimate}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Estimate'}
                </button>
              )}

              {savedEstimate && !savedEstimate.approved && (
                <button
                  onClick={handleApproveEstimate}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve Estimate
                </button>
              )}

              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
