import { useState, useEffect } from 'react';
import { Calculator, Package, AlertCircle } from 'lucide-react';

export default function MaterialCalculator() {
  const [totalCBM, setTotalCBM] = useState<number>(0);
  const [fragileItems, setFragileItems] = useState<number>(0);
  const [results, setResults] = useState<any>({});

  useEffect(() => {
    calculateMaterials();
  }, [totalCBM, fragileItems]);

  const calculateMaterials = () => {
    const cartons = Math.ceil(totalCBM * 0.8);
    const bubbleWrap = fragileItems * 2;
    const tapeRolls = Math.ceil(cartons / 10) || 0;
    const stretchFilm = Math.ceil(totalCBM * 0.5);
    const packingPaper = fragileItems * 5;
    const furnitureCovers = Math.ceil(totalCBM * 0.3);
    const cornerProtectors = Math.ceil(totalCBM * 0.4);

    setResults({
      'Standard Cartons': { value: cartons, unit: 'boxes', formula: 'Total CBM × 0.8' },
      'Bubble Wrap': { value: bubbleWrap, unit: 'meters', formula: 'Fragile Items × 2' },
      'Packing Tape': { value: tapeRolls, unit: 'rolls', formula: 'Total Cartons ÷ 10' },
      'Stretch Film': { value: stretchFilm, unit: 'rolls', formula: 'Total CBM × 0.5' },
      'Packing Paper': { value: packingPaper, unit: 'sheets', formula: 'Fragile Items × 5' },
      'Furniture Covers': { value: furnitureCovers, unit: 'pieces', formula: 'Total CBM × 0.3' },
      'Corner Protectors': { value: cornerProtectors, unit: 'pieces', formula: 'Total CBM × 0.4' }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Quick Material Calculator
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Instant packing material estimates based on industry formulas
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Total Volume (CBM)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={totalCBM || ''}
                onChange={(e) => setTotalCBM(parseFloat(e.target.value) || 0)}
                placeholder="Enter total cubic meters"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
              />
              <p className="text-xs text-slate-500 mt-2">
                Total volume of all items to be packed
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
              <label className="block text-sm font-medium text-orange-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Fragile Items Count
              </label>
              <input
                type="number"
                min="0"
                value={fragileItems || ''}
                onChange={(e) => setFragileItems(parseInt(e.target.value) || 0)}
                placeholder="Number of fragile items"
                className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg bg-white"
              />
              <p className="text-xs text-orange-700 mt-2">
                Items requiring extra protection (glassware, electronics, etc.)
              </p>
            </div>
          </div>

          {(totalCBM > 0 || fragileItems > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Calculated Materials</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(results).map(([name, data]: [string, any]) => (
                  data.value > 0 && (
                    <div key={name} className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-5 border border-blue-200 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 mb-1">{name}</h4>
                          <p className="text-xs text-slate-600">{data.formula}</p>
                        </div>
                        <Package className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-blue-600">
                          {data.value}
                        </span>
                        <span className="text-sm text-slate-600">{data.unit}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>

              <div className="mt-6 bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Formula Reference</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-800">
                  <div>Standard Cartons = Total CBM × 0.8</div>
                  <div>Bubble Wrap = Fragile Items × 2 meters</div>
                  <div>Packing Tape = Cartons ÷ 10 rolls</div>
                  <div>Stretch Film = Total CBM × 0.5 rolls</div>
                  <div>Packing Paper = Fragile Items × 5 sheets</div>
                  <div>Furniture Covers = Total CBM × 0.3 pieces</div>
                </div>
              </div>
            </div>
          )}

          {totalCBM === 0 && fragileItems === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Calculator className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg">Enter volume and fragile item count to see estimates</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-slate-50 rounded-lg p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-3">Quick Reference Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Standard CBM Values</h4>
            <ul className="space-y-1">
              <li>1-bedroom apartment: 15-25 CBM</li>
              <li>2-bedroom apartment: 30-40 CBM</li>
              <li>3-bedroom house: 50-70 CBM</li>
              <li>4-bedroom house: 80-100 CBM</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Common Fragile Items</h4>
            <ul className="space-y-1">
              <li>Glassware, china, ceramics</li>
              <li>TVs, monitors, electronics</li>
              <li>Mirrors, picture frames, artwork</li>
              <li>Lamps, vases, decorative items</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
