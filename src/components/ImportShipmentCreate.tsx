import React, { useState, useEffect } from 'react';
import { Ship, Plus, X, Package, FileText, DollarSign, Trash2, Save, AlertCircle, User, MapPin, Truck, Lock, Unlock, Calculator, Shield, TrendingUp, TrendingDown, Minus, CheckCircle, Upload, Printer, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchSlabBasedRates, generateRevenueLineItems, type RevenueLineItem } from '../lib/rateSheetHelper';
import { calculateImportShipment, saveCalculatedShipment } from '../lib/importCalculationEngine';

interface Container {
  id: string;
  container_number: string;
  container_type: string;
  status: string;
}

interface Agent {
  id: string;
  agent_name: string;
  agent_code: string;
}

interface RateSheet {
  id: string;
  rate_sheet_name: string;
  agent_id: string;
  valid_from: string;
  valid_to: string;
}

interface Customer {
  id: string;
  customer_name: string;
  company_name: string;
}

interface DeliveryZone {
  id: string;
  zone_name: string;
  city_name: string;
}

interface OriginCountry {
  id: string;
  country_name: string;
  country_code: string;
  region: string;
}

interface IndianCity {
  id: string;
  city_name: string;
  state_name: string;
  zone_type: string;
}

interface CargoItem {
  id?: string;
  customer_id: string;
  cargo_description: string;
  commodity_type: string;
  hs_code: string;
  number_of_packages: number;
  package_type: string;
  gross_weight_kg: number;
  net_weight_kg: number;
  volume_cbm: number;
  chargeable_weight: number;
  marks_and_numbers: string;
  delivery_address: string;
  delivery_zone_id: string;
  delivery_instructions: string;
  cargo_value_usd: number;
  insurance_required: boolean;
  insurance_value: number;
  special_handling: string;
}

export default function ImportShipmentCreate() {
  const { user } = useAuth();
  const [containers, setContainers] = useState<Container[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [originCountries, setOriginCountries] = useState<OriginCountry[]>([]);
  const [indianCities, setIndianCities] = useState<IndianCity[]>([]);

  const [saving, setSaving] = useState(false);
  const [shipmentNumber, setShipmentNumber] = useState('');

  const [formData, setFormData] = useState({
    container_id: '',
    agent_id: '',
    rate_sheet_id: '',
    shipment_type: 'LCL',
    port_of_loading: '',
    port_of_discharge: 'Nhava Sheva',
    eta: '',
    pre_alert_received: false,
    pre_alert_date: '',
    shipper_name: '',
    shipper_address: '',
    consignee_name: '',
    consignee_address: '',
    bl_number: '',
    bl_date: '',
    vessel_name: '',
    voyage_number: '',
    internal_notes: '',
    customer_notes: '',
    client_name: '',
    origin_country: '',
    delivery_address_full: '',
    delivery_city: '',
    delivery_zone_type: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    summary_total_cbm: 0,
    summary_total_weight_kg: 0,
    summary_total_packages: 0,
    delivery_included: false,
    requires_trucking: false,
    trucking_distance_km: 0,
    trucking_vendor: '',
    trucking_cost_revenue: 0,
    trucking_cost_actual: 0,
    trucking_vehicle_type: '',
    trucking_from_location: 'Nhava Sheva Port',
    trucking_to_location: '',
    trucking_notes: '',
    trucking_billable: true,
  });

  const [cargoItems, setCargoItems] = useState<CargoItem[]>([]);
  const [showAddCargo, setShowAddCargo] = useState(false);

  const [newCargo, setNewCargo] = useState<CargoItem>({
    customer_id: '',
    cargo_description: '',
    commodity_type: '',
    hs_code: '',
    number_of_packages: 0,
    package_type: 'Carton',
    gross_weight_kg: 0,
    net_weight_kg: 0,
    volume_cbm: 0,
    chargeable_weight: 0,
    marks_and_numbers: '',
    delivery_address: '',
    delivery_zone_id: '',
    delivery_instructions: '',
    cargo_value_usd: 0,
    insurance_required: false,
    insurance_value: 0,
    special_handling: '',
  });

  const packageTypes = ['Carton', 'Pallet', 'Crate', 'Drum', 'Bag', 'Bundle', 'Roll', 'Other'];
  const shipmentTypes = ['LCL', 'FCL', 'Air'];

  const [revenueItems, setRevenueItems] = useState<RevenueLineItem[]>([]);
  const [revenueCurrency, setRevenueCurrency] = useState<string>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(83.50);
  const [isExchangeRateLocked, setIsExchangeRateLocked] = useState<boolean>(false);
  const [showRevenueDetails, setShowRevenueDetails] = useState<boolean>(false);

  const [truckingVendors, setTruckingVendors] = useState<any[]>([]);
  const [showAdditionalTrucking, setShowAdditionalTrucking] = useState<boolean>(false);
  const [truckingData, setTruckingData] = useState({
    truck_type: '20ft Container',
    vendor_id: '',
    vendor_name: '',
    base_truck_cost_inr: 0,
    toll_estimate: 0,
    escort_special_handling: 0,
    margin_percentage: 0,
    is_billable: false,
    charge_currency: 'INR',
    route_details: '',
    distance_km: 0,
    notes: '',
  });

  const truckTypes = [
    '20ft Container',
    '24ft Closed',
    '32ft Open',
    '40ft Trailer',
    'Multi-Axle',
    'ODC (Over Dimensional Cargo)',
    'Flatbed',
    'Other'
  ];

  const [containerAllocation, setContainerAllocation] = useState({
    container_total_cbm: 0,
    shipment_total_cbm: 0,
    allocation_percentage: 0,
    container_total_cost_inr: 0,
    allocated_container_cost_inr: 0,
    is_allocation_overridden: false,
  });

  const [showAdminOverride, setShowAdminOverride] = useState<boolean>(false);
  const [overrideAmount, setOverrideAmount] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const [storageRateSheets, setStorageRateSheets] = useState<any[]>([]);
  const [storageSlabs, setStorageSlabs] = useState<any[]>([]);
  const [storageData, setStorageData] = useState({
    storage_rate_sheet_id: '',
    storage_free_days: 0,
    storage_start_date: '',
    storage_delivery_date: '',
    storage_total_days: 0,
    storage_chargeable_days: 0,
    storage_rate_slab_name: '',
    storage_rate_per_day_per_cbm: 0,
    storage_amount_inr: 0,
    storage_billable_to_agent: false,
  });

  const [financialSummary, setFinancialSummary] = useState({
    base_revenue_foreign: 0,
    revenue_currency: 'USD',
    exchange_rate: 83.5,
    base_revenue_inr: 0,
    extra_charges_inr: 0,
    total_revenue_inr: 0,
    container_cost: 0,
    trucking_cost: 0,
    storage_cost: 0,
    local_costs: 0,
    total_costs: 0,
    estimated_profit: 0,
    profit_percentage: 0,
    target_margin: 20.0,
    margin_status: 'unknown',
  });

  const [controlState, setControlState] = useState({
    approval_status: 'draft',
    revenue_locked: false,
    agent_invoice_generated: false,
    agent_invoice_number: '',
    documents: [] as any[],
  });

  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  type Alert = {
    type: 'warning' | 'error' | 'info';
    message: string;
    icon: any;
  };

  const [systemAlerts, setSystemAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    loadData();
    generateShipmentNumber();
  }, []);

  useEffect(() => {
    if (formData.agent_id && formData.eta) {
      loadRateSheetsForAgent();
    }
  }, [formData.agent_id, formData.eta]);

  useEffect(() => {
    if (formData.delivery_city) {
      autoDetectZoneType();
    }
  }, [formData.delivery_city]);

  useEffect(() => {
    checkSystemAlerts();
  }, [
    financialSummary,
    controlState.revenue_locked,
    truckingDetails,
    storageDetails,
    formData.exchange_rate_locked,
  ]);

  useEffect(() => {
    if (formData.rate_sheet_id && formData.summary_total_cbm > 0) {
      autoFetchRevenueItems();
    }
  }, [formData.rate_sheet_id, formData.summary_total_cbm, formData.summary_total_weight_kg]);

  useEffect(() => {
    if (formData.container_id && cargoItems.length > 0) {
      updateContainerAllocation();
    }
  }, [formData.container_id, cargoItems]);

  useEffect(() => {
    loadStorageRateSheets();
  }, []);

  useEffect(() => {
    if (formData.ata && storageData.storage_rate_sheet_id) {
      calculateStorage();
    }
  }, [formData.ata, storageData.storage_rate_sheet_id, storageData.storage_delivery_date, storageData.storage_free_days]);

  useEffect(() => {
    calculateFinancialSummary();
  }, [
    financialSummary.base_revenue_foreign,
    financialSummary.exchange_rate,
    financialSummary.extra_charges_inr,
    containerAllocation.allocated_container_cost_inr,
    truckingData.trucking_cost_actual,
    storageData.storage_amount_inr,
    financialSummary.local_costs,
    financialSummary.target_margin,
  ]);

  const autoFetchRevenueItems = async () => {
    if (!formData.rate_sheet_id) return;

    try {
      const slabRates = await fetchSlabBasedRates(
        formData.rate_sheet_id,
        formData.summary_total_cbm,
        formData.summary_total_weight_kg
      );

      const lineItems = generateRevenueLineItems(
        slabRates,
        formData.summary_total_cbm,
        formData.summary_total_weight_kg
      );

      setRevenueItems(lineItems);
      if (lineItems.length > 0) {
        setRevenueCurrency(lineItems[0].currency);
        setShowRevenueDetails(true);
      }
    } catch (error) {
      console.error('Error fetching revenue items:', error);
    }
  };

  const autoDetectZoneType = () => {
    const city = indianCities.find(c => c.city_name === formData.delivery_city);
    if (city) {
      const isMetro = city.zone_type === 'Metro';
      setFormData(prev => ({
        ...prev,
        delivery_zone_type: city.zone_type,
        delivery_included: isMetro,
        requires_trucking: !isMetro,
        trucking_to_location: !isMetro ? formData.delivery_city : ''
      }));
    }
  };

  const loadData = async () => {
    const [containersRes, agentsRes, customersRes, zonesRes, countriesRes, citiesRes, vendorsRes] = await Promise.all([
      supabase.from('groupage_containers').select('*').order('container_number'),
      supabase.from('agents').select('*').order('agent_name'),
      supabase.from('customers').select('*').order('customer_name'),
      supabase.from('delivery_zones').select('*').order('zone_name'),
      supabase.from('origin_countries').select('*').eq('is_active', true).order('display_order'),
      supabase.from('indian_cities').select('*').eq('is_active', true).order('city_name'),
      supabase.from('trucking_vendors').select('*').eq('is_active', true).order('vendor_name'),
    ]);

    if (containersRes.data) setContainers(containersRes.data);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    if (zonesRes.data) setDeliveryZones(zonesRes.data);
    if (countriesRes.data) setOriginCountries(countriesRes.data);
    if (citiesRes.data) setIndianCities(citiesRes.data);
    if (vendorsRes.data) setTruckingVendors(vendorsRes.data);
  };

  const generateShipmentNumber = async () => {
    const { data } = await supabase.rpc('generate_import_shipment_number');
    if (data) {
      setShipmentNumber(data);
    }
  };

  const loadRateSheetsForAgent = async () => {
    const etaDate = new Date(formData.eta);
    const { data } = await supabase
      .from('rate_sheets')
      .select('*')
      .eq('agent_id', formData.agent_id)
      .lte('valid_from', formData.eta)
      .gte('valid_to', formData.eta)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setRateSheets(data);
      setFormData(prev => ({ ...prev, rate_sheet_id: data[0].id }));
    } else {
      setRateSheets([]);
      setFormData(prev => ({ ...prev, rate_sheet_id: '' }));
    }
  };

  const addCargoItem = () => {
    if (!newCargo.customer_id || !newCargo.cargo_description || newCargo.number_of_packages === 0) {
      alert('Please fill in customer, description, and packages');
      return;
    }

    setCargoItems([...cargoItems, { ...newCargo }]);
    setNewCargo({
      customer_id: '',
      cargo_description: '',
      commodity_type: '',
      hs_code: '',
      number_of_packages: 0,
      package_type: 'Carton',
      gross_weight_kg: 0,
      net_weight_kg: 0,
      volume_cbm: 0,
      chargeable_weight: 0,
      marks_and_numbers: '',
      delivery_address: '',
      delivery_zone_id: '',
      delivery_instructions: '',
      cargo_value_usd: 0,
      insurance_required: false,
      insurance_value: 0,
      special_handling: '',
    });
    setShowAddCargo(false);
  };

  const removeCargoItem = (index: number) => {
    setCargoItems(cargoItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    return {
      totalPackages: cargoItems.reduce((sum, item) => sum + item.number_of_packages, 0),
      totalWeight: cargoItems.reduce((sum, item) => sum + item.gross_weight_kg, 0),
      totalVolume: cargoItems.reduce((sum, item) => sum + item.volume_cbm, 0),
    };
  };

  const calculateTruckingTotals = () => {
    const totalCost = truckingData.base_truck_cost_inr + truckingData.toll_estimate + truckingData.escort_special_handling;
    const marginAmount = (totalCost * truckingData.margin_percentage) / 100;
    let finalCharge = totalCost + marginAmount;

    if (truckingData.charge_currency === 'USD' && exchangeRate > 0) {
      finalCharge = finalCharge / exchangeRate;
    }

    return {
      totalCost,
      marginAmount,
      finalCharge,
    };
  };

  const isNonMetroDelivery = () => {
    const city = indianCities.find(c => c.city_name === formData.delivery_city);
    return city && city.zone_type === 'Non-Metro';
  };

  const updateContainerAllocation = async () => {
    if (!formData.container_id) return;

    const container = containers.find(c => c.id === formData.container_id);
    if (!container) return;

    const totals = calculateTotals();
    const shipmentCBM = totals.totalVolume;
    const containerCBM = container.total_capacity_cbm || 60;
    const allocationPct = containerCBM > 0 ? (shipmentCBM / containerCBM) * 100 : 0;
    const containerCost = container.total_container_cost_inr || 0;
    const allocatedCost = containerCost * (allocationPct / 100);

    setContainerAllocation({
      container_total_cbm: containerCBM,
      shipment_total_cbm: shipmentCBM,
      allocation_percentage: allocationPct,
      container_total_cost_inr: containerCost,
      allocated_container_cost_inr: allocatedCost,
      is_allocation_overridden: false,
    });
  };

  const loadStorageRateSheets = async () => {
    const { data, error } = await supabase
      .from('storage_rate_sheets')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setStorageRateSheets(data);
    }
  };

  const calculateStorage = async () => {
    if (!formData.ata || !storageData.storage_rate_sheet_id) return;

    const ataDate = new Date(formData.ata);
    const storageStartDate = new Date(ataDate);
    storageStartDate.setDate(storageStartDate.getDate() + 1);

    const endDate = storageData.storage_delivery_date
      ? new Date(storageData.storage_delivery_date)
      : new Date();

    const totalDays = Math.max(0, Math.floor((endDate.getTime() - storageStartDate.getTime()) / (1000 * 60 * 60 * 24)));

    const { data: rateSheetData } = await supabase
      .from('storage_rate_sheets')
      .select('free_days')
      .eq('id', storageData.storage_rate_sheet_id)
      .single();

    const freeDays = storageData.storage_free_days || rateSheetData?.free_days || 0;
    const chargeableDays = Math.max(0, totalDays - freeDays);

    const { data: slabData } = await supabase
      .from('storage_rate_slabs')
      .select('*')
      .eq('storage_rate_sheet_id', storageData.storage_rate_sheet_id)
      .lte('from_days', totalDays)
      .order('from_days', { ascending: false })
      .limit(1);

    if (slabData && slabData.length > 0) {
      const slab = slabData[0];
      const ratePerDay = slab.rate_per_unit_per_day || 0;
      const totals = calculateTotals();
      const storageAmount = chargeableDays * ratePerDay * totals.totalVolume;

      setStorageData({
        ...storageData,
        storage_start_date: storageStartDate.toISOString().split('T')[0],
        storage_total_days: totalDays,
        storage_chargeable_days: chargeableDays,
        storage_rate_slab_name: `${slab.from_days}-${slab.to_days || '+'} days`,
        storage_rate_per_day_per_cbm: ratePerDay,
        storage_amount_inr: storageAmount,
        storage_free_days: freeDays,
      });

      await supabase
        .from('storage_rate_slabs')
        .select('*')
        .eq('storage_rate_sheet_id', storageData.storage_rate_sheet_id)
        .order('from_days')
        .then(({ data }) => {
          if (data) setStorageSlabs(data);
        });
    }
  };

  const calculateFinancialSummary = () => {
    const baseRevenueInr = financialSummary.base_revenue_foreign * financialSummary.exchange_rate;
    const totalRevenue = baseRevenueInr + financialSummary.extra_charges_inr;

    const containerCost = containerAllocation.allocated_container_cost_inr || 0;
    const truckingCost = truckingData.trucking_cost_actual || 0;
    const storageCost = storageData.storage_amount_inr || 0;
    const localCosts = financialSummary.local_costs || 0;

    const totalCosts = containerCost + truckingCost + storageCost + localCosts;
    const profit = totalRevenue - totalCosts;
    const profitPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    let marginStatus = 'unknown';
    const targetMargin = financialSummary.target_margin;

    if (profitPct >= targetMargin) {
      marginStatus = 'above_target';
    } else if (profitPct >= targetMargin * 0.75) {
      marginStatus = 'low_margin';
    } else if (profit < 0) {
      marginStatus = 'loss';
    } else {
      marginStatus = 'below_minimum';
    }

    setFinancialSummary({
      ...financialSummary,
      base_revenue_inr: baseRevenueInr,
      total_revenue_inr: totalRevenue,
      container_cost: containerCost,
      trucking_cost: truckingCost,
      storage_cost: storageCost,
      total_costs: totalCosts,
      estimated_profit: profit,
      profit_percentage: profitPct,
      margin_status: marginStatus,
    });
  };

  const checkSystemAlerts = () => {
    const alerts: Alert[] = [];

    // Alert 1: Exchange rate not locked
    if (!formData.exchange_rate_locked && !controlState.revenue_locked) {
      alerts.push({
        type: 'warning',
        message: 'Exchange rate not locked - Revenue may fluctuate',
        icon: Unlock,
      });
    }

    // Alert 2: Margin below 20%
    if (financialSummary.profit_percentage < 20 && financialSummary.total_revenue_inr > 0) {
      alerts.push({
        type: 'error',
        message: `Margin below 20% (Current: ${financialSummary.profit_percentage.toFixed(2)}%) - Review pricing`,
        icon: TrendingDown,
      });
    }

    // Alert 3: Trucking cost added but not billable
    if (truckingDetails.total_cost_inr > 0 && !truckingDetails.billable_to_client) {
      alerts.push({
        type: 'warning',
        message: 'Trucking cost added but not billable to client - Cost not recovered',
        icon: Truck,
      });
    }

    // Alert 4: Storage not billed
    if (storageDetails.total_storage_days > 0 && !storageDetails.billable_to_client) {
      alerts.push({
        type: 'warning',
        message: `Storage for ${storageDetails.total_storage_days} days not billed - Cost not recovered`,
        icon: Package,
      });
    }

    // Alert 5: Additional check - No revenue items
    if (revenueLineItems.length === 0 && cargoItems.length > 0) {
      alerts.push({
        type: 'error',
        message: 'No revenue items configured - Shipment will have zero revenue',
        icon: DollarSign,
      });
    }

    // Alert 6: Additional check - Loss situation
    if (financialSummary.margin_status === 'loss') {
      alerts.push({
        type: 'error',
        message: `LOSS SITUATION: Costs exceed revenue by ₹${Math.abs(financialSummary.estimated_profit).toFixed(2)}`,
        icon: AlertTriangle,
      });
    }

    setSystemAlerts(alerts);
    setShowAlerts(alerts.length > 0);
  };

  const handleLockRevenue = async () => {
    if (controlState.revenue_locked) {
      alert('Revenue is already locked');
      return;
    }

    if (!confirm('Lock revenue? This will lock the exchange rate and prevent changes.')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('lock_shipment_revenue', {
        shipment_id: formData.id,
        user_id: user?.id,
      });

      if (error) throw error;

      if (data.error) {
        alert(data.error);
        return;
      }

      setControlState({ ...controlState, revenue_locked: true });
      alert(`Revenue locked at rate: ${data.locked_rate}`);
    } catch (error: any) {
      console.error('Error locking revenue:', error);
      alert('Failed to lock revenue: ' + error.message);
    }
  };

  const handleApproveShipment = async () => {
    if (!controlState.revenue_locked) {
      alert('Please lock revenue before approving shipment');
      return;
    }

    if (controlState.approval_status === 'approved') {
      alert('Shipment is already approved');
      return;
    }

    if (!confirm('Approve shipment? This will move it to execution phase.')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('approve_shipment', {
        shipment_id: formData.id,
        user_id: user?.id,
      });

      if (error) throw error;

      if (data.error) {
        alert(data.error);
        return;
      }

      setControlState({ ...controlState, approval_status: 'approved' });
      alert('Shipment approved successfully');
    } catch (error: any) {
      console.error('Error approving shipment:', error);
      alert('Failed to approve shipment: ' + error.message);
    }
  };

  const handleGenerateAgentInvoice = async () => {
    if (controlState.approval_status !== 'approved') {
      alert('Shipment must be approved before generating agent invoice');
      return;
    }

    if (controlState.agent_invoice_generated) {
      alert(`Agent invoice already generated: ${controlState.agent_invoice_number}`);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('generate_agent_invoice', {
        shipment_id: formData.id,
        user_id: user?.id,
      });

      if (error) throw error;

      if (data.error) {
        alert(data.error);
        return;
      }

      setControlState({
        ...controlState,
        agent_invoice_generated: true,
        agent_invoice_number: data.invoice_number,
      });

      alert(`Agent invoice generated: ${data.invoice_number}\nAgent: ${data.agent_name}`);
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      alert('Failed to generate invoice: ' + error.message);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.shipment_number}_${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `shipment-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('shipment_documents')
        .insert([{
          shipment_id: formData.id,
          document_type: documentType,
          document_name: file.name,
          document_url: urlData.publicUrl,
          file_size_bytes: file.size,
          mime_type: file.type,
          uploaded_by: user?.id,
        }]);

      if (dbError) throw dbError;

      if (documentType === 'BL') {
        await supabase
          .from('import_shipments')
          .update({ bl_document_url: urlData.publicUrl })
          .eq('id', formData.id);
      } else if (documentType === 'Invoice') {
        await supabase
          .from('import_shipments')
          .update({ invoice_document_url: urlData.publicUrl })
          .eq('id', formData.id);
      }

      alert(`${documentType} uploaded successfully`);
      loadDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document: ' + error.message);
    } finally {
      setUploadingDocument(false);
    }
  };

  const loadDocuments = async () => {
    if (!formData.id) return;

    const { data, error } = await supabase
      .from('shipment_documents')
      .select('*')
      .eq('shipment_id', formData.id)
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setControlState({ ...controlState, documents: data });
    }
  };

  const printCostSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cost Sheet - ${formData.shipment_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
            h2 { color: #2563eb; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
            th { background-color: #2563eb; color: white; }
            .total { font-weight: bold; background-color: #f0f0f0; }
            .profit { font-size: 18px; font-weight: bold; color: #059669; }
            .section { margin: 20px 0; page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <h1>Import Shipment Cost Sheet</h1>
          <div class="section">
            <h2>Shipment Information</h2>
            <table>
              <tr><th>Shipment Number</th><td>${formData.shipment_number}</td></tr>
              <tr><th>Client</th><td>${customers.find(c => c.id === formData.client_id)?.name || 'N/A'}</td></tr>
              <tr><th>Agent</th><td>${agents.find(a => a.id === formData.agent_id)?.name || 'N/A'}</td></tr>
              <tr><th>Type</th><td>${formData.shipment_type}</td></tr>
              <tr><th>ETA</th><td>${formData.eta}</td></tr>
              <tr><th>ATA</th><td>${formData.ata || 'Pending'}</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Revenue Breakdown</h2>
            <table>
              <tr><th>Description</th><th>Amount</th></tr>
              <tr><td>Base Revenue (${financialSummary.revenue_currency})</td><td>${financialSummary.base_revenue_foreign.toFixed(2)}</td></tr>
              <tr><td>Exchange Rate</td><td>${financialSummary.exchange_rate.toFixed(2)}</td></tr>
              <tr><td>Base Revenue (INR)</td><td>₹${financialSummary.base_revenue_inr.toFixed(2)}</td></tr>
              <tr><td>Extra Charges</td><td>₹${financialSummary.extra_charges_inr.toFixed(2)}</td></tr>
              <tr class="total"><td>Total Revenue</td><td>₹${financialSummary.total_revenue_inr.toFixed(2)}</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Cost Breakdown</h2>
            <table>
              <tr><th>Description</th><th>Amount</th></tr>
              <tr><td>Container Cost</td><td>₹${financialSummary.container_cost.toFixed(2)}</td></tr>
              <tr><td>Trucking Cost</td><td>₹${financialSummary.trucking_cost.toFixed(2)}</td></tr>
              <tr><td>Storage Cost</td><td>₹${financialSummary.storage_cost.toFixed(2)}</td></tr>
              <tr><td>Local Costs</td><td>₹${financialSummary.local_costs.toFixed(2)}</td></tr>
              <tr class="total"><td>Total Costs</td><td>₹${financialSummary.total_costs.toFixed(2)}</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Profit Summary</h2>
            <table>
              <tr><td>Total Revenue</td><td>₹${financialSummary.total_revenue_inr.toFixed(2)}</td></tr>
              <tr><td>Total Costs</td><td>₹${financialSummary.total_costs.toFixed(2)}</td></tr>
              <tr class="profit"><td>Estimated Profit</td><td>₹${financialSummary.estimated_profit.toFixed(2)}</td></tr>
              <tr><td>Profit Percentage</td><td>${financialSummary.profit_percentage.toFixed(2)}%</td></tr>
              <tr><td>Target Margin</td><td>${financialSummary.target_margin.toFixed(2)}%</td></tr>
              <tr><td>Status</td><td>${financialSummary.margin_status.toUpperCase()}</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Cargo Items (${cargoItems.length})</h2>
            <table>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Weight (kg)</th>
                <th>Volume (CBM)</th>
              </tr>
              ${cargoItems.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>${item.weight_kg}</td>
                  <td>${item.volume_cbm}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td>TOTAL</td>
                <td>${totals.totalQuantity}</td>
                <td>${totals.totalWeight}</td>
                <td>${totals.totalVolume}</td>
              </tr>
            </table>
          </div>

          <p style="margin-top: 40px; text-align: center; color: #666;">
            Generated on ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const viewContainerProfit = () => {
    if (!containerAllocation.container_id) {
      alert('No container linked to view profit details');
      return;
    }

    alert(`Container Profit View\n\nContainer: ${containers.find(c => c.id === containerAllocation.container_id)?.container_number}\n\nTotal Cost: ₹${containerAllocation.container_total_cost_inr?.toFixed(2) || '0.00'}\nAllocated Cost: ₹${containerAllocation.allocated_container_cost_inr?.toFixed(2) || '0.00'}\nAllocation %: ${containerAllocation.cbm_percentage?.toFixed(2) || '0'}%\n\nThis feature will show detailed container-level profit analysis.`);
  };

  const saveShipmentWithCalculations = async () => {
    if (!formData.agent_id || !formData.shipment_type || !formData.eta) {
      alert('Please fill in Agent, Shipment Type, and ETA');
      return;
    }

    if (cargoItems.length === 0) {
      alert('Please add at least one cargo item');
      return;
    }

    if (!formData.rate_sheet_id) {
      alert('Please select a rate sheet for pricing calculation');
      return;
    }

    setSaving(true);

    try {
      const totals = calculateTotals();

      const calculationInput = {
        rateSheetId: formData.rate_sheet_id,
        volumeCbm: totals.totalVolume,
        originPort: formData.port_of_loading,
        destinationPort: formData.port_of_discharge,
        containerType: formData.shipment_type,
        currency: revenueCurrency,
        cargoValue: cargoItems.reduce((sum, item) => sum + (item.cargo_value_usd || 0), 0),
        isGroupage: formData.shipment_type === 'LCL',
        groupageContainerId: formData.container_id || undefined,
        truckingDistance: formData.trucking_distance_km || 0,
        hasTrucking: formData.requires_trucking,
        storageDays: storageData.storage_total_days || 0,
        shipmentLevelCosts: [],
      };

      console.log('Starting calculation with input:', calculationInput);

      const calculationResult = await calculateImportShipment(calculationInput);

      console.log('Calculation completed:', calculationResult);

      const shipmentData = {
        shipment_number: shipmentNumber,
        container_id: formData.container_id || null,
        agent_id: formData.agent_id,
        rate_sheet_id: formData.rate_sheet_id,
        shipment_type: formData.shipment_type,
        port_of_loading: formData.port_of_loading,
        port_of_discharge: formData.port_of_discharge,
        eta: formData.eta,
        pre_alert_received: formData.pre_alert_received,
        pre_alert_date: formData.pre_alert_date || null,
        shipper_name: formData.shipper_name,
        shipper_address: formData.shipper_address,
        consignee_name: formData.consignee_name,
        consignee_address: formData.consignee_address,
        bl_number: formData.bl_number,
        bl_date: formData.bl_date || null,
        vessel_name: formData.vessel_name,
        voyage_number: formData.voyage_number,
        total_packages: totals.totalPackages,
        total_gross_weight_kg: totals.totalWeight,
        total_volume_cbm: totals.totalVolume,
        internal_notes: formData.internal_notes,
        customer_notes: formData.customer_notes,
        client_name: formData.client_name,
        origin_country: formData.origin_country,
        delivery_address_full: formData.delivery_address_full,
        delivery_city: formData.delivery_city,
        delivery_zone_type: formData.delivery_zone_type,
        contact_person: formData.contact_person,
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email,
        delivery_included: formData.delivery_included,
        requires_trucking: formData.requires_trucking,
        trucking_distance_km: formData.trucking_distance_km || null,
        trucking_billable: formData.trucking_billable,
        groupage_container_id: formData.container_id || null,
        volume_cbm: totals.totalVolume,
        created_by: user?.id,
        updated_by: user?.id,
      };

      const shipmentId = await saveCalculatedShipment(shipmentData, calculationResult);

      const cargoInserts = cargoItems.map(item => ({
        import_shipment_id: shipmentId,
        ...item,
      }));

      const { error: cargoError } = await supabase
        .from('import_shipment_cargo')
        .insert(cargoInserts);

      if (cargoError) throw cargoError;

      alert(`✅ Shipment saved successfully!

Calculation Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue: ${calculationResult.revenueCurrency} ${calculationResult.revenueAmount.toFixed(2)}
Exchange Rate: ${calculationResult.exchangeRate.toFixed(2)}
Revenue (INR): ₹${calculationResult.revenueInr.toFixed(2)}

Costs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Container Cost: ₹${calculationResult.containerCostInr.toFixed(2)}
Trucking Cost: ₹${calculationResult.truckingCostInr.toFixed(2)}
Storage Cost: ₹${calculationResult.storageCostInr.toFixed(2)}
Other Costs: ₹${calculationResult.shipmentCostsInr.toFixed(2)}
Total Cost: ₹${calculationResult.totalCostInr.toFixed(2)}

Profit:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Profit: ₹${calculationResult.profitInr.toFixed(2)}
Margin: ${calculationResult.profitMarginPercent.toFixed(2)}%

Shipment Number: ${shipmentNumber}`);

      setFormData({
        container_id: '',
        agent_id: '',
        rate_sheet_id: '',
        shipment_type: 'LCL',
        port_of_loading: '',
        port_of_discharge: 'Nhava Sheva',
        eta: '',
        pre_alert_received: false,
        pre_alert_date: '',
        shipper_name: '',
        shipper_address: '',
        consignee_name: '',
        consignee_address: '',
        bl_number: '',
        bl_date: '',
        vessel_name: '',
        voyage_number: '',
        internal_notes: '',
        customer_notes: '',
        client_name: '',
        origin_country: '',
        delivery_address_full: '',
        delivery_city: '',
        delivery_zone_type: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        summary_total_cbm: 0,
        summary_total_weight_kg: 0,
        summary_total_packages: 0,
        delivery_included: false,
        requires_trucking: false,
        trucking_distance_km: 0,
        trucking_vendor: '',
        trucking_cost_revenue: 0,
        trucking_cost_actual: 0,
        trucking_vehicle_type: '',
        trucking_from_location: 'Nhava Sheva Port',
        trucking_to_location: '',
        trucking_notes: '',
        trucking_billable: true,
      });
      setCargoItems([]);
      await generateShipmentNumber();

    } catch (error) {
      console.error('Error saving shipment:', error);
      alert(`Failed to save shipment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const saveShipment = async () => {
    if (!formData.agent_id || !formData.shipment_type || !formData.eta) {
      alert('Please fill in Agent, Shipment Type, and ETA');
      return;
    }

    if (cargoItems.length === 0) {
      alert('Please add at least one cargo item');
      return;
    }

    // Check for critical alerts before saving
    checkSystemAlerts();

    if (systemAlerts.length > 0) {
      const hasErrors = systemAlerts.some(alert => alert.type === 'error');
      const hasWarnings = systemAlerts.some(alert => alert.type === 'warning');

      let confirmMessage = 'System Alerts Detected:\n\n';
      systemAlerts.forEach((alert, index) => {
        confirmMessage += `${index + 1}. ${alert.message}\n`;
      });
      confirmMessage += '\n';

      if (hasErrors) {
        confirmMessage += 'ERRORS found - These should be resolved before saving.\n\n';
      }
      if (hasWarnings) {
        confirmMessage += 'WARNINGS found - Review carefully.\n\n';
      }

      confirmMessage += 'Do you want to proceed with saving anyway?';

      if (!confirm(confirmMessage)) {
        setShowAlerts(true);
        return;
      }
    }

    setSaving(true);

    try {
      const totals = calculateTotals();

      const { data: shipmentData, error: shipmentError } = await supabase
        .from('import_shipments')
        .insert([{
          shipment_number: shipmentNumber,
          container_id: formData.container_id || null,
          agent_id: formData.agent_id,
          rate_sheet_id: formData.rate_sheet_id || null,
          shipment_type: formData.shipment_type,
          port_of_loading: formData.port_of_loading,
          port_of_discharge: formData.port_of_discharge,
          eta: formData.eta,
          pre_alert_received: formData.pre_alert_received,
          pre_alert_date: formData.pre_alert_date || null,
          shipper_name: formData.shipper_name,
          shipper_address: formData.shipper_address,
          consignee_name: formData.consignee_name,
          consignee_address: formData.consignee_address,
          bl_number: formData.bl_number,
          bl_date: formData.bl_date || null,
          vessel_name: formData.vessel_name,
          voyage_number: formData.voyage_number,
          total_packages: totals.totalPackages,
          total_gross_weight_kg: totals.totalWeight,
          total_volume_cbm: totals.totalVolume,
          internal_notes: formData.internal_notes,
          customer_notes: formData.customer_notes,
          client_name: formData.client_name,
          origin_country: formData.origin_country,
          delivery_address_full: formData.delivery_address_full,
          delivery_city: formData.delivery_city,
          delivery_zone_type: formData.delivery_zone_type,
          contact_person: formData.contact_person,
          contact_phone: formData.contact_phone,
          contact_email: formData.contact_email,
          summary_total_cbm: formData.summary_total_cbm,
          summary_total_weight_kg: formData.summary_total_weight_kg,
          summary_total_packages: formData.summary_total_packages,
          delivery_included: formData.delivery_included,
          requires_trucking: formData.requires_trucking,
          trucking_distance_km: formData.trucking_distance_km || null,
          trucking_vendor: formData.trucking_vendor || null,
          trucking_cost_revenue: formData.trucking_cost_revenue || null,
          trucking_cost_actual: formData.trucking_cost_actual || null,
          trucking_vehicle_type: formData.trucking_vehicle_type || null,
          trucking_from_location: formData.trucking_from_location || null,
          trucking_to_location: formData.trucking_to_location || null,
          trucking_notes: formData.trucking_notes || null,
          trucking_billable: formData.trucking_billable,
          container_total_cbm: containerAllocation.container_total_cbm,
          shipment_total_cbm: containerAllocation.shipment_total_cbm,
          allocation_percentage: containerAllocation.allocation_percentage,
          container_total_cost_inr: containerAllocation.container_total_cost_inr,
          allocated_container_cost_inr: containerAllocation.allocated_container_cost_inr,
          is_allocation_overridden: containerAllocation.is_allocation_overridden,
          container_cost_override: containerAllocation.is_allocation_overridden ? containerAllocation.allocated_container_cost_inr : null,
          allocation_override_reason: containerAllocation.is_allocation_overridden ? overrideReason : null,
          storage_rate_sheet_id: storageData.storage_rate_sheet_id || null,
          storage_free_days: storageData.storage_free_days,
          storage_start_date: storageData.storage_start_date || null,
          storage_delivery_date: storageData.storage_delivery_date || null,
          storage_total_days: storageData.storage_total_days,
          storage_chargeable_days: storageData.storage_chargeable_days,
          storage_rate_per_day_per_cbm: storageData.storage_rate_per_day_per_cbm,
          storage_amount_inr: storageData.storage_amount_inr,
          storage_billable_to_agent: storageData.storage_billable_to_agent,
          total_revenue_foreign: financialSummary.base_revenue_foreign,
          revenue_currency: financialSummary.revenue_currency,
          exchange_rate: financialSummary.exchange_rate,
          extra_charges_inr: financialSummary.extra_charges_inr,
          total_revenue_inr: financialSummary.total_revenue_inr,
          local_costs_inr: financialSummary.local_costs,
          total_costs_calculated: financialSummary.total_costs,
          storage_cost_inr: financialSummary.storage_cost,
          estimated_profit: financialSummary.estimated_profit,
          profit_pct: financialSummary.profit_percentage,
          target_margin_percentage: financialSummary.target_margin,
          margin_status: financialSummary.margin_status,
          status: 'draft',
          created_by: user?.id,
          updated_by: user?.id,
        }])
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      const cargoInserts = cargoItems.map(item => ({
        import_shipment_id: shipmentData.id,
        ...item,
      }));

      const { error: cargoError } = await supabase
        .from('import_shipment_cargo')
        .insert(cargoInserts);

      if (cargoError) throw cargoError;

      if (revenueItems.length > 0) {
        const { data: exchangeRateData, error: exchangeError } = await supabase
          .from('import_shipment_exchange_rates')
          .insert([{
            import_shipment_id: shipmentData.id,
            revenue_currency: revenueCurrency,
            exchange_rate: exchangeRate,
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: user?.id,
            created_by: user?.id,
            updated_by: user?.id,
          }])
          .select()
          .single();

        if (exchangeError) throw exchangeError;

        const revenueInserts = revenueItems.map(item => ({
          import_shipment_id: shipmentData.id,
          service_name: item.service_name,
          service_type: item.service_type,
          unit_type: item.unit_type,
          quantity: item.quantity,
          rate: item.rate,
          currency: item.currency,
          amount: item.amount,
          auto_calculated: item.auto_calculated,
          is_billable: true,
          created_by: user?.id,
          updated_by: user?.id,
        }));

        const { error: revenueError } = await supabase
          .from('import_shipment_revenue_items')
          .insert(revenueInserts);

        if (revenueError) throw revenueError;

        if (showAdditionalTrucking && isNonMetroDelivery()) {
          const truckingTotals = calculateTruckingTotals();

          const { error: truckingError } = await supabase
            .from('import_shipment_trucking_costs')
            .insert([{
              import_shipment_id: shipmentData.id,
              truck_type: truckingData.truck_type,
              vendor_id: truckingData.vendor_id || null,
              vendor_name: truckingData.vendor_name,
              base_truck_cost_inr: truckingData.base_truck_cost_inr,
              toll_estimate: truckingData.toll_estimate,
              escort_special_handling: truckingData.escort_special_handling,
              total_trucking_cost: truckingTotals.totalCost,
              margin_percentage: truckingData.margin_percentage,
              margin_amount: truckingTotals.marginAmount,
              is_billable: truckingData.is_billable,
              charge_currency: truckingData.charge_currency,
              exchange_rate_used: truckingData.charge_currency === 'USD' ? exchangeRate : null,
              final_charge_to_agent: truckingTotals.finalCharge,
              final_charge_currency: truckingData.charge_currency,
              route_details: truckingData.route_details,
              distance_km: truckingData.distance_km,
              delivery_zone: 'Non-Metro',
              notes: truckingData.notes,
              created_by: user?.id,
              updated_by: user?.id,
            }]);

          if (truckingError) throw truckingError;

          if (truckingData.is_billable) {
            const { error: truckingRevenueError } = await supabase
              .from('import_shipment_revenue_items')
              .insert([{
                import_shipment_id: shipmentData.id,
                service_name: 'Additional Trucking (Non-Metro)',
                service_type: 'Trucking',
                unit_type: 'Fixed',
                quantity: 1,
                rate: truckingTotals.finalCharge,
                currency: truckingData.charge_currency,
                amount: truckingTotals.finalCharge,
                auto_calculated: false,
                is_billable: true,
                created_by: user?.id,
                updated_by: user?.id,
              }]);

            if (truckingRevenueError) throw truckingRevenueError;
          }
        }
      }

      alert(`Import Shipment ${shipmentNumber} created successfully!`);

      window.location.reload();
    } catch (error) {
      console.error('Error creating import shipment:', error);
      alert('Failed to create import shipment');
    } finally {
      setSaving(false);
    }
  };

  const totals = calculateTotals();

  const getMarginStatusConfig = () => {
    switch (financialSummary.margin_status) {
      case 'above_target':
        return {
          color: 'green',
          icon: TrendingUp,
          text: 'Above Target',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-400',
          textColor: 'text-green-900',
          iconColor: 'text-green-600',
        };
      case 'low_margin':
        return {
          color: 'yellow',
          icon: Minus,
          text: 'Low Margin',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-900',
          iconColor: 'text-yellow-600',
        };
      case 'below_minimum':
        return {
          color: 'red',
          icon: TrendingDown,
          text: 'Below Minimum',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-400',
          textColor: 'text-red-900',
          iconColor: 'text-red-600',
        };
      case 'loss':
        return {
          color: 'red',
          icon: TrendingDown,
          text: 'Loss',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-600',
          textColor: 'text-red-900',
          iconColor: 'text-red-700',
        };
      default:
        return {
          color: 'gray',
          icon: Minus,
          text: 'Unknown',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-900',
          iconColor: 'text-gray-600',
        };
    }
  };

  const marginConfig = getMarginStatusConfig();
  const MarginIcon = marginConfig.icon;

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Calculator className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-2">Automated Calculation Engine</h3>
              <p className="text-sm text-blue-800 mb-2">
                Click <strong>"Calculate & Save"</strong> to automatically compute all financial metrics:
              </p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li><strong>Exchange Rate Lock:</strong> Current rates frozen at save time</li>
                <li><strong>Slab-Based Revenue:</strong> Automatic rate sheet lookup and tiered pricing</li>
                <li><strong>Currency Conversion:</strong> All amounts converted to INR</li>
                <li><strong>Container Cost Allocation:</strong> Proportional cost distribution for groupage</li>
                <li><strong>Trucking Calculation:</strong> Distance-based cost and revenue computation</li>
                <li><strong>Storage Billing:</strong> Automatic free days and chargeable period calculation</li>
                <li><strong>Profit Analysis:</strong> Real-time margin and profitability tracking</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900">Create Inbound Shipment</h2>
          <div className="flex gap-3 items-center">
            <button
              onClick={saveShipmentWithCalculations}
              disabled={saving || cargoItems.length === 0}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-semibold shadow-lg border-2 border-blue-700"
            >
              <Calculator className="w-6 h-6" />
              {saving ? 'Calculating...' : 'Calculate & Save'}
            </button>
            <div className="relative">
              <button
                onClick={saveShipment}
                disabled={saving || cargoItems.length === 0}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-semibold"
              >
                <Save className="w-6 h-6" />
                {saving ? 'Saving...' : 'Save (Manual)'}
              </button>
              {systemAlerts.length > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg">
                  {systemAlerts.length}
                </div>
              )}
            </div>
          </div>
      </div>

      {showAlerts && systemAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-xl p-6 border-2 border-yellow-400">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-7 h-7 text-orange-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Smart System Alerts</h3>
              <p className="text-sm text-gray-700">Review these warnings before saving</p>
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {systemAlerts.map((alert, index) => {
              const AlertIcon = alert.icon;
              const bgColor = alert.type === 'error'
                ? 'bg-red-100 border-red-400'
                : alert.type === 'warning'
                ? 'bg-yellow-100 border-yellow-400'
                : 'bg-blue-100 border-blue-400';

              const iconColor = alert.type === 'error'
                ? 'text-red-600'
                : alert.type === 'warning'
                ? 'text-yellow-600'
                : 'text-blue-600';

              const textColor = alert.type === 'error'
                ? 'text-red-900'
                : alert.type === 'warning'
                ? 'text-yellow-900'
                : 'text-blue-900';

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 ${bgColor}`}
                >
                  <AlertIcon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                  <span className={`font-medium ${textColor}`}>{alert.message}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{systemAlerts.length}</span> {systemAlerts.length === 1 ? 'alert' : 'alerts'} detected
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium underline"
            >
              Dismiss for now
            </button>
          </div>
        </div>
      )}

      {!showAlerts && systemAlerts.length > 0 && (
        <button
          onClick={() => setShowAlerts(true)}
          className="w-full bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2 font-semibold shadow-md animate-pulse"
        >
          <AlertTriangle className="w-5 h-5" />
          <span>{systemAlerts.length} System {systemAlerts.length === 1 ? 'Alert' : 'Alerts'} - Click to Review</span>
        </button>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-blue-300">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Shipment Controls
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <button
              onClick={saveShipment}
              disabled={saving || cargoItems.length === 0}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all w-full"
            >
              <Save className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm">Save Draft</div>
                <div className="text-xs opacity-80">Store changes</div>
              </div>
            </button>
            {systemAlerts.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg animate-pulse">
                {systemAlerts.length}
              </div>
            )}
          </div>

          <button
            onClick={handleLockRevenue}
            disabled={controlState.revenue_locked}
            className={`${
              controlState.revenue_locked
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700'
            } text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all`}
          >
            {controlState.revenue_locked ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Unlock className="w-5 h-5" />
            )}
            <div className="text-left">
              <div className="text-sm">
                {controlState.revenue_locked ? 'Revenue Locked' : 'Lock Revenue'}
              </div>
              <div className="text-xs opacity-80">
                {controlState.revenue_locked ? 'Rate locked' : 'Lock exchange rate'}
              </div>
            </div>
          </button>

          <button
            onClick={handleApproveShipment}
            disabled={!controlState.revenue_locked || controlState.approval_status === 'approved'}
            className={`${
              controlState.approval_status === 'approved'
                ? 'bg-green-600'
                : !controlState.revenue_locked
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all`}
          >
            <CheckCircle className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm">
                {controlState.approval_status === 'approved' ? 'Approved' : 'Approve'}
              </div>
              <div className="text-xs opacity-80">
                {controlState.approval_status === 'approved' ? 'Ready' : 'Move to execution'}
              </div>
            </div>
          </button>

          <button
            onClick={handleGenerateAgentInvoice}
            disabled={controlState.approval_status !== 'approved' || controlState.agent_invoice_generated}
            className={`${
              controlState.agent_invoice_generated
                ? 'bg-purple-600'
                : controlState.approval_status !== 'approved'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all`}
          >
            <FileText className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm">
                {controlState.agent_invoice_generated ? 'Invoice Created' : 'Agent Invoice'}
              </div>
              <div className="text-xs opacity-80">
                {controlState.agent_invoice_generated ? controlState.agent_invoice_number : 'Generate invoice'}
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <button
            onClick={() => setShowDocumentUpload(!showDocumentUpload)}
            className="bg-teal-600 text-white px-4 py-3 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 font-semibold transition-all"
          >
            <Upload className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm">Add Documents</div>
              <div className="text-xs opacity-80">{controlState.documents.length} uploaded</div>
            </div>
          </button>

          <button
            onClick={printCostSheet}
            className="bg-gray-700 text-white px-4 py-3 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 font-semibold transition-all"
          >
            <Printer className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm">Print Cost Sheet</div>
              <div className="text-xs opacity-80">PDF export</div>
            </div>
          </button>

          <button
            onClick={viewContainerProfit}
            disabled={!containerAllocation.container_id}
            className="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all"
          >
            <Eye className="w-5 h-5" />
            <div className="text-left">
              <div className="text-sm">Container Profit</div>
              <div className="text-xs opacity-80">View details</div>
            </div>
          </button>
        </div>

        {showDocumentUpload && (
          <div className="mt-4 p-4 bg-white rounded-lg border-2 border-teal-300">
            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-600" />
              Upload Documents
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bill of Lading (BL)
                </label>
                <input
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, 'BL')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  disabled={uploadingDocument}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commercial Invoice
                </label>
                <input
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, 'Invoice')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  disabled={uploadingDocument}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customs Documents
                </label>
                <input
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, 'Customs')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  disabled={uploadingDocument}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Other Documents
                </label>
                <input
                  type="file"
                  onChange={(e) => handleDocumentUpload(e, 'Other')}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  disabled={uploadingDocument}
                />
              </div>
            </div>

            {controlState.documents.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold text-gray-900 mb-2">Uploaded Documents:</h5>
                <div className="space-y-2">
                  {controlState.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">{doc.document_type}</span>
                        <span className="text-xs text-gray-600">- {doc.document_name}</span>
                      </div>
                      <a
                        href={doc.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadingDocument && (
              <div className="mt-3 text-center text-sm text-gray-600">
                Uploading document...
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            controlState.approval_status === 'approved'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              controlState.approval_status === 'approved' ? 'bg-green-600' : 'bg-gray-400'
            }`}></div>
            <span className="font-medium">Status: {controlState.approval_status.toUpperCase()}</span>
          </div>

          {controlState.revenue_locked && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800">
              <Lock className="w-4 h-4" />
              <span className="font-medium">Revenue Locked</span>
            </div>
          )}

          {controlState.agent_invoice_generated && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800">
              <FileText className="w-4 h-4" />
              <span className="font-medium">{controlState.agent_invoice_number}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Ship className="w-6 h-6 text-blue-600" />
          Basic Shipment Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-900 mb-1">Shipment Number</label>
            <p className="text-2xl font-bold text-blue-900">{shipmentNumber}</p>
            <p className="text-xs text-blue-700 mt-1">Auto-generated</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Container Number</label>
            <select
              value={formData.container_id}
              onChange={(e) => setFormData({ ...formData, container_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Container (LCL/Air)</option>
              {containers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.container_number} ({c.container_type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Link to existing container for FCL</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
            <select
              value={formData.agent_id}
              onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Agent</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.agent_name} ({a.agent_code})
                </option>
              ))}
            </select>
          </div>

          {rateSheets.length > 0 && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3">
              <label className="block text-sm font-medium text-green-900 mb-1">Rate Sheet Version</label>
              <select
                value={formData.rate_sheet_id}
                onChange={(e) => setFormData({ ...formData, rate_sheet_id: e.target.value })}
                className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
              >
                {rateSheets.map(rs => (
                  <option key={rs.id} value={rs.id}>
                    {rs.rate_sheet_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-green-700 mt-1">Auto-selected based on agent + ETA date</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipment Type *</label>
            <select
              value={formData.shipment_type}
              onChange={(e) => setFormData({ ...formData, shipment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              {shipmentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port of Discharge *</label>
            <input
              type="text"
              value={formData.port_of_discharge}
              onChange={(e) => setFormData({ ...formData, port_of_discharge: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Default: Nhava Sheva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ETA *</label>
            <input
              type="date"
              value={formData.eta}
              onChange={(e) => setFormData({ ...formData, eta: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <input
              type="checkbox"
              checked={formData.pre_alert_received}
              onChange={(e) => setFormData({ ...formData, pre_alert_received: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900">Pre-alert Received</label>
              <p className="text-xs text-gray-600">Check if pre-alert notification received</p>
            </div>
          </div>

          {formData.pre_alert_received && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-alert Date</label>
              <input
                type="date"
                value={formData.pre_alert_date}
                onChange={(e) => setFormData({ ...formData, pre_alert_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port of Loading</label>
            <input
              type="text"
              value={formData.port_of_loading}
              onChange={(e) => setFormData({ ...formData, port_of_loading: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Shanghai, Singapore"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BL Number</label>
            <input
              type="text"
              value={formData.bl_number}
              onChange={(e) => setFormData({ ...formData, bl_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Bill of Lading Number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BL Date</label>
            <input
              type="date"
              value={formData.bl_date}
              onChange={(e) => setFormData({ ...formData, bl_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vessel Name</label>
            <input
              type="text"
              value={formData.vessel_name}
              onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Vessel name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voyage Number</label>
            <input
              type="text"
              value={formData.voyage_number}
              onChange={(e) => setFormData({ ...formData, voyage_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Voyage number"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipper Name</label>
            <input
              type="text"
              value={formData.shipper_name}
              onChange={(e) => setFormData({ ...formData, shipper_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consignee Name</label>
            <input
              type="text"
              value={formData.consignee_name}
              onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipper Address</label>
            <textarea
              value={formData.shipper_address}
              onChange={(e) => setFormData({ ...formData, shipper_address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consignee Address</label>
            <textarea
              value={formData.consignee_address}
              onChange={(e) => setFormData({ ...formData, consignee_address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-orange-600" />
          Client & Cargo Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Client/Consignee name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin Country</label>
            <select
              value={formData.origin_country}
              onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Country</option>
              {originCountries.map(country => (
                <option key={country.id} value={country.country_name}>
                  {country.country_name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
            <textarea
              value={formData.delivery_address_full}
              onChange={(e) => setFormData({ ...formData, delivery_address_full: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Complete delivery address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery City</label>
            <select
              value={formData.delivery_city}
              onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select City</option>
              {indianCities.map(city => (
                <option key={city.id} value={city.city_name}>
                  {city.city_name}, {city.state_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Zone</label>
            <div className={`w-full px-4 py-3 rounded-lg font-semibold text-lg ${
              formData.delivery_zone_type === 'Metro'
                ? 'bg-green-100 text-green-800 border-2 border-green-400'
                : formData.delivery_zone_type === 'Non-Metro'
                ? 'bg-orange-100 text-orange-800 border-2 border-orange-400'
                : 'bg-gray-100 text-gray-500 border-2 border-gray-300'
            }`}>
              {formData.delivery_zone_type || 'Select City First'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Auto-determined based on city selection</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contact person name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="+91 XXXXX XXXXX"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="contact@example.com"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Shipment Totals Summary
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total CBM *</label>
              <input
                type="number"
                step="0.001"
                value={formData.summary_total_cbm || ''}
                onChange={(e) => setFormData({ ...formData, summary_total_cbm: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                placeholder="0.000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
              <input
                type="number"
                step="0.01"
                value={formData.summary_total_weight_kg || ''}
                onChange={(e) => setFormData({ ...formData, summary_total_weight_kg: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. of Packages *</label>
              <input
                type="number"
                value={formData.summary_total_packages || ''}
                onChange={(e) => setFormData({ ...formData, summary_total_packages: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> These are high-level totals for the entire shipment.
              Individual cargo line items can be added in the section below for detailed tracking per customer.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Ship className="w-5 h-5 text-purple-600" />
                Delivery Status
              </h4>
              <div className={`px-6 py-2 rounded-full font-bold text-lg ${
                formData.delivery_included
                  ? 'bg-green-100 text-green-800 border-2 border-green-400'
                  : 'bg-orange-100 text-orange-800 border-2 border-orange-400'
              }`}>
                {formData.delivery_included ? 'Delivery Included' : 'Trucking Required'}
              </div>
            </div>

            {formData.delivery_zone_type === 'Metro' && (
              <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Ship className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h5 className="font-bold text-green-900 text-lg">Metro Delivery - Included in Base Rate</h5>
                    <p className="text-green-800 mt-1">
                      This shipment is being delivered to a Metro city. Delivery is included in the standard shipping rate.
                      No additional trucking charges required.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.delivery_zone_type === 'Non-Metro' && (
              <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-bold text-orange-900 text-lg">Non-Metro Delivery - Trucking Details Required</h5>
                    <p className="text-orange-800 mt-1 mb-4">
                      This shipment is being delivered to a Non-Metro location. Additional trucking arrangements and costs apply.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {formData.requires_trucking && formData.delivery_zone_type === 'Non-Metro' && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-orange-300">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-600" />
            Trucking Details (Non-Metro Delivery)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Location</label>
              <input
                type="text"
                value={formData.trucking_from_location}
                onChange={(e) => setFormData({ ...formData, trucking_from_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Nhava Sheva Port"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Location</label>
              <input
                type="text"
                value={formData.trucking_to_location}
                onChange={(e) => setFormData({ ...formData, trucking_to_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                placeholder="Delivery city"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (KM)</label>
              <input
                type="number"
                step="0.01"
                value={formData.trucking_distance_km || ''}
                onChange={(e) => setFormData({ ...formData, trucking_distance_km: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                value={formData.trucking_vehicle_type}
                onChange={(e) => setFormData({ ...formData, trucking_vehicle_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Vehicle Type</option>
                <option value="32ft Trailer">32ft Trailer</option>
                <option value="20ft Truck">20ft Truck</option>
                <option value="14ft Truck">14ft Truck</option>
                <option value="10ft Truck">10ft Truck</option>
                <option value="Tempo">Tempo</option>
                <option value="Mini Truck">Mini Truck</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Trucking Vendor</label>
              <input
                type="text"
                value={formData.trucking_vendor}
                onChange={(e) => setFormData({ ...formData, trucking_vendor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Transporter/Vendor name"
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Cost & Revenue Tracking
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revenue (Charged to Customer)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.trucking_cost_revenue || ''}
                  onChange={(e) => setFormData({ ...formData, trucking_cost_revenue: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-lg bg-green-50"
                  placeholder="0.00"
                />
                <p className="text-xs text-green-700 mt-1 font-medium">Amount billed to customer</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cost (Paid to Vendor)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.trucking_cost_actual || ''}
                  onChange={(e) => setFormData({ ...formData, trucking_cost_actual: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold text-lg bg-red-50"
                  placeholder="0.00"
                />
                <p className="text-xs text-red-700 mt-1 font-medium">Amount paid to transporter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profit/Loss</label>
                <div className={`w-full px-4 py-3 rounded-lg font-bold text-2xl text-center ${
                  (formData.trucking_cost_revenue || 0) - (formData.trucking_cost_actual || 0) >= 0
                    ? 'bg-green-100 text-green-800 border-2 border-green-400'
                    : 'bg-red-100 text-red-800 border-2 border-red-400'
                }`}>
                  {((formData.trucking_cost_revenue || 0) - (formData.trucking_cost_actual || 0)).toFixed(2)}
                </div>
                <p className="text-xs text-gray-600 mt-1 text-center font-medium">
                  {(formData.trucking_cost_revenue || 0) - (formData.trucking_cost_actual || 0) >= 0 ? 'Profit' : 'Loss'}
                </p>
              </div>

              <div className="col-span-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.trucking_billable}
                    onChange={(e) => setFormData({ ...formData, trucking_billable: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Trucking cost is billable to customer
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Trucking Notes</label>
            <textarea
              value={formData.trucking_notes}
              onChange={(e) => setFormData({ ...formData, trucking_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Special instructions, route details, contact information, etc."
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-green-600" />
            Cargo Details ({cargoItems.length} items)
          </h3>
          <button
            onClick={() => setShowAddCargo(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Cargo Item
          </button>
        </div>

        {cargoItems.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No cargo items added yet</p>
            <p className="text-gray-500 text-sm mt-2">Click "Add Cargo Item" to start</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-medium">Total Packages</p>
                <p className="text-3xl font-bold text-blue-900">{totals.totalPackages}</p>
              </div>

              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <p className="text-sm text-green-700 font-medium">Total Weight (KG)</p>
                <p className="text-3xl font-bold text-green-900">{totals.totalWeight.toFixed(2)}</p>
              </div>

              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                <p className="text-sm text-purple-700 font-medium">Total Volume (CBM)</p>
                <p className="text-3xl font-bold text-purple-900">{totals.totalVolume.toFixed(3)}</p>
              </div>

              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                <p className="text-sm text-orange-700 font-medium">Cargo Items</p>
                <p className="text-3xl font-bold text-orange-900">{cargoItems.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              {cargoItems.map((item, index) => {
                const customer = customers.find(c => c.id === item.customer_id);
                const zone = deliveryZones.find(z => z.id === item.delivery_zone_id);

                return (
                  <div key={index} className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg">{item.cargo_description}</h4>
                        <p className="text-sm text-blue-600">
                          Customer: {customer?.customer_name || 'Unknown'} | {customer?.company_name || ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removeCargoItem(index)}
                        className="text-red-600 hover:text-red-800 p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Packages:</span>
                        <p className="font-medium">{item.number_of_packages} {item.package_type}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Gross Weight:</span>
                        <p className="font-medium">{item.gross_weight_kg} KG</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Volume:</span>
                        <p className="font-medium">{item.volume_cbm} CBM</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Commodity:</span>
                        <p className="font-medium">{item.commodity_type || 'N/A'}</p>
                      </div>
                      {item.hs_code && (
                        <div>
                          <span className="text-gray-600">HS Code:</span>
                          <p className="font-medium">{item.hs_code}</p>
                        </div>
                      )}
                      {item.delivery_zone_id && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Delivery:</span>
                          <p className="font-medium text-green-700">{zone?.city_name || 'N/A'}</p>
                        </div>
                      )}
                      {item.insurance_required && (
                        <div>
                          <span className="text-gray-600">Insurance:</span>
                          <p className="font-medium text-orange-700">${item.insurance_value}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-purple-600" />
          Notes
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={formData.internal_notes}
              onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Internal notes (not visible to customers)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
            <textarea
              value={formData.customer_notes}
              onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Notes visible to customers"
            />
          </div>
        </div>
      </div>

      {showAddCargo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Cargo Item</h3>
              <button onClick={() => setShowAddCargo(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                  <select
                    value={newCargo.customer_id}
                    onChange={(e) => setNewCargo({ ...newCargo, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name} - {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Description *</label>
                  <textarea
                    value={newCargo.cargo_description}
                    onChange={(e) => setNewCargo({ ...newCargo, cargo_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Detailed description of cargo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commodity Type</label>
                  <input
                    type="text"
                    value={newCargo.commodity_type}
                    onChange={(e) => setNewCargo({ ...newCargo, commodity_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Electronics, Furniture"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HS Code</label>
                  <input
                    type="text"
                    value={newCargo.hs_code}
                    onChange={(e) => setNewCargo({ ...newCargo, hs_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Harmonized System Code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Packages *</label>
                  <input
                    type="number"
                    value={newCargo.number_of_packages || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, number_of_packages: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Type</label>
                  <select
                    value={newCargo.package_type}
                    onChange={(e) => setNewCargo({ ...newCargo, package_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {packageTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gross Weight (KG) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCargo.gross_weight_kg || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, gross_weight_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Net Weight (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCargo.net_weight_kg || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, net_weight_kg: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Volume (CBM) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newCargo.volume_cbm || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, volume_cbm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chargeable Weight</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCargo.chargeable_weight || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, chargeable_weight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="For air freight"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marks and Numbers</label>
                  <textarea
                    value={newCargo.marks_and_numbers}
                    onChange={(e) => setNewCargo({ ...newCargo, marks_and_numbers: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Package markings and identification numbers"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                  <textarea
                    value={newCargo.delivery_address}
                    onChange={(e) => setNewCargo({ ...newCargo, delivery_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Full delivery address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Zone</label>
                  <select
                    value={newCargo.delivery_zone_id}
                    onChange={(e) => setNewCargo({ ...newCargo, delivery_zone_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Zone</option>
                    {deliveryZones.map(z => (
                      <option key={z.id} value={z.id}>
                        {z.zone_name} - {z.city_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Value (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCargo.cargo_value_usd || ''}
                    onChange={(e) => setNewCargo({ ...newCargo, cargo_value_usd: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Declared value"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <input
                    type="checkbox"
                    checked={newCargo.insurance_required}
                    onChange={(e) => setNewCargo({ ...newCargo, insurance_required: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900">Insurance Required</label>
                    <p className="text-xs text-gray-600">Check if cargo needs insurance</p>
                  </div>
                </div>

                {newCargo.insurance_required && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Value (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCargo.insurance_value || ''}
                      onChange={(e) => setNewCargo({ ...newCargo, insurance_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Handling Instructions</label>
                  <textarea
                    value={newCargo.special_handling}
                    onChange={(e) => setNewCargo({ ...newCargo, special_handling: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Fragile, temperature control, hazardous, etc."
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Instructions</label>
                  <textarea
                    value={newCargo.delivery_instructions}
                    onChange={(e) => setNewCargo({ ...newCargo, delivery_instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Special delivery requirements"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <button
                  onClick={() => setShowAddCargo(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addCargoItem}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Cargo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {revenueItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-green-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Section 3 - Revenue (Rate Sheet Engine)
            </h3>
            <button
              onClick={() => setShowRevenueDetails(!showRevenueDetails)}
              className="text-green-600 hover:text-green-700 font-medium flex items-center gap-2"
            >
              {showRevenueDetails ? 'Hide Details' : 'Show Details'}
              {showRevenueDetails ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>

          {showRevenueDetails && (
            <>
              <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg">
                <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Auto-Filled Slab Revenue
                </h4>
                <p className="text-green-800 text-sm">
                  All revenue items below are automatically calculated from the slab-based rate sheet using
                  your shipment's CBM ({formData.summary_total_cbm.toFixed(3)}) and weight ({formData.summary_total_weight_kg.toFixed(2)} KG).
                </p>
              </div>

              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="text-left p-3 font-bold text-gray-900">Service</th>
                      <th className="text-left p-3 font-bold text-gray-900">Unit</th>
                      <th className="text-right p-3 font-bold text-gray-900">Quantity</th>
                      <th className="text-right p-3 font-bold text-gray-900">Rate</th>
                      <th className="text-center p-3 font-bold text-gray-900">Currency</th>
                      <th className="text-right p-3 font-bold text-gray-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueItems.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{item.service_name}</td>
                        <td className="p-3 text-gray-700">{item.unit_type}</td>
                        <td className="p-3 text-right font-semibold text-gray-900">
                          {item.quantity.toFixed(3)}
                        </td>
                        <td className="p-3 text-right font-semibold text-gray-900">
                          {item.rate.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                            {item.currency}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-green-700 text-lg">
                          {item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 border-t-2 border-green-300">
                      <td colSpan={5} className="p-3 text-right font-bold text-gray-900 text-lg">
                        Total Revenue ({revenueCurrency}):
                      </td>
                      <td className="p-3 text-right font-bold text-green-800 text-2xl">
                        {revenueItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-gray-200">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Exchange Rate Lock
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Revenue Currency
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-4 py-3 bg-blue-100 border-2 border-blue-400 rounded-lg font-bold text-blue-900 text-lg text-center">
                        {revenueCurrency}
                      </div>
                      <div className="text-gray-500 text-sm">Auto</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exchange Rate (1 {revenueCurrency} = ? INR)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.0001"
                        value={exchangeRate}
                        onChange={(e) => !isExchangeRateLocked && setExchangeRate(parseFloat(e.target.value) || 0)}
                        disabled={isExchangeRateLocked}
                        className={`w-full px-4 py-3 border-2 rounded-lg font-bold text-lg ${
                          isExchangeRateLocked
                            ? 'bg-gray-200 border-gray-400 text-gray-700 cursor-not-allowed'
                            : 'bg-yellow-50 border-yellow-400 text-yellow-900 focus:ring-2 focus:ring-yellow-500'
                        }`}
                        placeholder="83.50"
                      />
                      {isExchangeRateLocked && (
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      )}
                      {!isExchangeRateLocked && (
                        <Unlock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    {!isExchangeRateLocked && (
                      <p className="text-xs text-yellow-700 mt-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Editable before save
                      </p>
                    )}
                    {isExchangeRateLocked && (
                      <p className="text-xs text-gray-600 mt-1 font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked after save
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Converted Revenue (INR)
                    </label>
                    <div className="px-4 py-3 bg-green-100 border-2 border-green-400 rounded-lg font-bold text-green-900 text-xl text-center">
                      ₹ {(revenueItems.reduce((sum, item) => sum + item.amount, 0) * exchangeRate).toFixed(2)}
                    </div>
                    <p className="text-xs text-green-700 mt-1 font-medium text-center">
                      Auto-calculated
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    {isExchangeRateLocked ? (
                      <Lock className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
                    )}
                    <div>
                      <h5 className="font-bold text-blue-900 mb-1">
                        {isExchangeRateLocked ? 'Exchange Rate Locked' : 'Exchange Rate Policy'}
                      </h5>
                      {isExchangeRateLocked ? (
                        <p className="text-blue-800 text-sm">
                          The exchange rate for this shipment has been locked and cannot be changed.
                          This ensures consistent financial reporting and prevents rate manipulation.
                        </p>
                      ) : (
                        <p className="text-blue-800 text-sm">
                          You can adjust the exchange rate now. Once you save the shipment, the exchange rate
                          will be <strong>permanently locked</strong> to ensure data integrity and accurate financial tracking.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Foreign Currency Total</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {revenueCurrency} {revenueItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                    <div className="text-sm text-green-700 mb-1">INR Total (Base Currency)</div>
                    <div className="text-2xl font-bold text-green-900">
                      ₹ {(revenueItems.reduce((sum, item) => sum + item.amount, 0) * exchangeRate).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {!showRevenueDetails && (
            <div className="text-center py-8">
              <DollarSign className="w-16 h-16 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                {revenueItems.length} revenue items loaded from rate sheet
              </p>
              <p className="text-green-700 font-bold text-2xl mt-2">
                Total: {revenueCurrency} {revenueItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                {' → '}₹ {(revenueItems.reduce((sum, item) => sum + item.amount, 0) * exchangeRate).toFixed(2)}
              </p>
              <button
                onClick={() => setShowRevenueDetails(true)}
                className="mt-4 text-green-600 hover:text-green-700 font-medium underline"
              >
                View Revenue Breakdown
              </button>
            </div>
          )}
        </div>
      )}

      {isNonMetroDelivery() && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-orange-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-6 h-6 text-orange-600" />
                Section 4 - Additional Trucking (Non-Metro Delivery)
              </h3>
              <p className="text-sm text-orange-700 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                This section appears because delivery city is in Non-Metro zone
              </p>
            </div>
            {!showAdditionalTrucking && (
              <button
                onClick={() => setShowAdditionalTrucking(true)}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Trucking Cost
              </button>
            )}
          </div>

          {!showAdditionalTrucking && (
            <div className="text-center py-8 bg-orange-50 border border-orange-200 rounded-lg">
              <Truck className="w-16 h-16 text-orange-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">
                No additional trucking cost added yet
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Click "Add Trucking Cost" to add trucking charges for non-metro delivery
              </p>
            </div>
          )}

          {showAdditionalTrucking && (
            <div className="space-y-6">
              <div className="p-4 bg-orange-50 border border-orange-300 rounded-lg">
                <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Trucking Cost Entry
                </h4>
                <p className="text-orange-800 text-sm">
                  Enter the base trucking cost, tolls, and any special handling charges. You can add a margin
                  and choose whether to bill this to the agent or absorb as a cost.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Truck Type *
                  </label>
                  <select
                    value={truckingData.truck_type}
                    onChange={(e) => setTruckingData({ ...truckingData, truck_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {truckTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name *
                  </label>
                  <select
                    value={truckingData.vendor_id}
                    onChange={(e) => {
                      const vendor = truckingVendors.find(v => v.id === e.target.value);
                      setTruckingData({
                        ...truckingData,
                        vendor_id: e.target.value,
                        vendor_name: vendor ? vendor.vendor_name : ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Vendor</option>
                    {truckingVendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.vendor_name} ({vendor.vendor_code})
                      </option>
                    ))}
                  </select>
                  {!truckingData.vendor_id && (
                    <p className="text-xs text-gray-500 mt-1">Or enter custom vendor name below</p>
                  )}
                  {!truckingData.vendor_id && (
                    <input
                      type="text"
                      value={truckingData.vendor_name}
                      onChange={(e) => setTruckingData({ ...truckingData, vendor_name: e.target.value })}
                      placeholder="Custom vendor name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Truck Cost (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingData.base_truck_cost_inr}
                    onChange={(e) => setTruckingData({ ...truckingData, base_truck_cost_inr: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Toll Estimate (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingData.toll_estimate}
                    onChange={(e) => setTruckingData({ ...truckingData, toll_estimate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Escort / Special Handling (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingData.escort_special_handling}
                    onChange={(e) => setTruckingData({ ...truckingData, escort_special_handling: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Trucking Cost (INR)
                  </label>
                  <div className="px-4 py-3 bg-gray-100 border-2 border-gray-400 rounded-lg font-bold text-gray-900 text-lg">
                    ₹ {calculateTruckingTotals().totalCost.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Auto-calculated: Base + Toll + Escort</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Margin % (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingData.margin_percentage}
                    onChange={(e) => setTruckingData({ ...truckingData, margin_percentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                  {truckingData.margin_percentage > 0 && (
                    <p className="text-xs text-green-700 mt-1 font-medium">
                      Margin Amount: ₹ {calculateTruckingTotals().marginAmount.toFixed(2)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Distance (KM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={truckingData.distance_km}
                    onChange={(e) => setTruckingData({ ...truckingData, distance_km: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route Details
                  </label>
                  <input
                    type="text"
                    value={truckingData.route_details}
                    onChange={(e) => setTruckingData({ ...truckingData, route_details: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Mumbai Port → Pune → Nashik"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={truckingData.notes}
                    onChange={(e) => setTruckingData({ ...truckingData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={2}
                    placeholder="Any additional notes about the trucking"
                  />
                </div>
              </div>

              <div className="pt-6 border-t-2 border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                    <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Billable to Agent?
                    </h4>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={truckingData.is_billable}
                          onChange={() => setTruckingData({ ...truckingData, is_billable: true })}
                          className="w-5 h-5 text-green-600"
                        />
                        <span className="font-medium text-gray-900">Yes - Bill to Agent</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!truckingData.is_billable}
                          onChange={() => setTruckingData({ ...truckingData, is_billable: false })}
                          className="w-5 h-5 text-red-600"
                        />
                        <span className="font-medium text-gray-900">No - Absorb Cost</span>
                      </label>
                    </div>
                    <div className="mt-3 p-3 bg-white border border-blue-200 rounded">
                      {truckingData.is_billable ? (
                        <p className="text-sm text-green-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Will add extra revenue line item
                        </p>
                      ) : (
                        <p className="text-sm text-orange-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Will add cost only (no revenue)
                        </p>
                      )}
                    </div>
                  </div>

                  {truckingData.is_billable && (
                    <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50">
                      <h4 className="font-bold text-green-900 mb-3">Charge Currency</h4>
                      <div className="flex items-center gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={truckingData.charge_currency === 'INR'}
                            onChange={() => setTruckingData({ ...truckingData, charge_currency: 'INR' })}
                            className="w-5 h-5 text-blue-600"
                          />
                          <span className="font-medium text-gray-900">INR</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={truckingData.charge_currency === 'USD'}
                            onChange={() => setTruckingData({ ...truckingData, charge_currency: 'USD' })}
                            className="w-5 h-5 text-blue-600"
                          />
                          <span className="font-medium text-gray-900">USD</span>
                        </label>
                      </div>
                      <div className="p-3 bg-white border border-green-200 rounded">
                        <div className="text-sm text-gray-700 mb-1">Final Charge to Agent:</div>
                        <div className="text-2xl font-bold text-green-900">
                          {truckingData.charge_currency === 'INR' ? '₹' : '$'}{' '}
                          {calculateTruckingTotals().finalCharge.toFixed(2)}
                        </div>
                        {truckingData.charge_currency === 'USD' && (
                          <p className="text-xs text-gray-600 mt-1">
                            Using exchange rate: {exchangeRate}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!truckingData.is_billable && (
                    <div className="p-4 border-2 border-orange-300 rounded-lg bg-orange-50">
                      <h4 className="font-bold text-orange-900 mb-3">Cost Summary</h4>
                      <div className="p-3 bg-white border border-orange-200 rounded">
                        <div className="text-sm text-gray-700 mb-1">Total Cost to Company:</div>
                        <div className="text-2xl font-bold text-orange-900">
                          ₹ {calculateTruckingTotals().finalCharge.toFixed(2)}
                        </div>
                        <p className="text-xs text-orange-700 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Not billable - will reduce profit
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAdditionalTrucking(false);
                    setTruckingData({
                      truck_type: '20ft Container',
                      vendor_id: '',
                      vendor_name: '',
                      base_truck_cost_inr: 0,
                      toll_estimate: 0,
                      escort_special_handling: 0,
                      margin_percentage: 0,
                      is_billable: false,
                      charge_currency: 'INR',
                      route_details: '',
                      distance_km: 0,
                      notes: '',
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!truckingData.vendor_name) {
                      alert('Please select or enter a vendor name');
                      return;
                    }
                    if (truckingData.base_truck_cost_inr <= 0) {
                      alert('Please enter a base truck cost');
                      return;
                    }
                    alert('Trucking cost will be saved with the shipment');
                  }}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Confirm Trucking Cost
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {formData.container_id && cargoItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-purple-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-purple-600" />
                Section 5 - Container Cost Allocation
              </h3>
              <p className="text-sm text-purple-700 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Auto-calculated based on CBM usage
              </p>
            </div>
            {!containerAllocation.is_allocation_overridden && (
              <button
                onClick={() => {
                  setShowAdminOverride(true);
                  setOverrideAmount(containerAllocation.allocated_container_cost_inr);
                }}
                className="text-sm text-purple-600 hover:text-purple-700 underline flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
                Admin Override
              </button>
            )}
          </div>

          <div className="p-4 bg-purple-50 border border-purple-300 rounded-lg mb-6">
            <h4 className="font-bold text-purple-900 mb-2">Auto-Pulled from Container</h4>
            <p className="text-purple-800 text-sm">
              All values are automatically calculated based on the selected container and cargo items.
              Only administrators can manually override these values.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border-2 border-gray-300 rounded-lg bg-gray-50">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Total Container CBM
              </label>
              <div className="text-3xl font-bold text-gray-900">
                {containerAllocation.container_total_cbm.toFixed(2)} CBM
              </div>
              <p className="text-xs text-gray-600 mt-1">Container total capacity</p>
            </div>

            <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Shipment CBM
              </label>
              <div className="text-3xl font-bold text-blue-900">
                {containerAllocation.shipment_total_cbm.toFixed(2)} CBM
              </div>
              <p className="text-xs text-blue-700 mt-1">Sum of all cargo items</p>
            </div>

            <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50">
              <label className="block text-sm font-medium text-green-700 mb-2">
                Allocation %
              </label>
              <div className="text-3xl font-bold text-green-900">
                {containerAllocation.allocation_percentage.toFixed(2)}%
              </div>
              <p className="text-xs text-green-700 mt-1">
                {containerAllocation.shipment_total_cbm.toFixed(2)} ÷ {containerAllocation.container_total_cbm.toFixed(2)} × 100
              </p>
            </div>

            <div className="p-4 border-2 border-purple-300 rounded-lg bg-purple-50">
              <label className="block text-sm font-medium text-purple-700 mb-2">
                Container Total Cost (INR)
              </label>
              <div className="text-3xl font-bold text-purple-900">
                ₹ {containerAllocation.container_total_cost_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-purple-700 mt-1">From container record</p>
            </div>
          </div>

          <div className="mt-6 p-6 border-4 border-green-400 rounded-lg bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-green-700 mb-2">
                  Allocated Container Cost (INR)
                </label>
                <div className="text-4xl font-bold text-green-900">
                  ₹ {containerAllocation.allocated_container_cost_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-green-700 mt-2">
                  Formula: ₹{containerAllocation.container_total_cost_inr.toLocaleString('en-IN')} × ({containerAllocation.allocation_percentage.toFixed(2)}% ÷ 100)
                </p>
              </div>
              <div className="text-green-600">
                <Calculator className="w-16 h-16" />
              </div>
            </div>

            {containerAllocation.is_allocation_overridden && (
              <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-700 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900">
                    This allocation has been manually overridden by an administrator
                  </p>
                  <button
                    onClick={() => {
                      if (confirm('Reset allocation to auto-calculated value?')) {
                        updateContainerAllocation();
                      }
                    }}
                    className="text-sm text-orange-700 underline mt-1"
                  >
                    Reset to Auto-Calculated
                  </button>
                </div>
              </div>
            )}
          </div>

          {showAdminOverride && (
            <div className="mt-6 p-6 border-2 border-red-400 rounded-lg bg-red-50">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-red-900 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Admin Override - Manual Allocation
                </h4>
                <button
                  onClick={() => {
                    setShowAdminOverride(false);
                    setOverrideAmount(0);
                    setOverrideReason('');
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Auto-Calculated Cost
                  </label>
                  <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded text-gray-700 font-medium">
                    ₹ {containerAllocation.allocated_container_cost_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Override Amount (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={overrideAmount}
                    onChange={(e) => setOverrideAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Override *
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    rows={3}
                    placeholder="Explain why manual override is needed..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <button
                    onClick={() => {
                      setShowAdminOverride(false);
                      setOverrideAmount(0);
                      setOverrideReason('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!overrideReason.trim()) {
                        alert('Please provide a reason for the override');
                        return;
                      }
                      if (overrideAmount <= 0) {
                        alert('Please enter a valid override amount');
                        return;
                      }

                      setContainerAllocation({
                        ...containerAllocation,
                        allocated_container_cost_inr: overrideAmount,
                        is_allocation_overridden: true,
                      });
                      setShowAdminOverride(false);
                      alert('Container cost allocation overridden successfully');
                    }}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <Shield className="w-5 h-5" />
                    Apply Override
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <div className="flex items-start gap-2">
              <Lock className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-bold text-gray-900 mb-1">Read-Only Fields</h5>
                <p className="text-sm text-gray-700">
                  All fields in this section are automatically calculated and cannot be edited directly.
                  The system recalculates allocation whenever cargo items are added, modified, or removed.
                  Only administrators with proper permissions can manually override the allocated cost.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {formData.ata && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-indigo-300">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-indigo-600" />
                Section 7 - Storage (Auto-Calculated)
              </h3>
              <p className="text-sm text-indigo-700 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Storage charges calculated based on ATA and delivery date
              </p>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-300 rounded-lg mb-6">
            <h4 className="font-bold text-indigo-900 mb-2">Auto-Calculation Logic</h4>
            <div className="text-sm text-indigo-800 space-y-1">
              <p>• Storage Start = ATA + 1 day</p>
              <p>• Total Days = Delivery Date - Storage Start (or Current Date if no delivery)</p>
              <p>• Chargeable Days = Total Days - Free Days</p>
              <p>• Storage Amount = Chargeable Days × Rate per Day × Total CBM</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Rate Sheet *
              </label>
              <select
                value={storageData.storage_rate_sheet_id}
                onChange={(e) => {
                  setStorageData({ ...storageData, storage_rate_sheet_id: e.target.value });
                }}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Storage Rate Sheet</option>
                {storageRateSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name} ({sheet.free_days} free days)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                Free Days
                <span className="text-xs text-gray-500">(Auto from rate sheet)</span>
              </label>
              <div className="px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700 font-medium text-lg">
                {storageData.storage_free_days} days
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                Storage Start Date
                <span className="text-xs text-gray-500">(Auto: ATA + 1)</span>
              </label>
              <div className="px-4 py-3 bg-blue-50 border-2 border-blue-300 rounded-lg text-blue-900 font-medium">
                {storageData.storage_start_date || 'Calculating...'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Date (Manual)
              </label>
              <input
                type="date"
                value={storageData.storage_delivery_date}
                onChange={(e) => {
                  setStorageData({ ...storageData, storage_delivery_date: e.target.value });
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-600 mt-1">Leave empty to calculate to current date</p>
            </div>
          </div>

          {storageData.storage_rate_sheet_id && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Total Days in Storage
                  </label>
                  <div className="text-3xl font-bold text-blue-900">
                    {storageData.storage_total_days} days
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    {storageData.storage_delivery_date
                      ? `Delivery Date - Storage Start`
                      : `Current Date - Storage Start`}
                  </p>
                </div>

                <div className="p-4 border-2 border-orange-300 rounded-lg bg-orange-50">
                  <label className="block text-sm font-medium text-orange-700 mb-2">
                    Chargeable Days
                  </label>
                  <div className="text-3xl font-bold text-orange-900">
                    {storageData.storage_chargeable_days} days
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    Total Days ({storageData.storage_total_days}) - Free Days ({storageData.storage_free_days})
                  </p>
                </div>

                <div className="p-4 border-2 border-purple-300 rounded-lg bg-purple-50">
                  <label className="block text-sm font-medium text-purple-700 mb-2">
                    Storage Rate Slab
                  </label>
                  <div className="text-lg font-bold text-purple-900">
                    {storageData.storage_rate_slab_name || 'N/A'}
                  </div>
                  <p className="text-xs text-purple-700 mt-1">
                    ₹{storageData.storage_rate_per_day_per_cbm.toFixed(2)} per day per CBM
                  </p>
                </div>

                <div className="p-4 border-2 border-gray-300 rounded-lg bg-gray-50">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Volume
                  </label>
                  <div className="text-2xl font-bold text-gray-900">
                    {calculateTotals().totalVolume.toFixed(2)} CBM
                  </div>
                  <p className="text-xs text-gray-600 mt-1">From cargo items</p>
                </div>
              </div>

              {storageSlabs.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3">Storage Rate Slabs</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Day Range</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Rate per Day per CBM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {storageSlabs.map((slab) => (
                          <tr key={slab.id} className={storageData.storage_rate_slab_name.includes(`${slab.from_days}`) ? 'bg-indigo-100' : ''}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {slab.from_days} - {slab.to_days || '+'} days
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                              ₹{slab.rate_per_unit_per_day?.toFixed(2) || '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-6 border-4 border-green-400 rounded-lg bg-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-green-700 mb-2">
                      Storage Amount (INR)
                    </label>
                    <div className="text-4xl font-bold text-green-900">
                      ₹ {storageData.storage_amount_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-sm text-green-700 mt-2">
                      Formula: {storageData.storage_chargeable_days} days × ₹{storageData.storage_rate_per_day_per_cbm.toFixed(2)} × {calculateTotals().totalVolume.toFixed(2)} CBM
                    </p>
                  </div>
                  <div className="text-green-600">
                    <Calculator className="w-16 h-16" />
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storageData.storage_billable_to_agent}
                    onChange={(e) => {
                      setStorageData({ ...storageData, storage_billable_to_agent: e.target.checked });
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-blue-900">Billable to Agent?</span>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Check this to include storage charges in monthly agent invoice
                    </p>
                  </div>
                </label>
              </div>

              {storageData.storage_billable_to_agent && (
                <div className="mt-4 p-4 border-2 border-yellow-300 rounded-lg bg-yellow-50">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="font-bold text-yellow-900 mb-1">Monthly Invoice Automation</h5>
                      <p className="text-sm text-yellow-800">
                        This storage charge will be automatically included in the monthly agent invoice.
                        The invoice will be generated at the end of the billing cycle and sent to the agent.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <div className="flex items-start gap-2">
              <Lock className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h5 className="font-bold text-gray-900 mb-1">Auto-Calculated Fields</h5>
                <p className="text-sm text-gray-700">
                  Storage charges are automatically calculated based on the ATA date, delivery date (if provided),
                  and the selected storage rate sheet. The system automatically selects the appropriate rate slab
                  based on the total days in storage. Calculation updates whenever dates or rate sheet changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      <div className="w-96 flex-shrink-0">
        <div className="sticky top-4">
          <div className={`rounded-lg shadow-lg border-4 ${marginConfig.borderColor} ${marginConfig.bgColor} overflow-hidden`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Financial Summary</h3>
                <DollarSign className="w-6 h-6 text-gray-700" />
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Revenue Summary
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Base Revenue</span>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {financialSummary.revenue_currency} {financialSummary.base_revenue_foreign.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          @ {financialSummary.exchange_rate.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Converted (INR)</span>
                      <input
                        type="number"
                        value={financialSummary.base_revenue_inr.toFixed(2)}
                        className="w-32 text-right font-medium text-gray-900 px-2 py-1 border border-gray-300 rounded"
                        readOnly
                      />
                    </div>

                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Extra Charges</span>
                      <input
                        type="number"
                        value={financialSummary.extra_charges_inr}
                        onChange={(e) => setFinancialSummary({ ...financialSummary, extra_charges_inr: parseFloat(e.target.value) || 0 })}
                        className="w-32 text-right font-medium text-gray-900 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg border-2 border-blue-400 font-bold">
                      <span className="text-blue-900">Total Revenue</span>
                      <span className="text-blue-900">
                        ₹ {financialSummary.total_revenue_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-gray-300 pt-4">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    Cost Summary
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Container Cost</span>
                      <span className="font-medium text-gray-900">
                        ₹ {financialSummary.container_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Trucking Cost</span>
                      <span className="font-medium text-gray-900">
                        ₹ {financialSummary.trucking_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Storage Cost</span>
                      <span className="font-medium text-gray-900">
                        ₹ {financialSummary.storage_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-white rounded border border-gray-200">
                      <span className="text-gray-700">Local Costs</span>
                      <input
                        type="number"
                        value={financialSummary.local_costs}
                        onChange={(e) => setFinancialSummary({ ...financialSummary, local_costs: parseFloat(e.target.value) || 0 })}
                        className="w-32 text-right font-medium text-gray-900 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg border-2 border-red-400 font-bold">
                      <span className="text-red-900">Total Costs</span>
                      <span className="text-red-900">
                        ₹ {financialSummary.total_costs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t-4 border-gray-400 pt-4">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-600" />
                    Profit Calculation
                  </h4>

                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-white rounded-lg border-2 border-gray-300">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-700">Total Revenue</span>
                        <span className="font-medium text-gray-900">
                          ₹ {financialSummary.total_revenue_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-700">Total Costs</span>
                        <span className="font-medium text-gray-900">
                          - ₹ {financialSummary.total_costs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="border-t-2 border-gray-300 mt-2 pt-2"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-900">Estimated Profit</span>
                        <span className={`font-bold text-lg ${financialSummary.estimated_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ₹ {financialSummary.estimated_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-white rounded-lg border-2 border-purple-300 text-center">
                        <div className="text-xs text-gray-600 mb-1">Profit %</div>
                        <div className={`text-2xl font-bold ${financialSummary.profit_percentage >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                          {financialSummary.profit_percentage.toFixed(1)}%
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border-2 border-gray-300 text-center">
                        <div className="text-xs text-gray-600 mb-1">Target %</div>
                        <div className="text-2xl font-bold text-gray-700">
                          <input
                            type="number"
                            value={financialSummary.target_margin}
                            onChange={(e) => setFinancialSummary({ ...financialSummary, target_margin: parseFloat(e.target.value) || 20 })}
                            className="w-16 text-center border border-gray-300 rounded"
                            step="0.1"
                          />%
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg border-4 ${marginConfig.borderColor} ${marginConfig.bgColor}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">Status</div>
                          <div className={`text-lg font-bold ${marginConfig.textColor} flex items-center gap-2`}>
                            <MarginIcon className={`w-6 h-6 ${marginConfig.iconColor}`} />
                            {marginConfig.text}
                          </div>
                        </div>
                        {financialSummary.margin_status === 'above_target' && (
                          <div className="text-green-600">
                            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {financialSummary.margin_status === 'low_margin' && (
                          <div className="text-yellow-600">
                            <AlertCircle className="w-12 h-12" />
                          </div>
                        )}
                        {(financialSummary.margin_status === 'below_minimum' || financialSummary.margin_status === 'loss') && (
                          <div className="text-red-600">
                            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {financialSummary.margin_status === 'low_margin' && (
                        <div className="mt-2 text-xs text-yellow-800">
                          Margin is below target but above minimum threshold (75% of target)
                        </div>
                      )}
                      {financialSummary.margin_status === 'below_minimum' && (
                        <div className="mt-2 text-xs text-red-800">
                          Margin is below minimum threshold (75% of target). Review costs or increase revenue.
                        </div>
                      )}
                      {financialSummary.margin_status === 'loss' && (
                        <div className="mt-2 text-xs text-red-900 font-bold">
                          This shipment is showing a loss. Immediate attention required!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-300">
            <div className="text-xs text-gray-700">
              <div className="font-bold mb-2">Legend:</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded border border-green-600"></div>
                  <span>Above Target: Profit ≥ Target %</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded border border-yellow-600"></div>
                  <span>Low Margin: 75% ≤ Profit &lt; Target %</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded border border-red-600"></div>
                  <span>Below Minimum: Profit &lt; 75% of Target</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded border border-red-800"></div>
                  <span>Loss: Negative Profit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
