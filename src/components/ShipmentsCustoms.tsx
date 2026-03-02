import { useState, useEffect } from 'react';
import { Ship, FileText, Shield, DollarSign, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Shipment {
  id: string;
  job_number: string;
  customer_name: string;
  shipping_line: string;
  booking_number: string;
  container_number: string;
  vessel_name: string;
  port_of_loading: string;
  port_of_discharge: string;
  etd: string;
  eta: string;
  booking_status: string;
  days_to_arrival: number;
}

interface CustomsDoc {
  id: string;
  job_number: string;
  customer_name: string;
  document_type: string;
  document_number: string;
  status: string;
  issue_date: string;
  customs_value: number;
  total_charges: number;
  days_pending: number;
}

interface InsurancePolicy {
  id: string;
  job_id: string;
  policy_provider: string;
  policy_number: string;
  policy_type: string;
  coverage_amount: number;
  premium_amount: number;
  policy_status: string;
  policy_start_date: string;
  policy_end_date: string;
}

export default function ShipmentsCustoms() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customs, setCustoms] = useState<CustomsDoc[]>([]);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [shipmentsRes, customsRes, insuranceRes] = await Promise.all([
        supabase.from('active_shipments').select('*'),
        supabase.from('customs_pending').select('*'),
        supabase
          .from('insurance_policies')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (shipmentsRes.error) throw shipmentsRes.error;
      if (customsRes.error) throw customsRes.error;
      if (insuranceRes.error) throw insuranceRes.error;

      setShipments(shipmentsRes.data || []);
      setCustoms(customsRes.data || []);
      setInsurance(insuranceRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShipmentStatusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'bg-slate-100 text-slate-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'LOADED': return 'bg-yellow-100 text-yellow-800';
      case 'SAILING': return 'bg-orange-100 text-orange-800';
      case 'ARRIVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCustomsStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-800';
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'CLEARED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    activeShipments: shipments.length,
    pendingCustoms: customs.length,
    activePolicies: insurance.filter(p => p.policy_status === 'ACTIVE').length,
    totalCoverage: insurance
      .filter(p => p.policy_status === 'ACTIVE')
      .reduce((sum, p) => sum + p.coverage_amount, 0)
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading shipment data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Shipments & Customs</h1>
          <p className="text-slate-600 mt-1">Shipping lines, customs, and insurance management</p>
        </div>
        <Ship className="w-8 h-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Shipments</p>
              <p className="text-2xl font-bold text-slate-900">{stats.activeShipments}</p>
            </div>
            <Ship className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Customs</p>
              <p className="text-2xl font-bold text-orange-600">{stats.pendingCustoms}</p>
            </div>
            <FileText className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Policies</p>
              <p className="text-2xl font-bold text-green-600">{stats.activePolicies}</p>
            </div>
            <Shield className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Coverage</p>
              <p className="text-2xl font-bold text-blue-600">${stats.totalCoverage.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Ship className="w-5 h-5" />
            Active Shipments
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Job / Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Shipping Line</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Container</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Vessel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">ETA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shipments.map(ship => (
                <tr key={ship.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{ship.job_number}</p>
                      <p className="text-sm text-slate-500">{ship.customer_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{ship.shipping_line}</p>
                      <p className="text-sm text-slate-500">{ship.booking_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-slate-900">{ship.container_number || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-900">{ship.vessel_name || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-slate-900">{ship.port_of_loading}</p>
                      <p className="text-slate-500">→ {ship.port_of_discharge}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-slate-900">{ship.eta ? new Date(ship.eta).toLocaleDateString() : '-'}</p>
                      {ship.days_to_arrival !== null && (
                        <p className="text-sm text-blue-600 font-medium">{ship.days_to_arrival} days</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getShipmentStatusColor(ship.booking_status)}`}>
                      {ship.booking_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shipments.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No active shipments
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Pending Customs Documents
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {customs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{doc.document_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500">{doc.document_number}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-900">{doc.job_number}</p>
                        <p className="text-xs text-slate-500">{doc.customer_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-900">${doc.customs_value?.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Charges: ${doc.total_charges?.toFixed(2)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCustomsStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                      {doc.days_pending > 7 && (
                        <p className="text-xs text-red-600 mt-1">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          {doc.days_pending} days
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {customs.length === 0 && (
            <div className="text-center py-8 text-slate-500 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              All customs documents cleared
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Insurance Policies
            </h3>
          </div>

          <div className="divide-y divide-slate-200">
            {insurance.map(policy => (
              <div key={policy.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">{policy.policy_provider}</p>
                    <p className="text-sm text-slate-600">{policy.policy_number}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    policy.policy_status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    policy.policy_status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {policy.policy_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-600">Type</p>
                    <p className="font-medium text-slate-900">{policy.policy_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Coverage</p>
                    <p className="font-medium text-green-600">${policy.coverage_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Premium</p>
                    <p className="font-medium text-slate-900">${policy.premium_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Valid Until</p>
                    <p className="font-medium text-slate-900">
                      {new Date(policy.policy_end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {insurance.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No insurance policies
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
