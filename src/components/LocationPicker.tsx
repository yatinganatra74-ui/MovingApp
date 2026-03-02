import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Location {
  id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  iata_code: string | null;
  city: string;
  state: string;
  is_active: boolean;
}

interface LocationPickerProps {
  transportMode: 'SEA' | 'AIR';
  value: string;
  onChange: (locationId: string) => void;
  label: string;
  disabled?: boolean;
}

export default function LocationPicker({
  transportMode,
  value,
  onChange,
  label,
  disabled = false
}: LocationPickerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, [transportMode]);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const locationTypes = transportMode === 'SEA'
        ? ['seaport', 'icd', 'cfs']
        : ['airport'];

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .in('location_type', locationTypes)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedLocations = locations.reduce((acc, location) => {
    const state = location.state || 'Other';
    if (!acc[state]) acc[state] = [];
    acc[state].push(location);
    return acc;
  }, {} as Record<string, Location[]>);

  const getLocationDisplay = (location: Location) => {
    if (transportMode === 'AIR') {
      return `${location.city} - ${location.iata_code || location.location_code}`;
    }
    return `${location.location_name} (${location.location_code})`;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          {label}
        </div>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">
          {loading ? 'Loading locations...' : `Select ${transportMode === 'AIR' ? 'airport' : 'port/ICD'}`}
        </option>
        {Object.entries(groupedLocations).map(([state, locs]) => (
          <optgroup key={state} label={state}>
            {locs.map((location) => (
              <option key={location.id} value={location.id}>
                {getLocationDisplay(location)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
