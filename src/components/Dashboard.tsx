import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Package,
  ClipboardList,
  FileText,
  Briefcase,
  Users,
  Box,
  DollarSign,
  UserCircle,
  LogOut,
  BarChart3,
  Menu,
  X,
  Calculator,
  Warehouse,
  QrCode,
  Ship,
  MessageSquare,
  FileSpreadsheet,
  Truck,
  Building2
} from 'lucide-react';
import Surveys from './Surveys';
import Quotes from './Quotes';
import Jobs from './Jobs';
import Crew from './Crew';
import Inventory from './Inventory';
import Containers from './Containers';
import Invoices from './Invoices';
import Customers from './Customers';
import DashboardHome from './DashboardHome';
import PricingCalculator from './PricingCalculator';
import MaterialCalculator from './MaterialCalculator';
import CostingCalculator from './CostingCalculator';
import Warehousing from './Warehousing';
import AdvancedTracking from './AdvancedTracking';
import ShipmentsCustoms from './ShipmentsCustoms';
import NotificationsPayments from './NotificationsPayments';
import RateSheets from './RateSheets';
import WarehouseView from './WarehouseView';
import Shipments from './Shipments';
import GroupageContainers from './GroupageContainers';
import StorageBilling from './StorageBilling';
import ManualTruckingCost from './ManualTruckingCost';
import DistanceCalculator from './DistanceCalculator';
import ImportShipmentCreate from './ImportShipmentCreate';
import InboundWorkflow from './InboundWorkflow';
import PreAlertManager from './PreAlertManager';
import ShipmentDraftEntry from './ShipmentDraftEntry';
import BillingInvoices from './BillingInvoices';
import ShipmentProfitView from './ShipmentProfitView';
import ContainerCostEntry from './ContainerCostEntry';
import ContainerClosure from './ContainerClosure';
import CRMDashboard from './CRMDashboard';
import CompanySettings from './CompanySettings';
import Leads from './Leads';
import VendorMaster from './VendorMaster';
import InboundJobCreation from './InboundJobCreation';
import GroupageTariffManager from './GroupageTariffManager';
import GroupageQuoteGenerator from './GroupageQuoteGenerator';

type View = 'home' | 'surveys' | 'quotes' | 'jobs' | 'crew' | 'inventory' | 'containers' | 'invoices' | 'customers' | 'pricing' | 'materials' | 'costing' | 'warehousing' | 'tracking' | 'shipments' | 'shipmentsold' | 'notifications' | 'rates' | 'groupage' | 'storage' | 'trucking' | 'distance' | 'importcreate' | 'warehouseops' | 'workflow' | 'prealert' | 'drafts' | 'profit' | 'containercosts' | 'billing' | 'closure' | 'crm' | 'leads' | 'vendors' | 'inboundjobs' | 'groupagetariff' | 'groupagequote' | 'settings';

export default function Dashboard() {
  const { user, userRole, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>(userRole === 'warehouse' ? 'warehouseops' : 'home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('MoveMaster Pro');

  useEffect(() => {
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name, logo_url')
        .single();

      if (data) {
        setCompanyName(data.company_name || 'MoveMaster Pro');
        if (data.logo_url) {
          const { data: publicUrl } = supabase.storage
            .from('company-logos')
            .getPublicUrl(data.logo_url);
          setCompanyLogo(publicUrl.publicUrl);
        }
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const warehouseNavigation = [
    { id: 'warehouseops', label: 'Delivery Operations', icon: Truck },
  ];

  const adminNavigation = [
    { id: 'home', label: 'Dashboard', icon: BarChart3 },
    { id: 'settings', label: 'Company Settings', icon: Building2 },
    { id: 'crm', label: 'CRM Dashboard', icon: Users },
    { id: 'leads', label: 'Leads', icon: UserCircle },
    { id: 'customers', label: 'Customers', icon: UserCircle },
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'quotes', label: 'Quotes', icon: FileText },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'prealert', label: 'Pre-Alert & Containers', icon: FileText },
    { id: 'drafts', label: 'Shipment Drafts', icon: FileText },
    { id: 'profit', label: 'Profit & Cost Planning', icon: DollarSign },
    { id: 'containercosts', label: 'Container Costs', icon: DollarSign },
    { id: 'workflow', label: 'Inbound Workflow', icon: ClipboardList },
    { id: 'inboundjobs', label: 'Create Jobs from Inbound', icon: Ship },
    { id: 'rates', label: 'Rate Sheets', icon: FileSpreadsheet },
    { id: 'importcreate', label: 'Create Import Shipment', icon: Ship },
    { id: 'shipments', label: 'Shipments', icon: Ship },
    { id: 'groupage', label: 'Groupage Containers', icon: Package },
    { id: 'groupagetariff', label: 'Groupage Tariffs', icon: FileSpreadsheet },
    { id: 'groupagequote', label: 'Groupage Quotes', icon: FileText },
    { id: 'trucking', label: 'Manual Trucking', icon: Truck },
    { id: 'distance', label: 'Distance Calculator', icon: Calculator },
    { id: 'storage', label: 'Storage Billing', icon: Warehouse },
    { id: 'billing', label: 'Billing & Invoices', icon: DollarSign },
    { id: 'closure', label: 'Container Closure', icon: Package },
    { id: 'pricing', label: 'Pricing', icon: Calculator },
    { id: 'costing', label: 'Costing Engine', icon: DollarSign },
    { id: 'materials', label: 'Material Calculator', icon: Package },
    { id: 'crew', label: 'Crew', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Box },
    { id: 'warehousing', label: 'Warehousing', icon: Warehouse },
    { id: 'tracking', label: 'Tracking', icon: QrCode },
    { id: 'shipmentsold', label: 'Shipments & Customs', icon: Ship },
    { id: 'notifications', label: 'Notifications & Payments', icon: MessageSquare },
    { id: 'containers', label: 'Containers', icon: Package },
    { id: 'invoices', label: 'Invoicing', icon: FileText },
  ];

  const navigation = userRole === 'warehouse' ? warehouseNavigation : adminNavigation;

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <DashboardHome />;
      case 'settings':
        return <CompanySettings />;
      case 'crm':
        return <CRMDashboard />;
      case 'leads':
        return <Leads />;
      case 'vendors':
        return <VendorMaster />;
      case 'prealert':
        return <PreAlertManager />;
      case 'drafts':
        return <ShipmentDraftEntry />;
      case 'profit':
        return <ShipmentProfitView />;
      case 'containercosts':
        return <ContainerCostEntry />;
      case 'workflow':
        return <InboundWorkflow />;
      case 'inboundjobs':
        return <InboundJobCreation />;
      case 'rates':
        return <RateSheets />;
      case 'importcreate':
        return <ImportShipmentCreate />;
      case 'shipments':
        return <Shipments />;
      case 'groupage':
        return <GroupageContainers />;
      case 'groupagetariff':
        return <GroupageTariffManager />;
      case 'groupagequote':
        return <GroupageQuoteGenerator />;
      case 'trucking':
        return <ManualTruckingCost />;
      case 'distance':
        return <DistanceCalculator />;
      case 'storage':
        return <StorageBilling />;
      case 'billing':
        return <BillingInvoices />;
      case 'closure':
        return <ContainerClosure />;
      case 'pricing':
        return <PricingCalculator />;
      case 'costing':
        return <CostingCalculator />;
      case 'materials':
        return <MaterialCalculator />;
      case 'surveys':
        return <Surveys />;
      case 'quotes':
        return <Quotes />;
      case 'jobs':
        return <Jobs />;
      case 'crew':
        return <Crew />;
      case 'inventory':
        return <Inventory />;
      case 'warehousing':
        return <Warehousing />;
      case 'tracking':
        return <AdvancedTracking />;
      case 'shipmentsold':
        return <ShipmentsCustoms />;
      case 'notifications':
        return <NotificationsPayments />;
      case 'containers':
        return <Containers />;
      case 'invoices':
        return <Invoices />;
      case 'customers':
        return <Customers />;
      case 'warehouseops':
        return <WarehouseView />;
      default:
        return userRole === 'warehouse' ? <WarehouseView /> : <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-slate-900 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="h-8 object-contain" />
          ) : (
            <Package className="w-6 h-6 text-white" />
          )}
          <span className="text-white font-bold text-lg">{companyName}</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-white p-2"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white
        transform transition-transform duration-300 ease-in-out z-40
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 flex flex-col
      `}>
        <div className="p-6 hidden lg:block flex-shrink-0">
          <div className="flex items-center gap-3 mb-8">
            {companyLogo ? (
              <img src={companyLogo} alt={companyName} className="h-12 object-contain" />
            ) : (
              <div className="bg-white p-2 rounded-lg">
                <Package className="w-6 h-6 text-slate-900" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{companyName}</h1>
              <p className="text-xs text-slate-400">Freight Management</p>
            </div>
          </div>
        </div>

        <nav className="px-3 mt-20 lg:mt-0 flex-1 overflow-y-auto pb-24">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as View);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1
                  transition-all duration-200
                  ${isActive
                    ? 'bg-white text-slate-900 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 bg-slate-900 flex-shrink-0">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-sm text-white truncate">{user?.email}</p>
            {userRole && (
              <div className={`inline-block px-2 py-1 rounded text-xs font-semibold mt-1 ${
                userRole === 'warehouse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-green-600 text-white'
              }`}>
                {userRole === 'warehouse' ? 'Warehouse Team' : 'Admin'}
              </div>
            )}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
