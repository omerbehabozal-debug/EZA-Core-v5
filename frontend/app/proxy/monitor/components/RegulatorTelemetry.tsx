/**
 * Regulator Telemetry Component
 * High-risk content monitoring for regulators
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { getWebSocketUrl } from "@/lib/apiUrl";

interface RegulatorTelemetryProps {
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

export default function RegulatorTelemetry({ orgId, userRole }: RegulatorTelemetryProps) {
  const [messages, setMessages] = useState<TelemetryMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (userRole !== 'regulator') return;

    const connectWebSocket = () => {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(`${wsUrl}/ws/regulator?role=regulator`);
      
      ws.onopen = () => {
        console.log('[WS] Connected to regulator channel');
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.id) {
            // Telemetry message (only high-risk)
            const message: TelemetryMessage = data;
            
            // Play alert sound if enabled and high risk
            if (soundEnabled && (message.fail_safe_triggered || message.risk_score >= 70)) {
              playAlertSound();
            }
            
            setMessages((prev) => {
              // Add new message at the beginning (most recent first)
              return [message, ...prev].slice(0, 20); // Keep last 20
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
        
        const delay = 3000;
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
  }, [userRole, soundEnabled]);

  const playAlertSound = () => {
    // Create beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const getFlagIcon = (type: string) => {
    const icons: Record<string, string> = {
      'Violence': '🔪',
      'Hate': '💬',
      'Drug': '💊',
      'Safety': '⚠️',
      'Health': '🏥',
      'Financial': '💰',
    };
    return icons[type] || '🚩';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'High') return '#E84343';
    if (severity === 'Medium') return '#FFB800';
    return '#3B7CFF';
  };

  const handleInvestigation = (message: TelemetryMessage) => {
    // Dummy investigation action
    alert(`Soruşturma başlatıldı: ${message.content_id}\nRisk Skoru: ${message.risk_score}\nFail-Safe: ${message.fail_safe_triggered ? 'Evet' : 'Hayır'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
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
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm" style={{ color: '#8E8E93' }}>
            Sesli Uyarı
          </span>
        </label>
      </div>

      {/* Messages Grid */}
      {messages.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <p className="text-lg" style={{ color: '#8E8E93' }}>
            Yüksek riskli içerik bekleniyor...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {messages.map((message, index) => {
            const isFailSafe = message.fail_safe_triggered;
            const isHighRisk = message.risk_score >= 70;
            
            return (
              <div
                key={message.id}
                className="rounded-xl p-6 transition-all animate-fade-in"
                style={{
                  backgroundColor: '#1C1C1E',
                  border: `2px solid ${isFailSafe ? '#E84343' : isHighRisk ? '#FFB800' : '#2C2C2E'}`,
                  animation: isFailSafe ? 'shake 0.5s infinite' : undefined,
                  boxShadow: isFailSafe ? `0 0 20px ${getSeverityColor('High')}40` : undefined,
                }}
              >
                {/* Risk Score */}
                <div className="mb-4">
                  <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Risk Skoru</p>
                  <p
                    className="text-3xl font-bold"
                    style={{
                      color: message.risk_score >= 70 ? '#E84343' : message.risk_score >= 50 ? '#FFB800' : '#22BF55',
                    }}
                  >
                    {message.risk_score}
                  </p>
                </div>

                {/* Flags */}
                <div className="mb-4">
                  <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>Bayraklar</p>
                  <div className="flex flex-wrap gap-2">
                    {message.flags.map((flag, i) => (
                      <div
                        key={i}
                        className="px-3 py-1 rounded-lg flex items-center gap-2"
                        style={{
                          backgroundColor: `${getSeverityColor(flag.severity)}20`,
                          border: `1px solid ${getSeverityColor(flag.severity)}`,
                        }}
                      >
                        <span>{getFlagIcon(flag.type)}</span>
                        <span className="text-xs font-medium" style={{ color: '#E5E5EA' }}>
                          {flag.type}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: getSeverityColor(flag.severity) }}
                        >
                          {flag.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fail Reason */}
                {message.fail_reason && (
                  <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#E8434320' }}>
                    <p className="text-sm font-bold mb-1" style={{ color: '#E84343' }}>
                      Fail-Safe Tetiklendi
                    </p>
                    <p className="text-xs" style={{ color: '#8E8E93' }}>
                      {message.fail_reason}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="mb-4 space-y-1 text-xs" style={{ color: '#8E8E93' }}>
                  <p>Provider: {message.provider}</p>
                  <p>Latency: {message.latency_ms.toFixed(0)}ms</p>
                  <p>Content ID: {message.content_id.slice(0, 8)}...</p>
                  <p>{new Date(message.timestamp).toLocaleString('tr-TR')}</p>
                </div>

                {/* Investigation Button */}
                <button
                  type="button"
                  onClick={() => handleInvestigation(message)}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                  style={{
                    backgroundColor: '#007AFF',
                    color: '#FFFFFF',
                  }}
                >
                  Soruşturma Başlat
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

