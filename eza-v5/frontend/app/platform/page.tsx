/**
 * EZA Platform - Control Plane
 * Management & Compliance Console
 * For org_admin, ops, finance roles
 */

'use client';

import { useState, useEffect } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
import Tabs, { TabList, Tab, TabPanel } from '../proxy/components/Tabs';
import ApiKeyManagement from '../proxy/management/components/ApiKeyManagement';
import PolicyPackEditor from '../proxy/management/components/PolicyPackEditor';
import RolesTeam from '../proxy/management/components/RolesTeam';
import AuditLogSearch from '../proxy/management/components/AuditLogSearch';
import AnalyticsBilling from '../proxy/management/components/AnalyticsBilling';
import AlertsPanel from '../proxy/management/components/AlertsPanel';
import AlertBanner from '../proxy/components/AlertBanner';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { useAuth } from '@/context/AuthContext';

// Platform roles
const PLATFORM_ROLES = ['admin', 'org_admin', 'ops', 'finance'];

function PlatformPageContent() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'organizations' | 'api' | 'policies' | 'users' | 'billing' | 'sla' | 'audit' | 'reports'>('dashboard');
  const [orgId, setOrgId] = useState<string | null>(null);

  // Check if user has platform access
  const hasPlatformAccess = role && PLATFORM_ROLES.includes(role);

  // Get org_id from user context (in production, from auth)
  useEffect(() => {
    // For now, use demo org
    setOrgId('demo-media-group');
  }, []);

  // Wrapper function to handle tab changes
  const handleTabChange = (tab: string) => {
    const validTabs = ['dashboard', 'organizations', 'api', 'policies', 'users', 'billing', 'sla', 'audit', 'reports'];
    if (validTabs.includes(tab)) {
      setActiveTab(tab as any);
    }
  };

  // Role-based visibility
  const canSeeBilling = role === 'finance' || role === 'admin' || role === 'org_admin';
  const canSeeSLA = role === 'ops' || role === 'admin' || role === 'org_admin';
  const canSeeAudit = role === 'ops' || role === 'admin' || role === 'org_admin' || role === 'auditor';
  const canSeeAll = role === 'admin' || role === 'org_admin';

  if (!hasPlatformAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--platform-bg-primary)' }}>
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--platform-text-primary)' }}>
            Erişim Reddedildi
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--platform-text-secondary)' }}>
            Bu alan yalnızca yöneticiler, operasyon ve finans ekipleri içindir.
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--platform-text-muted)' }}>
            Mevcut rolünüz: {role || 'belirtilmemiş'}
          </p>
          <button
            type="button"
            onClick={() => window.location.href = '/proxy'}
            className="px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{
              backgroundColor: 'var(--platform-action-primary)',
              color: '#FFFFFF',
            }}
          >
            Proxy'ye Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--platform-bg-primary)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Alert Banner */}
        <AlertBanner orgId={orgId} userRole={role || 'admin'} />

        {/* Header */}
        <div className="border-b pb-6" style={{ borderColor: 'var(--platform-border)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-4xl font-bold mb-2"
                style={{
                  color: 'var(--platform-text-primary)',
                  fontWeight: 700,
                }}
              >
                EZA Platform
              </h1>
              <p className="text-sm" style={{ color: 'var(--platform-text-secondary)' }}>
                AI Safety Platform — Management & Compliance Console
              </p>
            </div>
            {/* User Profile Dropdown */}
            <UserProfileDropdown />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultTab={activeTab} onTabChange={handleTabChange}>
          <TabList activeTab={activeTab} setActiveTab={handleTabChange}>
            {canSeeAll && (
              <Tab id="dashboard" activeTab={activeTab} setActiveTab={handleTabChange}>
                📊 Dashboard
              </Tab>
            )}
            {canSeeAll && (
              <Tab id="organizations" activeTab={activeTab} setActiveTab={handleTabChange}>
                🏢 Organizations
              </Tab>
            )}
            {canSeeAll && (
              <Tab id="api" activeTab={activeTab} setActiveTab={handleTabChange}>
                🔑 API & Integrations
              </Tab>
            )}
            {canSeeAll && (
              <Tab id="policies" activeTab={activeTab} setActiveTab={handleTabChange}>
                🛡️ Policies
              </Tab>
            )}
            {canSeeAll && (
              <Tab id="users" activeTab={activeTab} setActiveTab={handleTabChange}>
                👥 Users & Roles
              </Tab>
            )}
            {canSeeBilling && (
              <Tab id="billing" activeTab={activeTab} setActiveTab={handleTabChange}>
                💳 Billing
              </Tab>
            )}
            {canSeeSLA && (
              <Tab id="sla" activeTab={activeTab} setActiveTab={handleTabChange}>
                🔔 SLA & Alerts
              </Tab>
            )}
            {canSeeAudit && (
              <Tab id="audit" activeTab={activeTab} setActiveTab={handleTabChange}>
                📋 Audit Logs
              </Tab>
            )}
            {canSeeAll && (
              <Tab id="reports" activeTab={activeTab} setActiveTab={handleTabChange}>
                📈 Reports
              </Tab>
            )}
          </TabList>

          {/* Dashboard Tab */}
          {canSeeAll && (
            <TabPanel id="dashboard" activeTab={activeTab}>
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className="rounded-xl p-6 transition-colors hover:bg-[var(--platform-surface-hover)]"
                    style={{
                      backgroundColor: 'var(--platform-surface)',
                      border: '1px solid var(--platform-border)',
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                      Toplam Organizasyon
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--platform-text-primary)' }}>
                      1
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-6 transition-colors hover:bg-[var(--platform-surface-hover)]"
                    style={{
                      backgroundColor: 'var(--platform-surface)',
                      border: '1px solid var(--platform-border)',
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                      Aktif API Keys
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--platform-text-primary)' }}>
                      -
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-6 transition-colors hover:bg-[var(--platform-surface-hover)]"
                    style={{
                      backgroundColor: 'var(--platform-surface)',
                      border: '1px solid var(--platform-border)',
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--platform-text-secondary)' }}>
                      SLA Compliance
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--platform-success)' }}>
                      100%
                    </p>
                  </div>
                </div>
              </div>
            </TabPanel>
          )}

          {/* Organizations Tab */}
            {canSeeAll && (
              <TabPanel id="organizations" activeTab={activeTab}>
                <div className="mt-6">
                  <p className="text-sm" style={{ color: 'var(--platform-text-secondary)' }}>
                    Organization management coming soon...
                  </p>
                </div>
              </TabPanel>
            )}

          {/* API & Integrations Tab */}
          {canSeeAll && (
            <TabPanel id="api" activeTab={activeTab}>
              <div className="mt-6">
                <ApiKeyManagement orgId={orgId} />
              </div>
            </TabPanel>
          )}

          {/* Policies Tab */}
          {canSeeAll && (
            <TabPanel id="policies" activeTab={activeTab}>
              <div className="mt-6">
                <PolicyPackEditor orgId={orgId} />
              </div>
            </TabPanel>
          )}

          {/* Users & Roles Tab */}
          {canSeeAll && (
            <TabPanel id="users" activeTab={activeTab}>
              <div className="mt-6">
                <RolesTeam orgId={orgId} />
              </div>
            </TabPanel>
          )}

          {/* Billing Tab */}
          {canSeeBilling && (
            <TabPanel id="billing" activeTab={activeTab}>
              <div className="mt-6">
                <AnalyticsBilling orgId={orgId} userRole={role || 'admin'} />
              </div>
            </TabPanel>
          )}

          {/* SLA & Alerts Tab */}
          {canSeeSLA && (
            <TabPanel id="sla" activeTab={activeTab}>
              <div className="mt-6">
                <AlertsPanel orgId={orgId} userRole={role || 'admin'} />
              </div>
            </TabPanel>
          )}

          {/* Audit Logs Tab */}
          {canSeeAudit && (
            <TabPanel id="audit" activeTab={activeTab}>
              <div className="mt-6">
                <AuditLogSearch orgId={orgId} />
              </div>
            </TabPanel>
          )}

          {/* Reports Tab */}
            {canSeeAll && (
              <TabPanel id="reports" activeTab={activeTab}>
                <div className="mt-6">
                  <p className="text-sm" style={{ color: 'var(--platform-text-secondary)' }}>
                    Reports coming soon...
                  </p>
                </div>
              </TabPanel>
            )}
        </Tabs>
      </div>
    </div>
  );
}

export default function PlatformPage() {
  return (
    <RequireAuth allowedRoles={['admin', 'org_admin', 'ops', 'finance']}>
      <PlatformPageContent />
    </RequireAuth>
  );
}

