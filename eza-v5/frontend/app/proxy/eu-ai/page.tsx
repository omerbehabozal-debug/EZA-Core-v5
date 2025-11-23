/**
 * EU AI Act Portal Page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchEUModels, createEUModel, fetchEURiskProfile } from '@/api/eu_ai';
import { MOCK_EU_MODELS, MOCK_EU_RISK_PROFILE } from '@/mock/eu_ai';
import type { EUModel, EURiskProfile } from '@/mock/eu_ai';
import { cn } from '@/lib/utils';

function getStatusType(isLoading: boolean, error: any, data: any, fallback: any): StatusType {
  if (isLoading) return 'loading';
  if (error || !data || data === fallback) return 'preview';
  return 'live';
}

function EUAIPageContent() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();
  
  useEffect(() => {
    if (!searchParams) return;
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newModel, setNewModel] = useState({
    model_name: '',
    version: '',
    provider: '',
  });

  const { data: models, error: modelsError, isLoading: modelsLoading, mutate } = useSWR(
    ['eu-models', tenant.id],
    () => fetchEUModels(),
    {
      fallbackData: MOCK_EU_MODELS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for models');
      },
    }
  );

  const { data: riskProfile, error: riskError, isLoading: riskLoading } = useSWR(
    selectedModelId ? ['eu-risk-profile', selectedModelId] : null,
    () => fetchEURiskProfile(selectedModelId!),
    {
      fallbackData: MOCK_EU_RISK_PROFILE,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for risk profile');
      },
    }
  );

  const modelsStatus = getStatusType(modelsLoading, modelsError, models, MOCK_EU_MODELS);
  const riskStatus = getStatusType(riskLoading, riskError, riskProfile, MOCK_EU_RISK_PROFILE);

  const handleCreateModel = async () => {
    try {
      await createEUModel(newModel.model_name, newModel.version, undefined, newModel.provider);
      setShowCreateForm(false);
      setNewModel({ model_name: '', version: '', provider: '' });
      mutate();
    } catch (error) {
      console.info('[Preview Mode] Model creation failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className={cn('text-3xl font-semibold text-gray-900 mb-2')}>
              {tenant.label}
            </h1>
            <p className="text-gray-600">
              {tenant.description}
            </p>
          </div>
          <StatusBadge status={modelsStatus} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Model Registry</CardTitle>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Yeni Model
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {showCreateForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <input
                    type="text"
                    placeholder="Model Adı"
                    value={newModel.model_name}
                    onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Versiyon"
                    value={newModel.version}
                    onChange={(e) => setNewModel({ ...newModel, version: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Provider"
                    value={newModel.provider}
                    onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateModel}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
              {models && models.length > 0 ? (
                <div className="space-y-2">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedModelId === model.id
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{model.model_name}</div>
                          <div className="text-sm text-gray-600">v{model.version}</div>
                          {model.provider && (
                            <div className="text-xs text-gray-500">{model.provider}</div>
                          )}
                        </div>
                        <span className={cn(
                          'px-2 py-1 rounded text-xs',
                          model.compliance_status === 'approved' ? 'bg-green-100 text-green-800' :
                          model.compliance_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        )}>
                          {model.compliance_status || 'pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  Henüz model kaydı yok.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Risk Profile</CardTitle>
                {selectedModelId && <StatusBadge status={riskStatus} />}
              </div>
            </CardHeader>
            <CardContent>
              {selectedModelId && riskProfile ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Risk Skoru</div>
                    <div className="text-2xl font-bold">
                      {riskProfile.risk_profile?.risk_score 
                        ? (riskProfile.risk_profile.risk_score * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Risk Seviyesi</div>
                    <div className="text-lg font-semibold">
                      {riskProfile.risk_profile?.risk_level || 'N/A'}
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(riskProfile.risk_profile, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  Risk profili görüntülemek için bir model seçin.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function EUAIPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EUAIPageContent />
    </Suspense>
  );
}

