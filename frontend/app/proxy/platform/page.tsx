/**
 * Platform Portal Page - Multi-Tenant
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ApiKeyCard from './components/ApiKeyCard';
import ContentStream from './components/ContentStream';
import TrendHeatmap from './components/TrendHeatmap';
import StatusBadge, { StatusType } from '@/components/StatusBadge';
import { useTenantStore } from '@/lib/tenantStore';
import { fetchApiKeys, generateApiKey, revokeApiKey, fetchContentStream } from '@/api/platform';
import { MOCK_PLATFORM_API_KEYS, MOCK_PLATFORM_STREAM, MOCK_PLATFORM_TREND } from '@/mock/platform';
import type { ApiKey, ContentItem } from '@/lib/types';
import type { TrendData } from '@/mock/platform';

function getStatusType(isLoading: boolean, error: any, data: any, fallback: any): StatusType {
  if (isLoading) return 'loading';
  if (error || !data || data === fallback) return 'preview';
  return 'live';
}

export default function PlatformPage() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();

  useEffect(() => {
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  const { data: apiKeys, error: apiKeysError, isLoading: apiKeysLoading, mutate: mutateApiKeys } = useSWR(
    ['platform-api-keys', tenant.id],
    () => fetchApiKeys(),
    {
      fallbackData: MOCK_PLATFORM_API_KEYS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for API keys');
      },
    }
  );

  const { data: contentItems, error: contentError, isLoading: contentLoading } = useSWR(
    ['platform-stream', tenant.id],
    () => fetchContentStream(50),
    {
      fallbackData: MOCK_PLATFORM_STREAM,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: () => {
        console.info('[Preview Mode] Backend unavailable for content stream');
      },
    }
  );

  const apiKeysStatus = getStatusType(apiKeysLoading, apiKeysError, apiKeys, MOCK_PLATFORM_API_KEYS);
  const contentStatus = getStatusType(contentLoading, contentError, contentItems, MOCK_PLATFORM_STREAM);

  const handleGenerateKey = async () => {
    try {
      const newKey = await generateApiKey(`Key ${(apiKeys?.length || 0) + 1}`, 1);
      mutateApiKeys([...(apiKeys || []), newKey], false);
    } catch (error) {
      console.info('[Preview Mode] Using optimistic UI for key generation');
      const newKey: ApiKey = {
        id: Date.now().toString(),
        name: `Key ${(apiKeys?.length || 0) + 1}`,
        key: `eza_live_sk_${Math.random().toString(36).substring(7)}`,
        created_at: new Date().toISOString(),
        status: 'active',
      };
      mutateApiKeys([...(apiKeys || []), newKey], false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(parseInt(id));
      mutateApiKeys(
        (apiKeys || []).map(k => k.id === id ? { ...k, status: 'revoked' as const } : k),
        false
      );
    } catch (error) {
      console.info('[Preview Mode] Using optimistic UI for key revocation');
      mutateApiKeys(
        (apiKeys || []).map(k => k.id === id ? { ...k, status: 'revoked' as const } : k),
        false
      );
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Platform Moderasyon Paneli
            </h1>
            <p className="text-gray-600">
              {tenant.description}
            </p>
          </div>
          <StatusBadge status={apiKeysStatus} />
        </div>

        <ApiKeyCard
          apiKeys={apiKeys || MOCK_PLATFORM_API_KEYS}
          onGenerate={handleGenerateKey}
          onRevoke={handleRevoke}
          onCopy={handleCopy}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-end mb-2">
              <StatusBadge status={contentStatus} />
            </div>
            <ContentStream
              items={contentItems || MOCK_PLATFORM_STREAM}
              onAnalyze={(id) => console.info('[Preview Mode] Analyze content:', id)}
              onLoadMore={() => console.info('[Preview Mode] Load more content')}
              hasMore={true}
            />
          </div>
          <TrendHeatmap data={MOCK_PLATFORM_TREND} />
        </div>
      </div>
    </DashboardLayout>
  );
}
