import React from 'react';
import { Ship, Plane } from 'lucide-react';

interface TransportModeSelectorProps {
  value: 'SEA' | 'AIR';
  onChange: (mode: 'SEA' | 'AIR') => void;
  disabled?: boolean;
}

export default function TransportModeSelector({ value, onChange, disabled = false }: TransportModeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Transport Mode</label>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onChange('SEA')}
          disabled={disabled}
          className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            value === 'SEA'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Ship className="w-6 h-6" />
          <div className="text-left">
            <div className="font-semibold">Sea Freight</div>
            <div className="text-xs opacity-75">CBM-based pricing</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange('AIR')}
          disabled={disabled}
          className={`flex items-center justify-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            value === 'AIR'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Plane className="w-6 h-6" />
          <div className="text-left">
            <div className="font-semibold">Air Freight</div>
            <div className="text-xs opacity-75">Weight-based pricing</div>
          </div>
        </button>
      </div>
    </div>
  );
}
