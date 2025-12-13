/**
 * Telemetry Dashboard Component
 * Real-time telemetry data visualization
 */

"use client";

import { useEffect, useState } from "react";
import { ProxyWebSocket } from "@/lib/websocket";
import { API_BASE_URL } from "@/api/config";

interface TelemetryData {
  pipeline_delay_ms: number;
  llm_provider_success_rate: number;
  risk_flag_distribution: Record<string, number>;
  last_policy_triggered: string | null;
  fail_safe_state: boolean;
}

export default function TelemetryDashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    pipeline_delay_ms: 0,
    llm_provider_success_rate: 100,
    risk_flag_distribution: {},
    last_policy_triggered: null,
    fail_safe_state: false,
  });
  const [ws, setWs] = useState<ProxyWebSocket | null>(null);

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/telemetry';
    const websocket = new ProxyWebSocket(wsUrl);
    
    websocket.on('telemetry', (message: any) => {
      if (message.data) {
        setTelemetry(message.data);
      }
    });

    websocket.connect().then(() => {
      setWs(websocket);
    }).catch(console.error);

    return () => {
      websocket.disconnect();
    };
  }, []);

  const getSeverityColor = (severity: number) => {
    if (severity >= 0.7) return '#E84343'; // High
    if (severity >= 0.4) return '#FF9500'; // Medium
    return '#22BF55'; // Low
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Delay */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
          Pipeline Gecikmesi
        </h3>
        <div className="flex items-end gap-2 h-32">
          {Array.from({ length: 20 }).map((_, i) => {
            const delay = telemetry.pipeline_delay_ms;
            const height = Math.min((delay / 1000) * 100, 100);
            return (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${height}%`,
                  backgroundColor: delay > 500 ? '#E84343' : delay > 200 ? '#FF9500' : '#22BF55',
                  minHeight: '4px',
                }}
              />
            );
          })}
        </div>
        <p className="text-sm mt-2" style={{ color: '#8E8E93' }}>
          {telemetry.pipeline_delay_ms}ms
        </p>
      </div>

      {/* Success Rate */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
          LLM Sağlayıcı Başarı Oranı
        </h3>
        <div className="relative w-32 h-32 mx-auto">
          <svg className="transform -rotate-90" width="128" height="128">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="#2C2C2E"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke={telemetry.llm_provider_success_rate >= 95 ? '#22BF55' : telemetry.llm_provider_success_rate >= 80 ? '#FF9500' : '#E84343'}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(telemetry.llm_provider_success_rate / 100) * 351.86} 351.86`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: '#E5E5EA' }}>
              {telemetry.llm_provider_success_rate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Risk Flag Distribution */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
          Risk Bayrağı Dağılımı
        </h3>
        <div className="space-y-3">
          {Object.entries(telemetry.risk_flag_distribution).map(([flag, severity]) => (
            <div key={flag} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#E5E5EA' }}>{flag}</span>
                <span className="text-sm font-bold" style={{ color: getSeverityColor(severity) }}>
                  {(severity * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#2C2C2E' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${severity * 100}%`,
                    backgroundColor: getSeverityColor(severity),
                  }}
                />
              </div>
            </div>
          ))}
          {Object.keys(telemetry.risk_flag_distribution).length === 0 && (
            <p className="text-sm text-center" style={{ color: '#8E8E93' }}>
              Henüz risk bayrağı yok
            </p>
          )}
        </div>
      </div>

      {/* Last Policy Triggered */}
      {telemetry.last_policy_triggered && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#2C2C2E',
            border: '1px solid #3A3A3C',
          }}
        >
          <p className="text-xs mb-1" style={{ color: '#8E8E93' }}>Son Tetiklenen Politika</p>
          <p className="text-sm font-medium" style={{ color: '#E5E5EA' }}>
            {telemetry.last_policy_triggered}
          </p>
        </div>
      )}

      {/* Fail-Safe State */}
      {telemetry.fail_safe_state && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#E8434320',
            border: '1px solid #E84343',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#E84343' }}>
            ⚠️ Fail-Safe Aktif
          </p>
        </div>
      )}
    </div>
  );
}

