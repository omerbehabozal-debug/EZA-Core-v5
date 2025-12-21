/**
 * Alerts Panel Component
 * Alert rules configuration, webhook setup, and recent alerts
 */

"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import Toast from "../../../proxy-lite/components/Toast";
const API_BASE_URL = getApiUrl();

interface AlertsPanelProps {
  orgId: string | null;
  userRole?: string;
}

interface AlertRule {
  name: string;
  enabled: boolean;
  severity: string;
  send_webhook: boolean;
  description?: string;
}

interface AlertEvent {
  id: string;
  org_id: string;
  type: string;
  severity: string;
  message: string;
  details: any;
  created_at: string;
  webhook_sent: boolean;
  webhook_response?: string;
}

export default function AlertsPanel({ orgId, userRole }: AlertsPanelProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'LATENCY' | 'ERROR_RATE' | 'FAIL_SAFE'>('all');
  const [accessDenied, setAccessDenied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (userRole && !['admin', 'ops'].includes(userRole)) {
      setAccessDenied(true);
      return;
    }
    
    if (orgId) {
      loadData();
    }
  }, [orgId, userRole]);

  const loadData = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token || ''}`,
        'X-Api-Key': apiKey || '',
        'x-org-id': orgId,
      };

      // Load rules
      const rulesRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/rules`, { headers });
      const rulesData = await rulesRes.json();
      if (rulesData.ok) {
        setRules(rulesData.rules || []);
        setWebhookConfigured(rulesData.webhook?.url_configured || false);
      }

      // Load recent alerts
      const alertsRes = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/recent?limit=50`, { headers });
      const alertsData = await alertsRes.json();
      if (alertsData.ok) {
        setRecentAlerts(alertsData.alerts || []);
      }
    } catch (err: any) {
      console.error('[Alerts] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleToggle = async (ruleName: string, field: 'enabled' | 'send_webhook', value: boolean) => {
    if (!orgId) return;

    const updatedRules = rules.map(r => 
      r.name === ruleName ? { ...r, [field]: value } : r
    );
    setRules(updatedRules);

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/rules/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rules: [{ name: ruleName, [field]: value }],
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        // Revert on error
        loadData();
        setToast({
          type: 'error',
          message: 'Kural güncellenemedi',
        });
      }
    } catch (err: any) {
      console.error('[Alerts] Update error:', err);
      loadData();
      setToast({
        type: 'error',
        message: 'Kural güncellenemedi',
      });
    }
  };

  const handleSaveWebhook = async () => {
    if (!orgId || !webhookUrl) return;

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'slack',
          url: webhookUrl,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setWebhookConfigured(true);
        setToast({
          type: 'success',
          message: 'Webhook kaydedildi',
        });
      } else {
        setToast({
          type: 'error',
          message: 'Webhook kaydedilemedi',
        });
      }
    } catch (err: any) {
      console.error('[Alerts] Webhook save error:', err);
      setToast({
        type: 'error',
        message: 'Webhook kaydedilemedi',
      });
    }
  };

  const handleTestWebhook = async () => {
    if (!orgId) return;

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/alerts/webhook/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId,
        },
      });

      const data = await res.json();
      if (data.success) {
        setToast({
          type: 'success',
          message: 'Slack webhook testi başarılı.',
        });
      } else {
        setToast({
          type: 'error',
          message: `Webhook testinde hata oluştu: ${data.error || 'Bilinmeyen hata'}`,
        });
      }
    } catch (err: any) {
      console.error('[Alerts] Webhook test error:', err);
      setToast({
        type: 'error',
        message: 'Webhook testinde hata oluştu',
      });
    }
  };

  // Calculate summary stats
  const activeRulesCount = rules.filter(r => r.enabled).length;
  const totalRulesCount = rules.length;
  const last24HoursAlerts = recentAlerts.filter(a => {
    const alertTime = new Date(a.created_at);
    const now = new Date();
    return (now.getTime() - alertTime.getTime()) < 24 * 60 * 60 * 1000;
  }).length;
  const lastAlert = recentAlerts[0];

  // Filter alerts
  const filteredAlerts = filter === 'all' 
    ? recentAlerts 
    : recentAlerts.filter(a => a.type === filter);

  if (accessDenied) {
    return (
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
            Bu alan yalnızca yöneticiler ve operasyon ekibi içindir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Aktif Kurallar</p>
          <p className="text-2xl font-bold" style={{ color: '#E5E5EA' }}>
            {activeRulesCount} / {totalRulesCount}
          </p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Son 24 Saatte Alert</p>
          <p className="text-2xl font-bold" style={{ color: '#E5E5EA' }}>
            {last24HoursAlerts}
          </p>
        </div>
        
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Son Alert Durumu</p>
          {lastAlert ? (
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: lastAlert.severity === 'critical' ? '#E8434320' : '#FFB80020',
                  color: lastAlert.severity === 'critical' ? '#E84343' : '#FFB800',
                }}
              >
                {lastAlert.type}
              </span>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#8E8E93' }}>Alert yok</p>
          )}
        </div>
      </div>

      {/* Alert Rules Config */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Alert Kuralları
        </h3>
        
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.name}
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: '#2C2C2E' }}
            >
              <div className="flex-1">
                <p className="font-medium mb-1" style={{ color: '#E5E5EA' }}>
                  {rule.name.replace(/_/g, ' ')}
                </p>
                <p className="text-sm" style={{ color: '#8E8E93' }}>
                  {rule.description || 'Alert kuralı'}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => handleRuleToggle(rule.name, 'enabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: '#8E8E93' }}>Enabled</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.send_webhook}
                    onChange={(e) => handleRuleToggle(rule.name, 'send_webhook', e.target.checked)}
                    className="w-4 h-4"
                    disabled={!rule.enabled}
                  />
                  <span className="text-sm" style={{ color: '#8E8E93' }}>Webhook</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slack Webhook Config */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Slack Webhook Ayarı
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8E8E93' }}>
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/XXX/YYY/ZZZ"
              className="w-full px-4 py-2 rounded-lg"
              style={{
                backgroundColor: '#2C2C2E',
                color: '#E5E5EA',
                border: '1px solid #3C3C3E',
              }}
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveWebhook}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: '#007AFF',
                color: '#FFFFFF',
              }}
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={!webhookConfigured && !webhookUrl}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{
                backgroundColor: '#2C2C2E',
                color: '#E5E5EA',
              }}
            >
              Test Gönder
            </button>
          </div>
          
          {webhookConfigured && (
            <p className="text-sm" style={{ color: '#22BF55' }}>
              ✓ Webhook yapılandırıldı
            </p>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
            Son Alertler
          </h3>
          
          <div className="flex gap-2">
            {(['all', 'LATENCY', 'ERROR_RATE', 'FAIL_SAFE'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm ${
                  filter === f ? 'opacity-100' : 'opacity-50'
                }`}
                style={{
                  backgroundColor: filter === f ? '#007AFF' : '#2C2C2E',
                  color: '#FFFFFF',
                }}
              >
                {f === 'all' ? 'Tümü' : f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          {filteredAlerts.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#8E8E93' }}>
              Alert bulunamadı
            </p>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-lg flex items-center justify-between"
                style={{
                  backgroundColor: '#2C2C2E',
                  border: `1px solid ${
                    alert.severity === 'critical' ? '#E84343' : 
                    alert.severity === 'warning' ? '#FFB800' : '#3B7CFF'
                  }`,
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: alert.severity === 'critical' ? '#E8434320' : '#FFB80020',
                        color: alert.severity === 'critical' ? '#E84343' : '#FFB800',
                      }}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
                      {alert.type}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#8E8E93' }}>
                    {alert.message}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                    {new Date(alert.created_at).toLocaleString('tr-TR')}
                    {alert.webhook_sent && (
                      <span className="ml-2" style={{ color: '#22BF55' }}>
                        ✓ Webhook gönderildi
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Premium Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </div>
  );
}

