/**
 * Alert Banner Component
 * Shows critical/warning alerts at the top of pages
 */

"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import { isTokenExpired } from "@/lib/jwtUtils";
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

    // Validate orgId: must be a valid UUID format (not legacy string IDs like "demo-media-group")
    // UUID format: 8-4-4-4-12 hexadecimal characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      console.warn('[AlertBanner] Invalid orgId format (not a UUID):', orgId);
      // Clear any legacy localStorage keys if invalid orgId detected
      if (typeof window !== 'undefined') {
        localStorage.removeItem('org_id');
        localStorage.removeItem('user_role');
      }
      return;
    }

    const loadRecentAlerts = async () => {
      try {
        const token = localStorage.getItem('eza_token');
        
        // Check token expiry before making request
        if (!token) {
          // No token - dispatch auth-expired event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth-expired'));
          }
          return;
        }
        
        const tokenExpired = isTokenExpired(token);
        if (tokenExpired === true) {
          // Token expired - dispatch auth-expired event and stop polling
          console.warn('[AlertBanner] Token expired, stopping polling');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth-expired'));
          }
          return;
        }
        
        // If tokenExpired === null, we cannot determine, but continue anyway (backend will validate)
        
        const apiKey = localStorage.getItem('proxy_api_key');
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
        };

        const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/recent?limit=10`, { headers });
        
        // Handle token expiration
        if (res.status === 401 || res.status === 403) {
          // Dispatch auth-expired event to trigger logout
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('auth-expired'));
          }
          return;
        }
        
        if (res.ok) {
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
        }
      } catch (err) {
        console.error('[AlertBanner] Load error:', err);
      }
    };

    loadRecentAlerts();
    
    // Set up interval with token expiry check
    let intervalId: NodeJS.Timeout | null = null;
    
    intervalId = setInterval(() => {
      // Check token before each poll
      const token = localStorage.getItem('eza_token');
      if (!token) {
        // No token - stop polling
        console.warn('[AlertBanner] No token found, stopping polling');
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-expired'));
        }
        return;
      }
      
      const tokenExpired = isTokenExpired(token);
      if (tokenExpired === true) {
        // Token expired - stop polling
        console.warn('[AlertBanner] Token expired, stopping polling');
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-expired'));
        }
        return;
      }
      
      // If tokenExpired === null, we cannot determine, but continue anyway (backend will validate)
      loadRecentAlerts();
    }, 30000); // Refresh every 30 seconds

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
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

