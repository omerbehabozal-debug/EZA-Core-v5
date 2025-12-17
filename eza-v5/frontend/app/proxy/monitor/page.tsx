/**
 * EZA Proxy - Real-time Telemetry & SLA Monitoring
 * Corporate SLA Monitor and Regulator Telemetry
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { getApiUrl, getWebSocketUrl } from "@/lib/apiUrl";
import Tabs, { TabList, Tab, TabPanel } from "../components/Tabs";
import CorporateSLAMonitor from "./components/CorporateSLAMonitor";
import RegulatorTelemetry from "./components/RegulatorTelemetry";
import AlertBanner from "../components/AlertBanner";

const API_BASE_URL = getApiUrl();
const WS_BASE_URL = getWebSocketUrl();

export default function MonitorPage() {
  const [activeTab, setActiveTab] = useState<'corporate' | 'regulator'>('corporate');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    // Get org_id and role from localStorage or context
    const storedOrgId = localStorage.getItem('org_id') || 'demo-media-group';
    const storedRole = localStorage.getItem('user_role') || 'admin';
    
    setOrgId(storedOrgId);
    setUserRole(storedRole);
    
    // Check regulator access
    if (activeTab === 'regulator' && storedRole !== 'regulator') {
      setAccessDenied(true);
    } else {
      setAccessDenied(false);
    }
  }, [activeTab]);

  // Wrapper function to handle tab changes from Tabs component
  const handleTabChange = (tab: string) => {
    if (tab === 'corporate' || tab === 'regulator') {
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
        <AlertBanner orgId={orgId} userRole={userRole} />
        
        {/* Header */}
        <div className="border-b pb-6" style={{ borderColor: '#1C1C1E' }}>
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              color: '#E5E5EA',
              fontWeight: 700,
            }}
          >
            Telemetri & SLA İzleme
          </h1>
          <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>
            Gerçek zamanlı risk, performans ve güvenlik telemetrisi
          </p>
          <p className="text-xs" style={{ color: '#8E8E93', maxWidth: '600px', lineHeight: '1.5' }}>
            Bu ekran, EZA sisteminin teknik sağlık durumunu ve sürekliliğini izlemek için kullanılır. Performans, gecikme ve otomatik koruma mekanizmaları buradan takip edilir.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultTab={activeTab} onTabChange={handleTabChange}>
          <TabList activeTab={activeTab} setActiveTab={handleTabChange}>
            <Tab id="corporate" activeTab={activeTab} setActiveTab={handleTabChange}>
              📊 Corporate SLA Monitor
            </Tab>
            <Tab id="regulator" activeTab={activeTab} setActiveTab={handleTabChange}>
              🔒 Regulator Telemetry
            </Tab>
          </TabList>

          {/* Corporate SLA Monitor Tab */}
          <TabPanel id="corporate" activeTab={activeTab}>
            <div className="mt-6">
              <CorporateSLAMonitor orgId={orgId} userRole={userRole} />
            </div>
          </TabPanel>

          {/* Regulator Telemetry Tab */}
          <TabPanel id="regulator" activeTab={activeTab}>
            <div className="mt-6">
              {accessDenied ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div
                    className="rounded-xl p-8 max-w-md text-center"
                    style={{
                      backgroundColor: '#1C1C1E',
                      border: '1px solid #2C2C2E',
                    }}
                  >
                    <div className="text-4xl mb-4">🔒</div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: '#E5E5EA' }}>
                      Erişim Reddedildi
                    </h3>
                    <p className="text-sm" style={{ color: '#8E8E93' }}>
                      Bu alan sadece regülasyon yetkilileri içindir.
                    </p>
                  </div>
                </div>
              ) : (
                <RegulatorTelemetry orgId={orgId} userRole={userRole} />
              )}
            </div>
          </TabPanel>
        </Tabs>
      </div>
    </div>
  );
}

