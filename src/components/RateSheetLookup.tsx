import React, { useState, useEffect } from 'react';
import { Search, FileSpreadsheet, Plus, CheckCircle2 } from 'lucide-react';
import { searchRates, getActiveRateSheets } from '../lib/rateSheetHelper';

interface RateSheetLookupProps {
  onRateSelected: (rateData: any) => void;
  shipmentType: 'import' | 'export';
}

interface RateSearchParams {
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  service_type: 'FCL' | 'LCL' | 'Air' | 'Road';
  container_type: string;
}

export default function RateSheetLookup({ onRateSelected, shipmentType }: RateSheetLookupProps) {
  const [showModal, setShowModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [activeSheets, setActiveSheets] = useState<any[]>([]);

  const [searchParams, setSearchParams] = useState<RateSearchParams>({
    origin_country: '',
    origin_port: '',
    destination_country: '',
    destination_port: '',
    service_type: 'FCL',
    container_type: '20ft',
  });

  useEffect(() => {
    if (showModal) {
      loadActiveSheets();
    }
  }, [showModal, shipmentType]);

  const loadActiveSheets = async () => {
    const sheets = await getActiveRateSheets(shipmentType);
    setActiveSheets(sheets);
  };

  const handleSearch = async () => {
    if (!searchParams.origin_country || !searchParams.destination_country) {
      alert('Please fill in origin and destination details');
      return;
    }

    setSearching(true);
    try {
      const result = await searchRates({
        ...searchParams,
        shipment_type: shipmentType,
      });
      setSearchResult(result);
    } catch (error) {
      console.error('Error searching rates:', error);
      alert('Error searching for rates');
    } finally {
      setSearching(false);
    }
  };

  const handleUseRate = () => {
    if (searchResult?.lane) {
      onRateSelected({
        lane: searchResult.lane,
        charges: searchResult.charges,
        total_base_cost: searchResult.total_base_cost,
        mandatory_charges: searchResult.mandatory_charges,
      });
      setShowModal(false);
      setSearchResult(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Search Rate Sheets
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Search Rate Sheets</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeSheets.length} active {shipmentType} rate sheet{activeSheets.length !== 1 ? 's' : ''} available
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSearchResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-6 h-6 transform rotate-45" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Search Criteria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origin Country
                    </label>
                    <input
                      type="text"
                      value={searchParams.origin_country}
                      onChange={(e) => setSearchParams({ ...searchParams, origin_country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., United Kingdom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origin Port
                    </label>
                    <input
                      type="text"
                      value={searchParams.origin_port}
                      onChange={(e) => setSearchParams({ ...searchParams, origin_port: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Felixstowe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination Country
                    </label>
                    <input
                      type="text"
                      value={searchParams.destination_country}
                      onChange={(e) => setSearchParams({ ...searchParams, destination_country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., United States"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination Port
                    </label>
                    <input
                      type="text"
                      value={searchParams.destination_port}
                      onChange={(e) => setSearchParams({ ...searchParams, destination_port: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., New York"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Type
                    </label>
                    <select
                      value={searchParams.service_type}
                      onChange={(e) => setSearchParams({ ...searchParams, service_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FCL">FCL (Full Container Load)</option>
                      <option value="LCL">LCL (Less than Container Load)</option>
                      <option value="Air">Air Freight</option>
                      <option value="Road">Road Transport</option>
                    </select>
                  </div>
                  {searchParams.service_type === 'FCL' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Container Type
                      </label>
                      <select
                        value={searchParams.container_type}
                        onChange={(e) => setSearchParams({ ...searchParams, container_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="20ft">20ft Standard</option>
                        <option value="40ft">40ft Standard</option>
                        <option value="40ft HC">40ft High Cube</option>
                        <option value="20ft RF">20ft Refrigerated</option>
                        <option value="40ft RF">40ft Refrigerated</option>
                      </select>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {searching ? 'Searching...' : 'Search Rates'}
                </button>
              </div>

              {searchResult && (
                <div className="space-y-4">
                  {searchResult.lane ? (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <h4 className="font-semibold text-green-900">Rate Found</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">Route</p>
                                <p className="font-medium text-gray-900">
                                  {searchResult.lane.origin_port}, {searchResult.lane.origin_country}
                                  <br />→ {searchResult.lane.destination_port}, {searchResult.lane.destination_country}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Service</p>
                                <p className="font-medium text-gray-900">
                                  {searchResult.lane.service_type}
                                  {searchResult.lane.container_type && ` - ${searchResult.lane.container_type}`}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Transit Time</p>
                                <p className="font-medium text-gray-900">{searchResult.lane.transit_days} days</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Total Base Cost</p>
                                <p className="font-medium text-gray-900 text-lg">
                                  ${searchResult.total_base_cost.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-green-200">
                              <h5 className="font-medium text-gray-900 mb-2">Cost Breakdown</h5>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Base Rate:</span>
                                  <span className="font-medium">${searchResult.lane.base_rate.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Fuel Surcharge:</span>
                                  <span className="font-medium">${searchResult.lane.fuel_surcharge.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Security Fee:</span>
                                  <span className="font-medium">${searchResult.lane.security_fee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Terminal Handling:</span>
                                  <span className="font-medium">${searchResult.lane.terminal_handling.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Documentation:</span>
                                  <span className="font-medium">${searchResult.lane.documentation_fee.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {searchResult.charges && searchResult.charges.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Additional Charges Available</h4>
                          <div className="space-y-2">
                            {searchResult.charges.map((charge: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{charge.charge_name}</p>
                                  <p className="text-xs text-gray-600">
                                    {charge.charge_type} • {charge.unit_type.replace(/_/g, ' ')}
                                    {charge.is_mandatory && ' • Mandatory'}
                                  </p>
                                </div>
                                <p className="font-medium text-gray-900">
                                  {charge.amount} {charge.currency}
                                </p>
                              </div>
                            ))}
                          </div>
                          {searchResult.mandatory_charges > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between font-semibold">
                              <span>Mandatory Charges Total:</span>
                              <span>${searchResult.mandatory_charges.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleUseRate}
                        className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
                      >
                        Use This Rate in Quote
                      </button>
                    </>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                      <p className="text-yellow-900 font-medium">No matching rate found</p>
                      <p className="text-sm text-yellow-700 mt-2">
                        Try adjusting your search criteria or add rates manually
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}