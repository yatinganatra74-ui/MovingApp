import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, XCircle, Lock, Unlock, Shield, AlertTriangle } from 'lucide-react';

interface CheckpointValidatorProps {
  entityId: string;
  entityType: 'shipment' | 'container' | 'invoice' | 'delivery';
  onValidationComplete?: (canProceed: boolean, results: any) => void;
  showActions?: boolean;
}

interface ValidationResult {
  can_proceed: boolean;
  blocking_failures: string[];
  warnings: string[];
  exchange_rate?: any;
  storage?: any;
  margin?: any;
  trucking?: any;
}

export default function CheckpointValidator({
  entityId,
  entityType,
  onValidationComplete,
  showActions = true
}: CheckpointValidatorProps) {
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState<string | null>(null);

  useEffect(() => {
    if (entityType === 'shipment') {
      validateShipment();
    }
  }, [entityId, entityType]);

  const validateShipment = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('validate_shipment_checkpoints', {
      p_shipment_id: entityId
    });

    setLoading(false);

    if (!error && data) {
      setValidationResults(data);
      if (onValidationComplete) {
        onValidationComplete(data.can_proceed, data);
      }
    }
  };

  const lockExchangeRate = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('lock_exchange_rate', {
      p_shipment_id: entityId
    });

    setLoading(false);

    if (error) {
      alert('Error locking exchange rate: ' + error.message);
    } else if (data?.success) {
      alert('Exchange rate locked successfully!');
      validateShipment();
    } else {
      alert(data?.message || 'Failed to lock exchange rate');
    }
  };

  const markStorageReviewed = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('mark_storage_reviewed', {
      p_shipment_id: entityId
    });

    setLoading(false);

    if (error) {
      alert('Error marking storage as reviewed: ' + error.message);
    } else if (data?.success) {
      alert('Storage charges marked as reviewed!');
      validateShipment();
    }
  };

  const createOverride = async (checkpointCode: string) => {
    if (!overrideReason.trim()) {
      alert('Please provide a reason for the override');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('create_checkpoint_override', {
      p_entity_id: entityId,
      p_checkpoint_code: checkpointCode,
      p_override_reason: overrideReason,
      p_override_notes: null
    });

    setLoading(false);

    if (error) {
      alert('Error creating override: ' + error.message);
    } else if (data?.success) {
      alert('Override created successfully!');
      setOverrideReason('');
      setShowOverrideForm(null);
      validateShipment();
    }
  };

  if (loading && !validationResults) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Validating checkpoints...</span>
        </div>
      </div>
    );
  }

  if (!validationResults) {
    return null;
  }

  return (
    <div className="space-y-4">
      {validationResults.can_proceed ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-900">All Checkpoints Passed</h4>
              <p className="text-sm text-green-700 mt-1">
                All required validations have been completed. You can proceed with the next steps.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Checkpoint Failures - Cannot Proceed</h4>
              <p className="text-sm text-red-700 mt-1">
                The following checkpoints must be resolved before proceeding:
              </p>
              <ul className="mt-2 space-y-1">
                {validationResults.blocking_failures.map((failure, idx) => (
                  <li key={idx} className="text-sm text-red-700 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{failure}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {validationResults.warnings && validationResults.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-900">Warnings</h4>
              <ul className="mt-2 space-y-1">
                {validationResults.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-700 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        <div className="p-4">
          <h4 className="font-semibold mb-3 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Checkpoint Details
          </h4>
        </div>

        {validationResults.exchange_rate && (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {validationResults.exchange_rate.pass ? (
                  <Lock className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <Unlock className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <h5 className="font-medium">Exchange Rate Lock</h5>
                  <p className={`text-sm mt-1 ${
                    validationResults.exchange_rate.pass ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {validationResults.exchange_rate.message}
                  </p>
                </div>
              </div>
              {!validationResults.exchange_rate.pass && showActions && (
                <button
                  onClick={lockExchangeRate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Lock Rate
                </button>
              )}
            </div>
          </div>
        )}

        {validationResults.storage && (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {validationResults.storage.pass ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <h5 className="font-medium">Storage Review</h5>
                  <p className={`text-sm mt-1 ${
                    validationResults.storage.pass ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {validationResults.storage.message}
                  </p>
                </div>
              </div>
              {!validationResults.storage.pass && validationResults.storage.has_storage && showActions && (
                <button
                  onClick={markStorageReviewed}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
              )}
            </div>
          </div>
        )}

        {validationResults.margin && (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {validationResults.margin.pass ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                )}
                <div>
                  <h5 className="font-medium">Minimum Profit Margin</h5>
                  <p className={`text-sm mt-1 ${
                    validationResults.margin.pass ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {validationResults.margin.message}
                  </p>
                  {validationResults.margin.actual_margin !== undefined && (
                    <div className="mt-2 text-xs text-gray-600">
                      <span>Actual: {validationResults.margin.actual_margin.toFixed(2)}%</span>
                      <span className="mx-2">|</span>
                      <span>Minimum: {validationResults.margin.minimum_margin.toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </div>
              {!validationResults.margin.pass && showActions && (
                <div>
                  {showOverrideForm === 'MINIMUM_MARGIN' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Override reason..."
                        className="px-3 py-2 border rounded text-sm w-64"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => createOverride('MINIMUM_MARGIN')}
                          disabled={loading}
                          className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          Submit Override
                        </button>
                        <button
                          onClick={() => setShowOverrideForm(null)}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowOverrideForm('MINIMUM_MARGIN')}
                      className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
                    >
                      Admin Override
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {validationResults.trucking && (
          <div className="p-4">
            <div className="flex items-start space-x-3">
              {validationResults.trucking.pass ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div>
                <h5 className="font-medium">Trucking Cost (Non-Metro)</h5>
                <p className={`text-sm mt-1 ${
                  validationResults.trucking.pass ? 'text-green-600' : 'text-red-600'
                }`}>
                  {validationResults.trucking.message}
                </p>
                {validationResults.trucking.is_metro !== undefined && (
                  <div className="mt-2 text-xs text-gray-600">
                    {validationResults.trucking.is_metro ? (
                      <span className="text-green-600">Metro city - trucking optional</span>
                    ) : (
                      <span className="text-yellow-600">Non-metro - trucking required</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showActions && (
        <div className="flex justify-end">
          <button
            onClick={validateShipment}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Validating...' : 'Revalidate Checkpoints'}
          </button>
        </div>
      )}
    </div>
  );
}
