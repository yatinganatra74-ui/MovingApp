import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Package, AlertCircle, Wrench, Save, Calculator } from 'lucide-react';
import PackingMaterialEstimator from './PackingMaterialEstimator';

interface SurveyFormProps {
  surveyId: string | null;
  onClose: () => void;
}

interface Room {
  id: string;
  room_name: string;
  room_category: string;
  display_order: number;
}

interface SurveyItem {
  id?: string;
  room_id: string;
  custom_room_name?: string;
  item_name: string;
  quantity: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  volume_cbm: number;
  is_fragile: boolean;
  needs_dismantling: boolean;
  special_handling: string;
  notes: string;
}

export default function SurveyForm({ surveyId, onClose }: SurveyFormProps) {
  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [items, setItems] = useState<SurveyItem[]>([]);

  const [newItem, setNewItem] = useState<SurveyItem>({
    room_id: '',
    item_name: '',
    quantity: 1,
    length_cm: 0,
    width_cm: 0,
    height_cm: 0,
    volume_cbm: 0,
    is_fragile: false,
    needs_dismantling: false,
    special_handling: '',
    notes: ''
  });

  const [roomSummary, setRoomSummary] = useState<any[]>([]);
  const [materialSuggestions, setMaterialSuggestions] = useState<any[]>([]);
  const [showMaterials, setShowMaterials] = useState(false);
  const [activeTab, setActiveTab] = useState<'entry' | 'summary' | 'materials'>('entry');

  useEffect(() => {
    loadRooms();
    if (surveyId) {
      loadSurvey();
      loadItems();
    }
  }, [surveyId]);

  useEffect(() => {
    if (newItem.item_name && newItem.volume_cbm > 0) {
      loadMaterialSuggestions();
    } else {
      setMaterialSuggestions([]);
    }
  }, [newItem.item_name, newItem.is_fragile, newItem.needs_dismantling, newItem.volume_cbm]);

  const loadRooms = async () => {
    const { data } = await supabase
      .from('survey_rooms')
      .select('*')
      .eq('active', true)
      .order('display_order');

    if (data) {
      setRooms(data);
      if (data.length > 0 && !selectedRoom) {
        setSelectedRoom(data[0].id);
        setNewItem(prev => ({ ...prev, room_id: data[0].id }));
      }
    }
  };

  const loadSurvey = async () => {
    if (!surveyId) return;

    const { data } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .maybeSingle();

    if (data) {
      setSurvey(data);
    }
  };

  const loadItems = async () => {
    if (!surveyId) return;

    const { data } = await supabase
      .from('survey_items_detailed')
      .select('*, survey_rooms(room_name)')
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: false });

    if (data) {
      setItems(data);
    }

    loadRoomSummary();
  };

  const loadRoomSummary = async () => {
    if (!surveyId) return;

    const { data } = await supabase.rpc('get_survey_room_summary', {
      survey_uuid: surveyId
    });

    if (data) {
      setRoomSummary(data);
    }
  };

  const loadMaterialSuggestions = async () => {
    const { data } = await supabase.rpc('get_material_suggestions', {
      p_item_name: newItem.item_name,
      p_is_fragile: newItem.is_fragile,
      p_needs_dismantling: newItem.needs_dismantling,
      p_volume_cbm: newItem.volume_cbm
    });

    if (data) {
      setMaterialSuggestions(data);
    }
  };

  const calculateVolume = (length: number, width: number, height: number, qty: number): number => {
    return (length * width * height * qty) / 1000000;
  };

  const handleDimensionChange = (field: 'length_cm' | 'width_cm' | 'height_cm' | 'quantity', value: number) => {
    const updated = { ...newItem, [field]: value };
    updated.volume_cbm = calculateVolume(
      updated.length_cm,
      updated.width_cm,
      updated.height_cm,
      updated.quantity
    );
    setNewItem(updated);
  };

  const handleAddItem = async () => {
    if (!surveyId || !newItem.item_name) {
      alert('Please enter item name');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('survey_items_detailed')
        .insert([{
          ...newItem,
          survey_id: surveyId,
          room_id: selectedRoom
        }]);

      if (error) throw error;

      setNewItem({
        room_id: selectedRoom,
        item_name: '',
        quantity: 1,
        length_cm: 0,
        width_cm: 0,
        height_cm: 0,
        volume_cbm: 0,
        is_fragile: false,
        needs_dismantling: false,
        special_handling: '',
        notes: ''
      });

      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return;

    const { error } = await supabase
      .from('survey_items_detailed')
      .delete()
      .eq('id', itemId);

    if (!error) {
      loadItems();
    }
  };

  const handleCompleteSurvey = async () => {
    if (!surveyId) return;

    const { error } = await supabase
      .from('surveys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', surveyId);

    if (!error) {
      alert('Survey completed successfully!');
      onClose();
    }
  };

  const getRoomName = (roomId: string): string => {
    const room = rooms.find(r => r.id === roomId);
    return room?.room_name || 'Unknown Room';
  };

  const roomItems = items.filter(item => item.room_id === selectedRoom);
  const totalVolume = survey?.total_volume_cbm || 0;
  const totalItems = survey?.total_items_count || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Survey Entry</h2>
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {totalItems} items
              </span>
              <span className="flex items-center gap-1">
                <Calculator className="w-4 h-4" />
                {totalVolume.toFixed(2)} CBM
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex gap-2 px-6">
            {[
              { id: 'entry', label: 'Item Entry' },
              { id: 'summary', label: 'Room Summary' },
              { id: 'materials', label: 'Packing Materials' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'entry' && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Select Room
                </h3>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {rooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => {
                        setSelectedRoom(room.id);
                        setNewItem(prev => ({ ...prev, room_id: room.id }));
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedRoom === room.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                      }`}
                    >
                      <div className="font-medium">{room.room_name}</div>
                      <div className="text-sm opacity-75">
                        {items.filter(i => i.room_id === room.id).length} items
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Add Item to {getRoomName(selectedRoom)}
                </h3>

                <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Item Name *</label>
                    <input
                      type="text"
                      value={newItem.item_name}
                      onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                      placeholder="e.g., Sofa, Dining Table, Bed"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => handleDimensionChange('quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Length (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.length_cm}
                        onChange={(e) => handleDimensionChange('length_cm', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Width (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.width_cm}
                        onChange={(e) => handleDimensionChange('width_cm', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.height_cm}
                        onChange={(e) => handleDimensionChange('height_cm', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 mb-1">Calculated Volume</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {newItem.volume_cbm.toFixed(4)} CBM
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={newItem.is_fragile}
                        onChange={(e) => setNewItem({ ...newItem, is_fragile: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium">Fragile</span>
                    </label>

                    <label className="flex items-center gap-2 p-3 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={newItem.needs_dismantling}
                        onChange={(e) => setNewItem({ ...newItem, needs_dismantling: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <Wrench className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-medium">Needs Dismantling</span>
                    </label>
                  </div>

                  {materialSuggestions.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <button
                        onClick={() => setShowMaterials(!showMaterials)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-green-600" />
                          <span className="font-semibold text-green-900">
                            Suggested Packing Materials ({materialSuggestions.length})
                          </span>
                        </div>
                        <span className="text-green-600">{showMaterials ? '▼' : '▶'}</span>
                      </button>

                      {showMaterials && (
                        <div className="mt-3 space-y-2">
                          {materialSuggestions.map((mat: any, idx: number) => (
                            <div key={idx} className="bg-white rounded p-2 text-sm">
                              <span className="font-medium text-slate-900">{mat.material}</span>
                              <span className="text-slate-600 ml-2">
                                {(mat.quantity_per_item * newItem.quantity).toFixed(2)} {mat.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Special Handling</label>
                    <input
                      type="text"
                      value={newItem.special_handling}
                      onChange={(e) => setNewItem({ ...newItem, special_handling: e.target.value })}
                      placeholder="e.g., Handle with care, Keep upright"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                    <textarea
                      rows={2}
                      value={newItem.notes}
                      onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleAddItem}
                    disabled={loading || !newItem.item_name}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-900">Items in this Room ({roomItems.length})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {roomItems.map(item => (
                      <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{item.item_name}</div>
                            <div className="text-sm text-slate-600 mt-1">
                              Qty: {item.quantity} | {item.length_cm} × {item.width_cm} × {item.height_cm} cm | {item.volume_cbm.toFixed(4)} CBM
                            </div>
                            <div className="flex gap-2 mt-2">
                              {item.is_fragile && (
                                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">Fragile</span>
                              )}
                              {item.needs_dismantling && (
                                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">Dismantling</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id!)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {roomItems.length === 0 && (
                      <div className="text-center py-8 text-slate-500">No items added to this room yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-1">Total Volume</div>
                  <div className="text-3xl font-bold text-blue-600">{totalVolume.toFixed(2)} CBM</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-green-900 mb-1">Total Items</div>
                  <div className="text-3xl font-bold text-green-600">{totalItems}</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-slate-900 mb-1">Rooms with Items</div>
                  <div className="text-3xl font-bold text-slate-600">{roomSummary.length}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">Room-by-Room Breakdown</h3>
                <div className="space-y-2">
                  {roomSummary.map((room, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">{room.room_name}</h4>
                        <span className="text-lg font-bold text-blue-600">
                          {parseFloat(room.total_volume).toFixed(2)} CBM
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">Items:</span> {room.total_items}
                        </div>
                        <div>
                          <span className="font-medium">Fragile:</span> {room.fragile_items}
                        </div>
                        <div>
                          <span className="font-medium">Dismantling:</span> {room.dismantling_items}
                        </div>
                      </div>
                    </div>
                  ))}

                  {roomSummary.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No items added yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && surveyId && (
          <div className="p-6">
            <PackingMaterialEstimator surveyId={surveyId} />
          </div>
        )}

        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCompleteSurvey}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Complete Survey
          </button>
        </div>
      </div>
    </div>
  );
}
