import { useState, useEffect } from 'react';
import { QrCode, MapPin, Truck, Package, Clock, CheckCircle, AlertCircle, Scan } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BarcodeItem {
  id: string;
  barcode: string;
  job_id: string;
  carton_type: string;
  contents_description: string;
  room_origin: string;
  weight_kg: number;
  volume_cbm: number;
  current_status: string;
  current_location: string;
  packed_at: string;
  customer_id: string;
}

interface GPSTracking {
  id: string;
  job_id: string;
  vehicle_number: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  tracking_status: string;
  battery_level: number;
  gps_timestamp: string;
}

export default function AdvancedTracking() {
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([]);
  const [gpsData, setGpsData] = useState<GPSTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanBarcode, setScanBarcode] = useState('');
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [barcodesRes, gpsRes] = await Promise.all([
        supabase
          .from('barcode_tracking')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('gps_tracking')
          .select('*')
          .eq('tracking_status', 'ACTIVE')
          .order('gps_timestamp', { ascending: false })
      ]);

      if (barcodesRes.error) throw barcodesRes.error;
      if (gpsRes.error) throw gpsRes.error;

      setBarcodes(barcodesRes.data || []);
      setGpsData(gpsRes.data || []);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = async (scanType: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.rpc('track_barcode_scan', {
        p_barcode: scanBarcode,
        p_scan_type: scanType,
        p_scanned_by: user?.id,
        p_location: 'Manual Scan'
      });

      if (error) throw error;

      alert('Barcode scanned successfully!');
      setScanBarcode('');
      setShowScanModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error scanning barcode:', error);
      alert(error.message || 'Failed to scan barcode');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PACKED': return 'bg-blue-100 text-blue-800';
      case 'LOADED': return 'bg-yellow-100 text-yellow-800';
      case 'IN_TRANSIT': return 'bg-orange-100 text-orange-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'STORED': return 'bg-slate-100 text-slate-800';
      case 'DAMAGED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    totalCartons: barcodes.length,
    delivered: barcodes.filter(b => b.current_status === 'DELIVERED').length,
    inTransit: barcodes.filter(b => b.current_status === 'IN_TRANSIT').length,
    activeVehicles: gpsData.length
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading tracking data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Advanced Tracking</h1>
          <p className="text-slate-600 mt-1">Barcode scanning and GPS tracking</p>
        </div>
        <button
          onClick={() => setShowScanModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Scan className="w-5 h-5" />
          Scan Barcode
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Cartons</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalCartons}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">In Transit</p>
              <p className="text-2xl font-bold text-orange-600">{stats.inTransit}</p>
            </div>
            <Truck className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Vehicles</p>
              <p className="text-2xl font-bold text-blue-600">{stats.activeVehicles}</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Recent Barcode Scans
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Contents</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {barcodes.slice(0, 10).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm font-medium text-slate-900">
                          {item.barcode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">{item.contents_description}</p>
                      <p className="text-xs text-slate-500">{item.carton_type}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.current_status)}`}>
                        {item.current_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-sm text-slate-600">{item.current_location || '-'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Live GPS Tracking
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {gpsData.map(gps => (
              <div key={gps.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-slate-900">{gps.vehicle_number}</span>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                    {gps.tracking_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">
                      {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{gps.speed_kmh.toFixed(1)} km/h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">
                      {new Date(gps.gps_timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Battery: {gps.battery_level}%</span>
                  </div>
                </div>
              </div>
            ))}

            {gpsData.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No active GPS tracking
              </div>
            )}
          </div>
        </div>
      </div>

      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Scan className="w-6 h-6" />
              Scan Barcode
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Barcode Number
                </label>
                <input
                  type="text"
                  value={scanBarcode}
                  onChange={(e) => setScanBarcode(e.target.value)}
                  placeholder="Enter or scan barcode..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleScanBarcode('LOAD')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Load
                </button>
                <button
                  onClick={() => handleScanBarcode('UNLOAD')}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                >
                  Unload
                </button>
                <button
                  onClick={() => handleScanBarcode('DELIVER')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Deliver
                </button>
                <button
                  onClick={() => handleScanBarcode('WAREHOUSE_IN')}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm"
                >
                  Warehouse In
                </button>
              </div>

              <button
                onClick={() => {
                  setShowScanModal(false);
                  setScanBarcode('');
                }}
                className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
