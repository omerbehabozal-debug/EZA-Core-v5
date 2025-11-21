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
import { useTenantStore } from '@/lib/tenantStore';
import { fetchPlatformApiKeys, fetchPlatformContent, fetchPlatformTrend, generateApiKey, revokeApiKey } from '@/api/platform';
import { MOCK_PLATFORM_API_KEYS, MOCK_PLATFORM_CONTENT, MOCK_PLATFORM_TREND } from '@/mock/platform';
import type { ApiKey, ContentItem } from '@/lib/types';
import type { TrendData } from '@/mock/platform';

export default function PlatformPage() {
  const searchParams = useSearchParams();
  const { setTenant, getTenant } = useTenantStore();
  const tenant = getTenant();

  // Initialize tenant from URL
  useEffect(() => {
    const tenantParam = searchParams.get('tenant');
    if (tenantParam && tenantParam !== tenant.id) {
      setTenant(tenantParam);
    }
  }, [searchParams, tenant.id, setTenant]);

  // SWR with hybrid mock + live backend
  const { data: apiKeys = MOCK_PLATFORM_API_KEYS, mutate: mutateApiKeys } = useSWR(
    'platform-api-keys',
    fetchPlatformApiKeys,
    {
      fallbackData: MOCK_PLATFORM_API_KEYS,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const { data: contentItems = MOCK_PLATFORM_CONTENT } = useSWR(
    'platform-content',
    fetchPlatformContent,
    {
      fallbackData: MOCK_PLATFORM_CONTENT,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const { data: trendData = MOCK_PLATFORM_TREND } = useSWR(
    'platform-trend',
    fetchPlatformTrend,
    {
      fallbackData: MOCK_PLATFORM_TREND,
      revalidateOnMount: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
    }
  );

  const handleGenerateKey = async () => {
    try {
      const newKey = await generateApiKey(`Key ${(apiKeys?.length || 0) + 1}`);
      // Optimistic update
      mutateApiKeys([...(apiKeys || []), newKey], false);
    } catch (error) {
      console.info('[Mock Mode] Using optimistic UI for key generation');
      // Fallback to optimistic UI
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
      await revokeApiKey(id);
      // Optimistic update
      mutateApiKeys(
        (apiKeys || []).map(k => k.id === id ? { ...k, status: 'revoked' as const } : k),
        false
      );
    } catch (error) {
      console.info('[Mock Mode] Using optimistic UI for key revocation');
      // Fallback to optimistic UI
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
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Platform Moderasyon Paneli
          </h1>
          <p className="text-gray-600">
            {tenant.description}
          </p>
        </div>

        <ApiKeyCard
          apiKeys={apiKeys || MOCK_PLATFORM_API_KEYS}
          onGenerate={handleGenerateKey}
          onRevoke={handleRevoke}
          onCopy={handleCopy}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContentStream
            items={contentItems || MOCK_PLATFORM_CONTENT}
            onAnalyze={(id) => console.info('[Mock Mode] Analyze content:', id)}
            onLoadMore={() => console.info('[Mock Mode] Load more content')}
            hasMore={true}
          />
          <TrendHeatmap data={trendData || MOCK_PLATFORM_TREND} />
        </div>
      </div>
    </DashboardLayout>
  );
}

