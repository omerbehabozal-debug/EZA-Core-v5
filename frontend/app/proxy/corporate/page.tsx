/**
 * Corporate Portal Page - Multi-Tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import AiAuditList from './components/AiAuditList';
import PolicyConfig from './components/PolicyConfig';
import WorkflowBuilder from './components/WorkflowBuilder';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchCorporateAudit, fetchCorporatePolicy, updateCorporatePolicy } from '@/api/corporate';
import { MOCK_CORPORATE_AUDIT, MOCK_CORPORATE_POLICY } from '@/mock/corporate';
import type { PolicyConfig as PolicyConfigType, CorporateAudit } from '@/lib/types';
import { uploadMultimodalFile, MultimodalAnalysisResult } from '@/api/multimodal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function getStatusType(isLoading: boolean, error: any, data: any, fallback: any): StatusType {
  if (isLoading) return 'loading';
  if (error || !data || data === fallback) return 'preview';
  return 'live';
}

export default function CorporatePage() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();

  useEffect(() => {
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  const { data: auditItems, error: auditError, isLoading: auditLoading } = useSWR(
    ['corporate-audit', tenant.id],
    () => fetchCorporateAudit(100, 0),
    {
      fallbackData: MOCK_CORPORATE_AUDIT,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for corporate audit');
      },
    }
  );

  const { data: policyConfig, error: policyError, isLoading: policyLoading, mutate: mutatePolicy } = useSWR(
    ['corporate-policy', tenant.id],
    () => fetchCorporatePolicy(tenant.id),
    {
      fallbackData: MOCK_CORPORATE_POLICY,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for corporate policy');
      },
    }
  );

  const auditStatus = getStatusType(auditLoading, auditError, auditItems, MOCK_CORPORATE_AUDIT);
  const policyStatus = getStatusType(policyLoading, policyError, policyConfig, MOCK_CORPORATE_POLICY);

  // Multimodal state
  const [videoResult, setVideoResult] = useState<MultimodalAnalysisResult | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const handleSavePolicy = async (config: PolicyConfigType) => {
    try {
      await updateCorporatePolicy(tenant.id, config);
      mutatePolicy(config, false);
    } catch (error) {
      console.info('[Preview Mode] Policy save failed, using local state');
      mutatePolicy(config, false);
    }
  };

  const handleVideoUpload = async (file: File | null) => {
    if (!file) return;
    setVideoError(null);
    setVideoLoading(true);
    try {
      const result = await uploadMultimodalFile('video', file);
      setVideoResult(result);
    } catch (e: any) {
      setVideoError(e?.message || 'Video analysis failed');
      if (e?.message?.includes('503') || e?.message?.includes('disabled')) {
        setVideoError('Multimodal analysis is currently disabled in this environment.');
      }
    } finally {
      setVideoLoading(false);
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Kurumsal AI Uyum Paneli
            </h1>
            <p className="text-gray-600">
              {tenant.description}
            </p>
          </div>
          <StatusBadge status={auditStatus} />
        </div>

        <div>
          <div className="flex justify-end mb-2">
            <StatusBadge status={auditStatus} />
          </div>
          <AiAuditList items={auditItems || MOCK_CORPORATE_AUDIT} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-end mb-2">
              <StatusBadge status={policyStatus} />
            </div>
            <PolicyConfig 
              config={policyConfig || MOCK_CORPORATE_POLICY} 
              onSave={handleSavePolicy} 
            />
          </div>
          <WorkflowBuilder />
        </div>

        {/* Video Safety Check (Beta) */}
        <Card>
          <CardHeader>
            <CardTitle>Video Safety Check (Beta)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoUpload(file);
                }}
                disabled={videoLoading}
              />
              <Button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'video/*';
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  };
                  input.click();
                }}
                disabled={videoLoading}
                className="w-full"
              >
                {videoLoading ? 'Analyzing...' : 'Upload Video'}
              </Button>
            </div>

            {videoError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{videoError}</p>
              </div>
            )}

            {videoResult && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">Risk Level:</span>
                  <Badge variant={getRiskBadgeVariant(videoResult.global_risk_level)}>
                    {videoResult.global_risk_level.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-semibold">
                    {videoResult.eza_multimodal_score.overall_score.toFixed(1)}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Summary:</h4>
                  <p className="text-sm text-gray-700">
                    {videoResult.recommended_actions.length > 0
                      ? videoResult.recommended_actions.slice(0, 2).join('. ')
                      : 'Analysis completed successfully.'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
