/**
 * EZA Proxy - Management Page
 * Organization management, API keys, policies, roles, audit search
 */

"use client";

import { useState, useEffect } from "react";
import Tabs, { TabList, Tab, TabPanel } from "../components/Tabs";
import ApiKeyManagement from "./components/ApiKeyManagement";
import PolicyPackEditor from "./components/PolicyPackEditor";
import RolesTeam from "./components/RolesTeam";
import AuditLogSearch from "./components/AuditLogSearch";
import AnalyticsBilling from "./components/AnalyticsBilling";
import AlertsPanel from "./components/AlertsPanel";
import AlertBanner from "../components/AlertBanner";

export default function ProxyManagementPage() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'policies' | 'roles' | 'audit' | 'analytics' | 'alerts'>('api-keys');
  const [orgId, setOrgId] = useState<string | null>(null);

  // Get org_id from user context (in production, from auth)
  useEffect(() => {
    // For now, use demo org
    setOrgId("demo-media-group");
  }, []);

  // Wrapper function to handle tab changes from Tabs component
  const handleTabChange = (tab: string) => {
    if (tab === 'api-keys' || tab === 'policies' || tab === 'roles' || tab === 'audit' || tab === 'analytics' || tab === 'alerts') {
      setActiveTab(tab);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#000000',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Alert Banner */}
        <AlertBanner orgId={orgId} userRole="admin" />
        
        {/* Header */}
        <div className="border-b pb-6" style={{ borderColor: '#1C1C1E' }}>
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              color: '#E5E5EA',
              fontWeight: 700,
            }}
          >
            EZA Proxy Yönetim
          </h1>
          <p className="text-sm" style={{ color: '#8E8E93' }}>
            Organizasyon, API anahtarları, politikalar ve denetim
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultTab={activeTab} onTabChange={handleTabChange}>
          <TabList activeTab={activeTab} setActiveTab={handleTabChange}>
            <Tab id="api-keys" activeTab={activeTab} setActiveTab={handleTabChange}>
              🔑 API Anahtarları
            </Tab>
            <Tab id="policies" activeTab={activeTab} setActiveTab={handleTabChange}>
              🛡️ Politika Paketleri
            </Tab>
            <Tab id="roles" activeTab={activeTab} setActiveTab={handleTabChange}>
              👥 Roller & Ekip
            </Tab>
            <Tab id="audit" activeTab={activeTab} setActiveTab={handleTabChange}>
              📋 Denetim Logları
            </Tab>
            <Tab id="analytics" activeTab={activeTab} setActiveTab={handleTabChange}>
              📊 Analytics & Billing
            </Tab>
            <Tab id="alerts" activeTab={activeTab} setActiveTab={handleTabChange}>
              🔔 Alerting & Webhooks
            </Tab>
          </TabList>

          {/* API Keys Tab */}
          <TabPanel id="api-keys" activeTab={activeTab}>
            <div className="mt-6">
              <ApiKeyManagement orgId={orgId} />
            </div>
          </TabPanel>

          {/* Policies Tab */}
          <TabPanel id="policies" activeTab={activeTab}>
            <div className="mt-6">
              <PolicyPackEditor orgId={orgId} />
            </div>
          </TabPanel>

          {/* Roles Tab */}
          <TabPanel id="roles" activeTab={activeTab}>
            <div className="mt-6">
              <RolesTeam orgId={orgId} />
            </div>
          </TabPanel>

          {/* Audit Tab */}
          <TabPanel id="audit" activeTab={activeTab}>
            <div className="mt-6">
              <AuditLogSearch orgId={orgId} />
            </div>
          </TabPanel>

          {/* Analytics & Billing Tab */}
          <TabPanel id="analytics" activeTab={activeTab}>
            <div className="mt-6">
              <AnalyticsBilling orgId={orgId} userRole="admin" />
            </div>
          </TabPanel>

          {/* Alerts Tab */}
          <TabPanel id="alerts" activeTab={activeTab}>
            <div className="mt-6">
              <AlertsPanel orgId={orgId} userRole="admin" />
            </div>
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}

