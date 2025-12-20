/**
 * Proxy Organization Selection Page
 * Determines organization context for Proxy UI
 * 
 * Rules:
 * - 1 org with proxy_access: auto-select, redirect to dashboard
 * - >1 org with proxy_access: show selection screen
 * - 0 org with proxy_access: show error, block access
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import RequireAuth from '@/components/auth/RequireAuth';

const API_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'https://eza-core-v5-production.up.railway.app';

interface ProxyOrganization {
  id: string;
  name: string;
  plan: string;
  status: string;
  proxy_access: boolean;
}

function ProxyOrganizationSelectionContent() {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const { setCurrentOrganization } = useOrganization();
  const [organizations, setOrganizations] = useState<ProxyOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load organizations with proxy_access=true
  useEffect(() => {
    const loadProxyOrganizations = async () => {
      if (!token) {
        router.push('/proxy/login');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/platform/proxy/organizations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.push('/proxy/login');
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.ok) {
          throw new Error(data.detail || 'Failed to load organizations');
        }

        const orgs = (data.organizations || []).filter((org: ProxyOrganization) => 
          org.proxy_access === true && org.status === 'active'
        );

        setOrganizations(orgs);

        // Organization Resolution Logic
        if (orgs.length === 0) {
          // Case C: Zero organizations - block access
          setError('Proxy erişimi için organizasyon bulunamadı. Lütfen yöneticinize başvurun.');
        } else if (orgs.length === 1) {
          // Case A: Exactly one organization - auto-select and redirect
          const org = orgs[0];
          setCurrentOrganization(org);
          // Store in localStorage for persistence
          localStorage.setItem('eza_current_org', JSON.stringify(org));
          // Redirect to Proxy dashboard
          router.push('/proxy');
        } else {
          // Case B: More than one organization - show selection screen
          // (already handled by rendering selection UI below)
        }
      } catch (err: any) {
        console.error('Failed to load organizations:', err);
        setError(err.message || 'Organizasyonlar yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && token) {
      loadProxyOrganizations();
    }
  }, [token, isAuthenticated, router, setCurrentOrganization]);

  const handleSelectOrganization = async () => {
    if (!selectedOrgId) {
      setError('Lütfen bir organizasyon seçin');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const org = organizations.find(o => o.id === selectedOrgId);
      if (!org) {
        throw new Error('Selected organization not found');
      }

      // Set organization context
      setCurrentOrganization(org);
      // Store in localStorage for persistence
      localStorage.setItem('eza_current_org', JSON.stringify(org));

      // Redirect to Proxy dashboard
      router.push('/proxy');
    } catch (err: any) {
      console.error('Failed to select organization:', err);
      setError(err.message || 'Organizasyon seçilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ 
          background: 'linear-gradient(135deg, #0F1115 0%, #151A21 50%, #0F1115 100%)',
        }}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#2563EB' }}></div>
          <p className="mt-4 text-sm" style={{ color: '#8E8E93' }}>
            Organizasyonlar yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  // Error state (zero organizations)
  if (organizations.length === 0 && error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center px-4"
        style={{ 
          background: 'linear-gradient(135deg, #0F1115 0%, #151A21 50%, #0F1115 100%)',
        }}
      >
        <div 
          className="w-full max-w-md rounded-2xl p-8"
          style={{ 
            backgroundColor: '#1C222B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#EF4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#E6EAF0' }}>
              Proxy Erişimi Yok
            </h1>
            <p className="text-sm mb-6" style={{ color: '#8E8E93' }}>
              {error}
            </p>
            <button
              onClick={() => router.push('/proxy/login')}
              className="px-6 py-3 rounded-xl font-medium transition-all"
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1D4ED8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563EB';
              }}
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Selection screen (multiple organizations)
  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ 
        background: 'linear-gradient(135deg, #0F1115 0%, #151A21 50%, #0F1115 100%)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: '#2563EB' }}>
            <span className="text-2xl font-bold text-white">EZA</span>
          </div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: '#E6EAF0' }}>
            Organizasyon Seçin
          </h1>
          <p className="text-sm" style={{ color: '#8E8E93' }}>
            Devam etmek için bir organizasyon seçin
          </p>
        </div>

        {/* Selection Card */}
        <div 
          className="rounded-2xl p-8 shadow-2xl"
          style={{ 
            backgroundColor: '#1C222B',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Organization List */}
          <div className="space-y-3 mb-6">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => setSelectedOrgId(org.id)}
                className="w-full text-left p-4 rounded-xl transition-all"
                style={{
                  backgroundColor: selectedOrgId === org.id ? 'rgba(37, 99, 235, 0.1)' : '#151A21',
                  border: selectedOrgId === org.id ? '2px solid #2563EB' : '1px solid rgba(255, 255, 255, 0.1)',
                }}
                onMouseEnter={(e) => {
                  if (selectedOrgId !== org.id) {
                    e.currentTarget.style.backgroundColor = '#1A1F2E';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedOrgId !== org.id) {
                    e.currentTarget.style.backgroundColor = '#151A21';
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium mb-1" style={{ color: '#E6EAF0' }}>
                      {org.name}
                    </div>
                    <div className="text-xs" style={{ color: '#8E8E93' }}>
                      Plan: {org.plan}
                    </div>
                  </div>
                  {selectedOrgId === org.id && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div 
              className="p-4 rounded-xl text-sm mb-6"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '3px solid #EF4444',
                color: '#FCA5A5',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSelectOrganization}
            disabled={!selectedOrgId || submitting}
            className="w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: (!selectedOrgId || submitting) ? '#1E3A8A' : '#2563EB',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              if (selectedOrgId && !submitting) {
                e.currentTarget.style.backgroundColor = '#1D4ED8';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedOrgId && !submitting) {
                e.currentTarget.style.backgroundColor = '#2563EB';
              }
            }}
          >
            {submitting ? 'Yönlendiriliyor...' : 'Devam Et'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProxyOrganizationSelectionPage() {
  return (
    <RequireAuth allowedRoles={['admin', 'org_admin', 'proxy_user', 'reviewer', 'auditor', 'ops']}>
      <ProxyOrganizationSelectionContent />
    </RequireAuth>
  );
}

