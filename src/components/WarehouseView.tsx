import React, { useState, useEffect, useRef } from 'react';
import { Truck, Package, MapPin, Calendar, User, Phone, Mail, CheckCircle, Upload, FileText, Camera, X, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Shipment {
  id: string;
  shipment_number: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  delivery_address: string;
  delivery_city: string;
  delivery_date: string;
  trucking_instructions: string;
  status: string;
  pod_uploaded: boolean;
  signature_captured: boolean;
  delivery_notes: string;
}

export default function WarehouseView() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('import_shipments')
        .select('*')
        .in('status', ['in_transit', 'ready_for_delivery', 'out_for_delivery'])
        .order('delivery_date', { ascending: true });

      if (error) throw error;

      setShipments(data || []);
    } catch (error) {
      console.error('Error loading shipments:', error);
      alert('Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const handlePODUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedShipment) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedShipment.shipment_number}_POD_${Date.now()}.${fileExt}`;
      const filePath = `pods/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('import_shipments')
        .update({ pod_uploaded: true })
        .eq('id', selectedShipment.id);

      if (updateError) throw updateError;

      alert('POD uploaded successfully!');
      loadShipments();
      setSelectedShipment({ ...selectedShipment, pod_uploaded: true });
    } catch (error) {
      console.error('Error uploading POD:', error);
      alert('Failed to upload POD');
    } finally {
      setUploading(false);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = async () => {
    if (!selectedShipment) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setUploading(true);

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Failed to create signature image');

        const fileName = `${selectedShipment.shipment_number}_SIGNATURE_${Date.now()}.png`;
        const filePath = `signatures/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
          .from('import_shipments')
          .update({
            signature_captured: true,
            delivery_notes: deliveryNotes,
            status: 'delivered',
          })
          .eq('id', selectedShipment.id);

        if (updateError) throw updateError;

        alert('Signature saved and delivery confirmed!');
        setIsDrawingSignature(false);
        loadShipments();
        setSelectedShipment(null);
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Failed to save signature');
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_delivery':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_transit':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_for_delivery':
        return 'Ready for Delivery';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'in_transit':
        return 'In Transit';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shipments...</p>
        </div>
      </div>
    );
  }

  if (selectedShipment) {
    return (
      <div className="min-h-screen bg-gray-50 pb-6">
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-md">
          <button
            onClick={() => {
              setSelectedShipment(null);
              setIsDrawingSignature(false);
              setDeliveryNotes('');
            }}
            className="flex items-center gap-2 mb-3"
          >
            <X className="w-5 h-5" />
            <span>Back to List</span>
          </button>
          <h1 className="text-2xl font-bold">{selectedShipment.shipment_number}</h1>
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 border-2 ${getStatusColor(selectedShipment.status)}`}>
            {getStatusLabel(selectedShipment.status)}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-blue-500">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Client Details
            </h2>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Name:</span>
                <p className="font-semibold text-gray-900">{selectedShipment.client_name}</p>
              </div>
              {selectedShipment.client_phone && (
                <div>
                  <span className="text-sm text-gray-600">Phone:</span>
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    <a href={`tel:${selectedShipment.client_phone}`} className="text-blue-600">
                      {selectedShipment.client_phone}
                    </a>
                  </p>
                </div>
              )}
              {selectedShipment.client_email && (
                <div>
                  <span className="text-sm text-gray-600">Email:</span>
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <a href={`mailto:${selectedShipment.client_email}`} className="text-blue-600">
                      {selectedShipment.client_email}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-green-500">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Delivery Address
            </h2>
            <p className="font-semibold text-gray-900 text-lg">{selectedShipment.delivery_address}</p>
            <p className="text-gray-700 mt-1">{selectedShipment.delivery_city}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedShipment.delivery_address + ' ' + selectedShipment.delivery_city)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
            >
              Open in Google Maps
            </a>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-orange-500">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              Delivery Date
            </h2>
            <p className="font-bold text-gray-900 text-2xl">
              {new Date(selectedShipment.delivery_date).toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {selectedShipment.trucking_instructions && (
            <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-yellow-500">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-yellow-600" />
                Trucking Instructions
              </h2>
              <p className="text-gray-900 font-medium whitespace-pre-wrap">{selectedShipment.trucking_instructions}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-purple-500">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Proof of Delivery (POD)
            </h2>

            {selectedShipment.pod_uploaded ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">POD Uploaded</p>
                  <p className="text-sm text-green-700">Document received successfully</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block w-full cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handlePODUpload}
                    disabled={uploading}
                    className="hidden"
                    capture="environment"
                  />
                  <div className="bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-3 font-semibold text-lg">
                    {uploading ? (
                      <>
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6" />
                        Take Photo / Upload POD
                      </>
                    )}
                  </div>
                </label>
                <p className="text-sm text-gray-600 mt-2 text-center">Take a photo of the delivery document</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-5 border-l-4 border-red-500">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-red-600" />
              Customer Signature
            </h2>

            {selectedShipment.signature_captured ? (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Signature Captured</p>
                  <p className="text-sm text-green-700">Delivery confirmed</p>
                </div>
              </div>
            ) : (
              <>
                {!isDrawingSignature ? (
                  <button
                    onClick={() => setIsDrawingSignature(true)}
                    disabled={!selectedShipment.pod_uploaded}
                    className="w-full bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-semibold text-lg"
                  >
                    <CheckCircle className="w-6 h-6" />
                    Capture Signature
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Delivery Notes (Optional)
                      </label>
                      <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Add any notes about the delivery..."
                        className="w-full border-2 border-gray-300 rounded-lg p-3 text-gray-900"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Customer Signature
                      </label>
                      <div className="border-4 border-gray-400 rounded-lg bg-white">
                        <canvas
                          ref={canvasRef}
                          width={800}
                          height={300}
                          className="w-full touch-none"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-2 text-center">
                        Draw signature above
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={clearSignature}
                        className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 font-semibold"
                      >
                        <X className="w-5 h-5" />
                        Clear
                      </button>
                      <button
                        onClick={saveSignature}
                        disabled={uploading}
                        className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                      >
                        {uploading ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save & Confirm
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {!isDrawingSignature && (
                  <p className="text-sm text-gray-600 mt-2 text-center">
                    {!selectedShipment.pod_uploaded ? 'Upload POD first to capture signature' : 'Get customer signature to confirm delivery'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-md">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-7 h-7" />
          Warehouse Operations
        </h1>
        <p className="text-blue-100 text-sm mt-1">Delivery Management</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Deliveries</p>
              <p className="text-3xl font-bold text-blue-600">{shipments.length}</p>
            </div>
            <button
              onClick={loadShipments}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Deliveries</h3>
            <p className="text-gray-600">All shipments have been delivered</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                onClick={() => setSelectedShipment(shipment)}
                className="bg-white rounded-lg shadow-md p-5 border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{shipment.shipment_number}</h3>
                    <div className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 border ${getStatusColor(shipment.status)}`}>
                      {getStatusLabel(shipment.status)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {shipment.pod_uploaded && (
                      <div className="bg-green-100 p-2 rounded-full">
                        <FileText className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                    {shipment.signature_captured && (
                      <div className="bg-blue-100 p-2 rounded-full">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{shipment.client_name}</p>
                      {shipment.client_phone && (
                        <p className="text-sm text-gray-600">{shipment.client_phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{shipment.delivery_city}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(shipment.delivery_date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex gap-3 text-xs">
                    {!shipment.pod_uploaded && (
                      <span className="text-orange-600 font-semibold">POD Pending</span>
                    )}
                    {!shipment.signature_captured && (
                      <span className="text-red-600 font-semibold">Signature Pending</span>
                    )}
                    {shipment.pod_uploaded && shipment.signature_captured && (
                      <span className="text-green-600 font-semibold">Ready to Complete</span>
                    )}
                  </div>
                  <span className="text-blue-600 font-semibold text-sm">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
