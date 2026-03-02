import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, FileText, Briefcase, TrendingUp, DollarSign, CheckCircle, Clock } from 'lucide-react';

interface CRMStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  totalCustomers: number;
  totalQuotes: number;
  quotesValue: number;
  acceptedQuotes: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
  leadConversionRate: number;
  quoteAcceptanceRate: number;
}

interface RecentActivity {
  id: string;
  type: 'lead' | 'customer' | 'quote' | 'job';
  title: string;
  subtitle: string;
  timestamp: string;
  status?: string;
}

export default function CRMDashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<CRMStats>({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalQuotes: 0,
    quotesValue: 0,
    acceptedQuotes: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalRevenue: 0,
    leadConversionRate: 0,
    quoteAcceptanceRate: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile) {
      fetchDashboardData();
    }
  }, [userProfile]);

  const fetchDashboardData = async () => {
    try {
      const companyId = userProfile?.company_id;

      const [
        totalLeadsRes,
        newLeadsRes,
        qualifiedLeadsRes,
        convertedLeadsRes,
        customersRes,
        totalQuotesRes,
        acceptedQuotesRes,
        totalJobsRes,
        activeJobsRes,
        completedJobsRes,
        recentLeadsRes,
        recentQuotesRes
      ] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'new'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'qualified'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'converted'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('quotes').select('total_price').eq('company_id', companyId),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'accepted'),
        supabase.from('jobs').select('total_price').eq('company_id', companyId),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'in_progress'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed'),
        supabase.from('leads').select('id, contact_name, company_name, email, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('quotes').select('id, origin, destination, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5)
      ]);

      const totalLeads = totalLeadsRes.count || 0;
      const convertedLeads = convertedLeadsRes.count || 0;
      const totalQuotes = (totalQuotesRes.data || []).length;
      const acceptedQuotes = acceptedQuotesRes.count || 0;
      const totalJobs = (totalJobsRes.data || []).length;

      const quotesValue = (totalQuotesRes.data || []).reduce((sum, q) => sum + (q.total_price || 0), 0);
      const totalRevenue = (totalJobsRes.data || []).reduce((sum, j) => sum + (j.total_price || 0), 0);

      setStats({
        totalLeads,
        newLeads: newLeadsRes.count || 0,
        qualifiedLeads: qualifiedLeadsRes.count || 0,
        convertedLeads,
        totalCustomers: customersRes.count || 0,
        totalQuotes,
        quotesValue,
        acceptedQuotes,
        totalJobs,
        activeJobs: activeJobsRes.count || 0,
        completedJobs: completedJobsRes.count || 0,
        totalRevenue,
        leadConversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
        quoteAcceptanceRate: totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0
      });

      const activity: RecentActivity[] = [];

      (recentLeadsRes.data || []).forEach(lead => {
        activity.push({
          id: lead.id,
          type: 'lead',
          title: `New lead: ${lead.contact_name}`,
          subtitle: lead.company_name || lead.email || '',
          timestamp: lead.created_at,
          status: lead.status
        });
      });

      (recentQuotesRes.data || []).forEach(quote => {
        activity.push({
          id: quote.id,
          type: 'quote',
          title: `Quote created`,
          subtitle: `${quote.origin} → ${quote.destination}`,
          timestamp: quote.created_at,
          status: quote.status
        });
      });

      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activity.slice(0, 10));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lead': return <UserPlus className="h-5 w-5 text-blue-600" />;
      case 'customer': return <Users className="h-5 w-5 text-green-600" />;
      case 'quote': return <FileText className="h-5 w-5 text-purple-600" />;
      case 'job': return <Briefcase className="h-5 w-5 text-orange-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '';
    switch (status) {
      case 'new': return 'text-blue-600';
      case 'qualified': return 'text-green-600';
      case 'converted': return 'text-purple-600';
      case 'draft': return 'text-gray-600';
      case 'sent': return 'text-blue-600';
      case 'accepted': return 'text-green-600';
      case 'in_progress': return 'text-yellow-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">CRM Dashboard</h2>
        <p className="text-gray-600">Overview of your sales pipeline and customer relationships</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <UserPlus className="h-8 w-8 text-blue-600" />
            <span className="text-xs font-medium text-blue-800 bg-blue-200 px-2 py-1 rounded-full">
              {stats.newLeads} new
            </span>
          </div>
          <p className="text-3xl font-bold text-blue-900">{stats.totalLeads}</p>
          <p className="text-sm text-blue-700">Total Leads</p>
          <div className="mt-2 text-xs text-blue-600">
            {stats.qualifiedLeads} qualified • {stats.convertedLeads} converted
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-green-600" />
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">{stats.totalCustomers}</p>
          <p className="text-sm text-green-700">Total Customers</p>
          <div className="mt-2 text-xs text-green-600">
            {stats.leadConversionRate.toFixed(1)}% conversion rate
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 text-purple-600" />
            <span className="text-xs font-medium text-purple-800 bg-purple-200 px-2 py-1 rounded-full">
              {stats.acceptedQuotes} accepted
            </span>
          </div>
          <p className="text-3xl font-bold text-purple-900">{stats.totalQuotes}</p>
          <p className="text-sm text-purple-700">Total Quotes</p>
          <div className="mt-2 text-xs text-purple-600">
            ${stats.quotesValue.toLocaleString()} value
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <Briefcase className="h-8 w-8 text-orange-600" />
            <span className="text-xs font-medium text-orange-800 bg-orange-200 px-2 py-1 rounded-full">
              {stats.activeJobs} active
            </span>
          </div>
          <p className="text-3xl font-bold text-orange-900">{stats.totalJobs}</p>
          <p className="text-sm text-orange-700">Total Jobs</p>
          <div className="mt-2 text-xs text-orange-600">
            {stats.completedJobs} completed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Pipeline</h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700">Lead Conversion Rate</span>
                <span className="font-semibold text-gray-900">{stats.leadConversionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.leadConversionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700">Quote Acceptance Rate</span>
                <span className="font-semibold text-gray-900">{stats.quoteAcceptanceRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.quoteAcceptanceRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Pipeline Value</p>
              <p className="text-2xl font-bold text-blue-900">
                ${stats.quotesValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">
                ${stats.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-700 mb-1">Avg Quote Value</p>
              <p className="text-2xl font-bold text-purple-900">
                ${stats.totalQuotes > 0 ? Math.round(stats.quotesValue / stats.totalQuotes).toLocaleString() : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {activity.subtitle}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                    {activity.status && (
                      <span className={`text-xs font-medium ${getStatusColor(activity.status)} capitalize`}>
                        {activity.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <UserPlus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">New Leads This Month</p>
              <p className="text-xl font-bold text-gray-900">{stats.newLeads}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Track new lead generation
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Accepted Quotes</p>
              <p className="text-xl font-bold text-gray-900">{stats.acceptedQuotes}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            {stats.quoteAcceptanceRate.toFixed(1)}% acceptance rate
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Jobs</p>
              <p className="text-xl font-bold text-gray-900">{stats.activeJobs}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Jobs currently in progress
          </div>
        </div>
      </div>
    </div>
  );
}
