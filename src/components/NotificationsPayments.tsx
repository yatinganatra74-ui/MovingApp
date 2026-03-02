import { useState, useEffect } from 'react';
import { MessageSquare, CreditCard, Send, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  notification_type: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  message_content: string;
  status: string;
  scheduled_at: string;
  retry_count: number;
}

interface Payment {
  customer_name: string;
  transaction_count: number;
  total_paid: number;
  total_pending: number;
  total_failed: number;
  last_payment_date: string;
}

interface PaymentTransaction {
  id: string;
  customer_id: string;
  payment_gateway: string;
  transaction_id: string;
  amount: number;
  payment_status: string;
  payment_method: string;
  initiated_at: string;
  completed_at: string;
}

export default function NotificationsPayments() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [notificationsRes, paymentsRes, transactionsRes] = await Promise.all([
        supabase.from('pending_notifications').select('*').limit(20),
        supabase.from('payment_summary').select('*'),
        supabase
          .from('payment_transactions')
          .select('*')
          .order('initiated_at', { ascending: false })
          .limit(20)
      ]);

      if (notificationsRes.error) throw notificationsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      setNotifications(notificationsRes.data || []);
      setPayments(paymentsRes.data || []);
      setTransactions(transactionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP': return '💬';
      case 'SMS': return '📱';
      case 'EMAIL': return '📧';
      case 'PUSH': return '🔔';
      default: return '📨';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.total_paid, 0);
  const totalPending = payments.reduce((sum, p) => sum + p.total_pending, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notifications & Payments</h1>
          <p className="text-slate-600 mt-1">WhatsApp, SMS, Email and Payment Gateway</p>
        </div>
        <MessageSquare className="w-8 h-8 text-blue-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Notifications</p>
              <p className="text-2xl font-bold text-orange-600">{notifications.length}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-600">${totalPending.toLocaleString()}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{transactions.length}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Notification Queue
            </h3>
          </div>

          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {notifications.map(notif => (
              <div key={notif.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getNotificationIcon(notif.notification_type)}</span>
                    <div>
                      <p className="font-medium text-slate-900">{notif.recipient_name}</p>
                      <p className="text-sm text-slate-600">
                        {notif.notification_type === 'WHATSAPP' || notif.notification_type === 'SMS'
                          ? notif.recipient_phone
                          : notif.recipient_email}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(notif.status)}`}>
                    {notif.status}
                  </span>
                </div>

                <p className="text-sm text-slate-700 bg-slate-50 rounded p-2 mt-2">
                  {notif.message_content}
                </p>

                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>{notif.notification_type}</span>
                  <span>Retries: {notif.retry_count}</span>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No pending notifications
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Summary by Customer
            </h3>
          </div>

          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {payments.map((payment, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{payment.customer_name}</p>
                    <p className="text-sm text-slate-600">{payment.transaction_count} transactions</p>
                  </div>
                  {payment.last_payment_date && (
                    <span className="text-xs text-slate-500">
                      {new Date(payment.last_payment_date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-slate-600 text-xs">Paid</p>
                    <p className="font-bold text-green-600">${payment.total_paid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs">Pending</p>
                    <p className="font-bold text-yellow-600">${payment.total_pending.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 text-xs">Failed</p>
                    <p className="font-bold text-red-600">${payment.total_failed.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}

            {payments.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No payment data
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Recent Transactions
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Gateway</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.map(txn => (
                <tr key={txn.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-slate-900">{txn.transaction_id || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900">{txn.payment_gateway}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900">${txn.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-600">{txn.payment_method || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(txn.payment_status)}`}>
                      {txn.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(txn.initiated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No transactions
          </div>
        )}
      </div>
    </div>
  );
}
