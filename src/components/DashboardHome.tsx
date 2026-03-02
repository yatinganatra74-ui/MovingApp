import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, FileText, Briefcase, DollarSign, TrendingUp, Package } from 'lucide-react';

interface Stats {
  surveys: number;
  quotes: number;
  activeJobs: number;
  pendingInvoices: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats>({
    surveys: 0,
    quotes: 0,
    activeJobs: 0,
    pendingInvoices: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [surveysRes, quotesRes, jobsRes, invoicesRes] = await Promise.all([
        supabase.from('surveys').select('id', { count: 'exact', head: true }),
        supabase.from('quotes').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('agent_invoices').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      setStats({
        surveys: surveysRes.count || 0,
        quotes: quotesRes.count || 0,
        activeJobs: jobsRes.count || 0,
        pendingInvoices: invoicesRes.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Surveys', value: stats.surveys, icon: ClipboardList, color: 'bg-blue-500' },
    { label: 'Quotes Generated', value: stats.quotes, icon: FileText, color: 'bg-green-500' },
    { label: 'Active Jobs', value: stats.activeJobs, icon: Briefcase, color: 'bg-orange-500' },
    { label: 'Pending Invoices', value: stats.pendingInvoices, icon: DollarSign, color: 'bg-red-500' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-600 mt-1">Welcome to MoveMaster Pro - Complete Removals Management</p>
        </div>
        <Package className="w-12 h-12 text-slate-900" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
              <p className="text-slate-600 text-sm mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
              <p className="font-semibold text-slate-900">Create New Survey</p>
              <p className="text-sm text-slate-600">Start a new property survey</p>
            </button>
            <button className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
              <p className="font-semibold text-slate-900">Generate Quote</p>
              <p className="text-sm text-slate-600">Create quote from existing survey</p>
            </button>
            <button className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
              <p className="font-semibold text-slate-900">Schedule Job</p>
              <p className="text-sm text-slate-600">Convert quote to active job</p>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">System Features</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Physical & Video Call Surveys</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Automatic Volume Calculation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Multi-Currency Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Groupage Container Management</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Destination Cost Profitability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Agent & Customer Billing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Tally Prime Export</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
