/**
 * Alert Banner Component
 * Shows critical/warning alerts at the top of pages
 */

"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/apiUrl";
const API_BASE_URL = getApiUrl();

interface AlertBannerProps {
  orgId: string | null;
  userRole?: string;
}

interface AlertEvent {
  id: string;
  type: string;
  severity: string;
  message: string;
  created_at: string;
}

export default function AlertBanner({ orgId, userRole }: AlertBannerProps) {
  const [recentAlerts, setRecentAlerts] = useState<AlertEvent[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Only show for admin and ops
    if (!orgId || !userRole || !['admin', 'ops'].includes(userRole)) {
      return;
    }

    const loadRecentAlerts = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiKey = localStorage.getItem('proxy_api_key');
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
        };

        const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/recent?limit=10`, { headers });
        const data = await res.json();
        
        if (data.ok) {
          const alerts = data.alerts || [];
          
          // Filter alerts from last 5-10 minutes
          const now = new Date();
          const recent = alerts.filter((alert: AlertEvent) => {
            const alertTime = new Date(alert.created_at);
            const diffMinutes = (now.getTime() - alertTime.getTime()) / (1000 * 60);
            return diffMinutes <= 10;
          });
          
          setRecentAlerts(recent);
          setShowBanner(recent.length > 0);
        }
      } catch (err) {
        console.error('[AlertBanner] Load error:', err);
      }
    };

    loadRecentAlerts();
    const interval = setInterval(loadRecentAlerts, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [orgId, userRole]);

  if (!showBanner || recentAlerts.length === 0) {
    return null;
  }

  // Find highest severity alert
  const criticalAlert = recentAlerts.find(a => a.severity === 'critical');
  const warningAlert = recentAlerts.find(a => a.severity === 'warning');
  const displayAlert = criticalAlert || warningAlert;

  if (!displayAlert) {
    return null;
  }

  const isCritical = displayAlert.severity === 'critical';
  const bgColor = isCritical ? '#E84343' : '#FFB800';
  const textColor = '#FFFFFF';

  return (
    <div
      className="w-full p-4 animate-pulse"
      style={{
        backgroundColor: `${bgColor}20`,
        borderBottom: `2px solid ${bgColor}`,
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="text-2xl">{isCritical ? '🔴' : '⚠️'}</span>
        <div className="flex-1">
          <p className="font-bold" style={{ color: textColor }}>
            EZA ALERT — Son 10 dakika içinde {isCritical ? 'kritik' : 'uyarı'} seviyesinde alert tespit edildi.
          </p>
          <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.9 }}>
            {displayAlert.message} • Detaylar için Alert Panelini inceleyin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          className="px-3 py-1 rounded text-sm font-medium"
          style={{
            backgroundColor: bgColor,
            color: textColor,
          }}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

