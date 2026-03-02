import React, { useState, useEffect } from 'react';
import {
  Ship,
  Package,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Truck,
  Warehouse,
  DollarSign,
  ChevronRight,
  Calendar,
  User,
  Upload,
  Download,
  Edit,
  Save,
  X,
  Plus,
  CheckSquare,
  Square,
  Bell,
  TrendingUp,
  MapPin,
  Anchor,
  Shield,
  Home,
  ClipboardCheck,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WorkflowStage {
  id: string;
  stage_name: string;
  display_name: string;
  stage_order: number;
  description: string;
  is_active: boolean;
}

interface ShipmentWorkflow {
  id: string;
  import_shipment_id: string;
  current_stage: string;
  overall_status: string;
  is_completed: boolean;
  completion_date: string | null;
  shipment_number: string;
  client_name: string;
  port_of_loading: string;
  port_of_discharge: string;
  eta: string;
  total_volume_cbm: number;
}

interface StageHistory {
  id: string;
  stage_name: string;
  entered_at: string;
  completed_at: string | null;
  duration_hours: number | null;
  completed_by: string | null;
  notes: string | null;
  display_name: string;
}

interface DocumentChecklistItem {
  id: string;
  document_name: string;
  is_mandatory: boolean;
  is_uploaded: boolean;
  uploaded_at: string | null;
  uploaded_by: string | null;
}

interface StageTask {
  id: string;
  task_description: string;
  is_completed: boolean;
  priority: string;
  due_date: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

interface ContainerTracking {
  id: string;
  container_number: string;
  vessel_eta: string;
  actual_arrival_date: string | null;
  free_time_expires: string | null;
  detention_per_day: number;
  gate_in_warehouse: string | null;
  status: string;
}

interface CustomsTracking {
  id: string;
  customs_broker: string;
  entry_number: string;
  entry_date: string | null;
  assessment_date: string | null;
  duty_amount: number;
  igst_amount: number;
  total_customs_cost: number;
  payment_date: string | null;
  out_of_charge_date: string | null;
  clearance_status: string;
}

interface DeliveryInfo {
  id: string;
  delivery_type: string;
  delivery_scheduled_date: string | null;
  delivery_actual_date: string | null;
  delivery_address: string;
  contact_person: string;
  contact_phone: string;
  vehicle_number: string;
  pod_received: boolean;
  delivery_status: string;
}

interface ProfitFinalization {
  id: string;
  initial_revenue_inr: number;
  final_revenue_inr: number;
  initial_cost_inr: number;
  final_cost_inr: number;
  initial_profit_inr: number;
  final_profit_inr: number;
  variance_amount: number;
  variance_percent: number;
  is_invoiced: boolean;
  invoice_number: string;
}

export default function InboundWorkflow() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<ShipmentWorkflow[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);
  const [stageHistory, setStageHistory] = useState<StageHistory[]>([]);
  const [documents, setDocuments] = useState<DocumentChecklistItem[]>([]);
  const [tasks, setTasks] = useState<StageTask[]>([]);
  const [containerTracking, setContainerTracking] = useState<ContainerTracking | null>(null);
  const [customsTracking, setCustomsTracking] = useState<CustomsTracking | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [profitData, setProfitData] = useState<ProfitFinalization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'tasks' | 'details'>('timeline');
  const [showStageUpdate, setShowStageUpdate] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('in_progress');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  useEffect(() => {
    if (selectedShipment) {
      loadShipmentDetails(selectedShipment);
    }
  }, [selectedShipment]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: stagesData, error: stagesError } = await supabase
        .from('workflow_stages')
        .select('*')
        .eq('is_active', true)
        .order('stage_order');

      if (stagesError) throw stagesError;
      setStages(stagesData || []);

      let query = supabase
        .from('shipment_workflow_status')
        .select(`
          *,
          import_shipments!inner(
            shipment_number,
            client_name,
            port_of_loading,
            port_of_discharge,
            eta,
            total_volume_cbm
          )
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('is_completed', filterStatus === 'completed');
      }

      const { data: shipmentsData, error: shipmentsError } = await query;

      if (shipmentsError) throw shipmentsError;

      const formattedShipments = (shipmentsData || []).map((item: any) => ({
        id: item.id,
        import_shipment_id: item.import_shipment_id,
        current_stage: item.current_stage,
        overall_status: item.overall_status,
        is_completed: item.is_completed,
        completion_date: item.completion_date,
        shipment_number: item.import_shipments.shipment_number,
        client_name: item.import_shipments.client_name,
        port_of_loading: item.import_shipments.port_of_loading,
        port_of_discharge: item.import_shipments.port_of_discharge,
        eta: item.import_shipments.eta,
        total_volume_cbm: item.import_shipments.total_volume_cbm,
      }));

      setShipments(formattedShipments);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const loadShipmentDetails = async (shipmentId: string) => {
    try {
      const { data: historyData } = await supabase
        .from('workflow_stage_history')
        .select(`
          *,
          workflow_stages!inner(display_name)
        `)
        .eq('import_shipment_id', shipmentId)
        .order('entered_at');

      const formattedHistory = (historyData || []).map((item: any) => ({
        ...item,
        display_name: item.workflow_stages.display_name,
      }));

      setStageHistory(formattedHistory);

      const currentShipment = shipments.find(s => s.import_shipment_id === shipmentId);
      if (currentShipment) {
        const { data: checklistData } = await supabase
          .from('document_checklist')
          .select('*')
          .eq('stage_name', currentShipment.current_stage);

        const { data: uploadedDocs } = await supabase
          .from('shipment_documents')
          .select('document_type, uploaded_at, uploaded_by')
          .eq('import_shipment_id', shipmentId)
          .eq('stage_name', currentShipment.current_stage);

        const docsWithStatus = (checklistData || []).map(doc => ({
          id: doc.id,
          document_name: doc.document_name,
          is_mandatory: doc.is_mandatory,
          is_uploaded: uploadedDocs?.some(u => u.document_type === doc.document_name) || false,
          uploaded_at: uploadedDocs?.find(u => u.document_type === doc.document_name)?.uploaded_at || null,
          uploaded_by: uploadedDocs?.find(u => u.document_type === doc.document_name)?.uploaded_by || null,
        }));

        setDocuments(docsWithStatus);
      }

      const { data: tasksData } = await supabase
        .from('stage_tasks')
        .select('*')
        .eq('import_shipment_id', shipmentId)
        .order('priority', { ascending: false });

      setTasks(tasksData || []);

      const { data: containerData } = await supabase
        .from('container_arrival_tracking')
        .select('*')
        .eq('import_shipment_id', shipmentId)
        .maybeSingle();

      setContainerTracking(containerData);

      const { data: customsData } = await supabase
        .from('customs_clearance_tracking')
        .select('*')
        .eq('import_shipment_id', shipmentId)
        .maybeSingle();

      setCustomsTracking(customsData);

      const { data: deliveryData } = await supabase
        .from('delivery_coordination')
        .select('*')
        .eq('import_shipment_id', shipmentId)
        .maybeSingle();

      setDeliveryInfo(deliveryData);

      const { data: profitDataResult } = await supabase
        .from('profit_finalization')
        .select('*')
        .eq('import_shipment_id', shipmentId)
        .maybeSingle();

      setProfitData(profitDataResult);
    } catch (error) {
      console.error('Error loading shipment details:', error);
    }
  };

  const updateStage = async () => {
    if (!selectedShipment || !newStage) {
      alert('Please select a new stage');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('update_workflow_stage', {
        p_shipment_id: selectedShipment,
        p_new_stage: newStage,
        p_user_id: user?.id,
        p_notes: stageNotes || null,
      });

      if (error) throw error;

      alert('Stage updated successfully!');
      setShowStageUpdate(false);
      setNewStage('');
      setStageNotes('');
      loadData();
      loadShipmentDetails(selectedShipment);
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Failed to update stage');
    }
  };

  const toggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('stage_tasks')
        .update({
          is_completed: !isCompleted,
          completed_by: !isCompleted ? user?.id : null,
          completed_at: !isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (error) throw error;

      if (selectedShipment) {
        loadShipmentDetails(selectedShipment);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getStageIcon = (stageName: string) => {
    const icons: { [key: string]: any } = {
      pre_alert: Bell,
      vessel_departed: Ship,
      in_transit: Ship,
      vessel_arrived: Anchor,
      container_discharged: Package,
      documents_received: FileText,
      customs_filed: Shield,
      customs_assessed: Shield,
      duty_paid: DollarSign,
      customs_cleared: CheckCircle,
      warehouse_received: Warehouse,
      delivery_scheduled: Calendar,
      out_for_delivery: Truck,
      delivered: Home,
      pod_received: ClipboardCheck,
      closed: CheckCircle,
    };
    return icons[stageName] || Clock;
  };

  const getStageColor = (stageName: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-green-600 bg-green-50 border-green-300';
    return 'text-blue-600 bg-blue-50 border-blue-300';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedShipmentData = shipments.find(s => s.import_shipment_id === selectedShipment);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading workflow data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inbound Operations Workflow</h2>
          <p className="text-gray-600 mt-1">Track shipments from pre-alert to profit finalization</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">All Shipments</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Active Shipments</h3>
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {shipments.map((shipment) => {
                const StageIcon = getStageIcon(shipment.current_stage);
                return (
                  <button
                    key={shipment.id}
                    onClick={() => setSelectedShipment(shipment.import_shipment_id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedShipment === shipment.import_shipment_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">{shipment.shipment_number}</div>
                        <div className="text-sm text-gray-600 mt-1">{shipment.client_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {shipment.port_of_loading} → {shipment.port_of_discharge}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <StageIcon className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-blue-600 font-medium">
                            {stages.find(s => s.stage_name === shipment.current_stage)?.display_name}
                          </span>
                        </div>
                      </div>
                      {shipment.is_completed && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedShipmentData ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedShipmentData.shipment_number}</h3>
                  <p className="text-gray-600 mt-1">{selectedShipmentData.client_name}</p>
                </div>
                <button
                  onClick={() => setShowStageUpdate(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Update Stage
                </button>
              </div>

              <div className="border-b mb-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-4 py-2 font-medium border-b-2 ${
                      activeTab === 'timeline'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-4 py-2 font-medium border-b-2 ${
                      activeTab === 'documents'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-2 font-medium border-b-2 ${
                      activeTab === 'tasks'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    Tasks
                  </button>
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 font-medium border-b-2 ${
                      activeTab === 'details'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    Details
                  </button>
                </div>
              </div>

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  {stageHistory.map((stage, index) => {
                    const StageIcon = getStageIcon(stage.stage_name);
                    const isCompleted = stage.completed_at !== null;
                    const isLast = index === stageHistory.length - 1;

                    return (
                      <div key={stage.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                              isCompleted
                                ? 'bg-green-50 border-green-300'
                                : 'bg-blue-50 border-blue-300'
                            }`}
                          >
                            <StageIcon
                              className={`w-6 h-6 ${isCompleted ? 'text-green-600' : 'text-blue-600'}`}
                            />
                          </div>
                          {!isLast && (
                            <div
                              className={`w-0.5 h-16 ${
                                isCompleted ? 'bg-green-300' : 'bg-gray-300'
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-gray-900">{stage.display_name}</div>
                            {isCompleted && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Entered: {formatDate(stage.entered_at)}
                          </div>
                          {isCompleted && (
                            <>
                              <div className="text-sm text-gray-600">
                                Completed: {formatDate(stage.completed_at)}
                              </div>
                              {stage.duration_hours && (
                                <div className="text-sm text-gray-600">
                                  Duration: {stage.duration_hours.toFixed(1)} hours
                                </div>
                              )}
                            </>
                          )}
                          {stage.notes && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                              {stage.notes}
                            </div>
                          )}
                          {!isCompleted && (
                            <div className="mt-2 flex items-center gap-2 text-blue-600">
                              <Clock className="w-4 h-4" />
                              <span className="text-sm font-medium">In Progress</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {documents.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No documents required for current stage
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {doc.is_uploaded ? (
                            <CheckSquare className="w-5 h-5 text-green-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">
                              {doc.document_name}
                              {doc.is_mandatory && (
                                <span className="text-red-600 ml-1">*</span>
                              )}
                            </div>
                            {doc.is_uploaded && (
                              <div className="text-sm text-gray-500">
                                Uploaded: {formatDate(doc.uploaded_at)}
                              </div>
                            )}
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Upload
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No tasks assigned</div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-4 border rounded-lg ${
                          task.is_completed ? 'bg-green-50 border-green-200' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleTaskComplete(task.id, task.is_completed)}
                            className="mt-1"
                          >
                            {task.is_completed ? (
                              <CheckSquare className="w-5 h-5 text-green-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div
                              className={`font-medium ${
                                task.is_completed ? 'text-gray-500 line-through' : 'text-gray-900'
                              }`}
                            >
                              {task.task_description}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span
                                className={`px-2 py-1 rounded ${
                                  task.priority === 'high'
                                    ? 'bg-red-100 text-red-700'
                                    : task.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {task.priority}
                              </span>
                              {task.due_date && (
                                <span className="text-gray-600">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-6">
                  {containerTracking && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        Container Tracking
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Container Number</div>
                          <div className="font-medium">{containerTracking.container_number}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Status</div>
                          <div className="font-medium capitalize">{containerTracking.status}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Vessel ETA</div>
                          <div className="font-medium">
                            {containerTracking.vessel_eta
                              ? new Date(containerTracking.vessel_eta).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Free Time Expires</div>
                          <div className="font-medium text-red-600">
                            {containerTracking.free_time_expires
                              ? new Date(containerTracking.free_time_expires).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {customsTracking && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        Customs Clearance
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Entry Number</div>
                          <div className="font-medium">{customsTracking.entry_number || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Status</div>
                          <div className="font-medium capitalize">{customsTracking.clearance_status}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Duty Amount</div>
                          <div className="font-medium">₹{customsTracking.duty_amount.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">IGST</div>
                          <div className="font-medium">₹{customsTracking.igst_amount.toLocaleString()}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-gray-600">Total Customs Cost</div>
                          <div className="font-bold text-lg">
                            ₹{customsTracking.total_customs_cost.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {deliveryInfo && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-600" />
                        Delivery Information
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Delivery Type</div>
                          <div className="font-medium capitalize">
                            {deliveryInfo.delivery_type.replace('_', ' ')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Status</div>
                          <div className="font-medium capitalize">{deliveryInfo.delivery_status}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Contact Person</div>
                          <div className="font-medium">{deliveryInfo.contact_person || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Vehicle Number</div>
                          <div className="font-medium">{deliveryInfo.vehicle_number || 'N/A'}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-gray-600">POD Received</div>
                          <div className="font-medium">
                            {deliveryInfo.pod_received ? (
                              <span className="text-green-600">✓ Yes</span>
                            ) : (
                              <span className="text-red-600">✗ No</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {profitData && (
                    <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        Profit Finalization
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Initial Profit</div>
                          <div className="font-medium">
                            ₹{profitData.initial_profit_inr.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Final Profit</div>
                          <div className="font-bold text-lg text-green-600">
                            ₹{profitData.final_profit_inr.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Variance</div>
                          <div
                            className={`font-medium ${
                              profitData.variance_amount >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            ₹{profitData.variance_amount.toLocaleString()} (
                            {profitData.variance_percent.toFixed(2)}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Invoice Status</div>
                          <div className="font-medium">
                            {profitData.is_invoiced ? (
                              <span className="text-green-600">✓ Invoiced</span>
                            ) : (
                              <span className="text-yellow-600">Pending</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Ship className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 mb-2">No Shipment Selected</h3>
              <p className="text-gray-500">Select a shipment from the list to view workflow details</p>
            </div>
          )}
        </div>
      </div>

      {showStageUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Update Workflow Stage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Stage
                </label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select stage...</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.stage_name}>
                      {stage.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Add any notes about this stage transition..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={updateStage}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Update Stage
                </button>
                <button
                  onClick={() => {
                    setShowStageUpdate(false);
                    setNewStage('');
                    setStageNotes('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
