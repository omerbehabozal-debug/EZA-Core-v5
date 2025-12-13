/**
 * Corporate SLA Monitor Component
 * Real-time risk score, latency, provider usage, token usage, SLA badges
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { getWebSocketUrl } from "@/lib/apiUrl";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CorporateSLAMonitorProps {
  orgId: string | null;
  userRole?: string;
}

interface TelemetryMessage {
  id: string;
  timestamp: string;
  org_id: string;
  content_id: string;
  risk_score: number;
  flags: Array<{ type: string; severity: string }>;
  latency_ms: number;
  token_usage: { input: number; output: number };
  provider: string;
  fail_safe_triggered: boolean;
  fail_reason?: string;
}

interface SLAMetrics {
  uptime: number;
  avg_latency: number;
  error_rate: number;
  compliance: 'compliant' | 'partial' | 'violation';
  threshold: { uptime: number; latency_ms: number };
}

export default function CorporateSLAMonitor({ orgId, userRole }: CorporateSLAMonitorProps) {
  const [messages, setMessages] = useState<TelemetryMessage[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [failSafeCount, setFailSafeCount] = useState(0);
  const [providerUsage, setProviderUsage] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep last 50 messages for charts
  const MAX_MESSAGES = 50;

  useEffect(() => {
    if (!orgId) return;

    const connectWebSocket = () => {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(`${wsUrl}/ws/corporate?org_id=${orgId}&role=${userRole || 'admin'}`);
      
      ws.onopen = () => {
        console.log('[WS] Connected to corporate channel');
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'sla_metrics') {
            setSlaMetrics(data.data);
          } else if (data.id) {
            // Telemetry message
            const message: TelemetryMessage = data;
            setMessages((prev) => {
              const updated = [...prev, message].slice(-MAX_MESSAGES);
              return updated;
            });

            // Update fail-safe count
            if (message.fail_safe_triggered) {
              setFailSafeCount((prev) => prev + 1);
            }

            // Update provider usage
            setProviderUsage((prev) => {
              const updated = { ...prev };
              updated[message.provider] = (updated[message.provider] || 0) + 1;
              return updated;
            });
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnected(false);
        
        // Reconnect with exponential backoff
        const delay = 3000; // 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [orgId, userRole]);

  // Chart data
  const riskScoreChart = {
    labels: messages.map((m, i) => i),
    datasets: [{
      label: 'Risk Score',
      data: messages.map(m => m.risk_score),
      borderColor: '#E84343',
      backgroundColor: '#E8434320',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }],
  };

  const latencyChart = {
    labels: messages.map((m, i) => i),
    datasets: [{
      label: 'Latency (ms)',
      data: messages.map(m => m.latency_ms),
      borderColor: '#007AFF',
      backgroundColor: '#007AFF20',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    }],
  };

  const providerChart = {
    labels: Object.keys(providerUsage),
    datasets: [{
      data: Object.values(providerUsage),
      backgroundColor: ['#3B7CFF', '#22BF55', '#FF9500', '#E84343'],
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0, // Instant update for real-time
    },
    plugins: {
      legend: {
        labels: { color: '#E5E5EA', font: { size: 12 } },
      },
    },
    scales: {
      x: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } },
      y: { ticks: { color: '#8E8E93' }, grid: { color: '#2C2C2E' } },
    },
  };

  const getSlaBadge = () => {
    if (!slaMetrics) return null;
    
    const { compliance } = slaMetrics;
    if (compliance === 'compliant') {
      return { icon: '✓', text: 'SLA Uyumlu', color: '#22BF55' };
    } else if (compliance === 'partial') {
      return { icon: '⚠', text: 'Kısmi Uyum', color: '#FFB800' };
    } else {
      return { icon: '✖', text: 'SLA İhlali', color: '#E84343' };
    }
  };

  const slaBadge = getSlaBadge();

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          style={{
            animation: connected ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span className="text-sm" style={{ color: '#8E8E93' }}>
          {connected ? 'Bağlı' : 'Bağlantı kesildi'}
        </span>
      </div>

      {/* SLA Badge */}
      {slaBadge && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1C1C1E',
            border: `1px solid ${slaBadge.color}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{slaBadge.icon}</span>
            <div>
              <p className="text-lg font-bold" style={{ color: slaBadge.color }}>
                {slaBadge.text}
              </p>
              {slaMetrics && (
                <p className="text-sm" style={{ color: '#8E8E93' }}>
                  Uptime: {slaMetrics.uptime.toFixed(2)}% | Latency: {slaMetrics.avg_latency.toFixed(0)}ms
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fail-Safe Alert Banner */}
      {failSafeCount > 0 && (
        <div
          className="rounded-xl p-4 animate-pulse"
          style={{
            backgroundColor: '#E8434320',
            border: '2px solid #E84343',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-lg font-bold" style={{ color: '#E84343' }}>
                Fail-Safe Tetiklendi: {failSafeCount} kez
              </p>
              <p className="text-sm" style={{ color: '#8E8E93' }}>
                Yüksek riskli içerik tespit edildi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Score Chart */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Risk Score Trend
          </h3>
          <div style={{ height: '200px' }}>
            {messages.length > 0 ? (
              <Line data={riskScoreChart} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bekleniyor...</p>
              </div>
            )}
          </div>
        </div>

        {/* Latency Chart */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Latency Trend (ms)
          </h3>
          <div style={{ height: '200px' }}>
            {messages.length > 0 ? (
              <Line data={latencyChart} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bekleniyor...</p>
              </div>
            )}
          </div>
        </div>

        {/* Provider Usage */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            LLM Provider Dağılımı (Son 50)
          </h3>
          <div style={{ height: '200px' }}>
            {Object.keys(providerUsage).length > 0 ? (
              <Doughnut
                data={providerChart}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { ...chartOptions.plugins.legend, position: 'bottom' as const },
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm" style={{ color: '#8E8E93' }}>Veri bekleniyor...</p>
              </div>
            )}
          </div>
        </div>

        {/* Token Usage Meters */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Token Kullanımı
          </h3>
          <div className="space-y-4">
            {messages.slice(-5).reverse().map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8E8E93' }}>Input</span>
                  <span style={{ color: '#E5E5EA' }}>{msg.token_usage.input}</span>
                </div>
                <div
                  className="h-2 rounded-full"
                  style={{ backgroundColor: '#2C2C2E' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (msg.token_usage.input / 1000) * 100)}%`,
                      backgroundColor: '#007AFF',
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8E8E93' }}>Output</span>
                  <span style={{ color: '#E5E5EA' }}>{msg.token_usage.output}</span>
                </div>
                <div
                  className="h-2 rounded-full"
                  style={{ backgroundColor: '#2C2C2E' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (msg.token_usage.output / 500) * 100)}%`,
                      backgroundColor: '#22BF55',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

