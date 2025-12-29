/**
 * Analysis Mode Selector Component
 * Admin UI for selecting FAST vs PRO analysis mode
 */

"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/config";

interface AnalysisModeSelectorProps {
  orgId: string | null;
}

export default function AnalysisModeSelector({ orgId }: AnalysisModeSelectorProps) {
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'pro'>('fast');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      loadAnalysisMode();
    }
  }, [orgId]);

  const loadAnalysisMode = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      
      // Get organization's analysis_mode from organization endpoint
      const res = await fetch(`${API_BASE_URL}/api/platform/organizations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-org-id': orgId,
        },
      });

      if (res.ok) {
        const data = await res.json();
        // Find current organization in list
        if (data.ok && Array.isArray(data.organizations)) {
          const org = data.organizations.find((o: any) => o.id === orgId);
          if (org && org.analysis_mode) {
            setAnalysisMode(org.analysis_mode);
            return;
          }
        }
      }
      
      // Default to 'fast' if not found
      setAnalysisMode('fast');
    } catch (err: any) {
      console.error('[AnalysisMode] Load error:', err);
      // Default to 'fast' on error
      setAnalysisMode('fast');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (mode: 'fast' | 'pro') => {
    if (!orgId || saving) return;

    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('eza_token');
      
      // Update organization's analysis_mode
      // Note: This requires a backend endpoint to update organization settings
      // For now, we'll use a PATCH to /api/platform/organizations/{orgId} if it exists
      // Otherwise, we'll need to create this endpoint
      const res = await fetch(`${API_BASE_URL}/api/platform/organizations/${orgId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-org-id': orgId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ analysis_mode: mode }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}`;
        setError(`Analiz modu güncellenemedi: ${errorMessage}`);
        return;
      }

      const data = await res.json();
      if (data.ok || res.status === 200 || res.status === 204) {
        setAnalysisMode(mode);
        setError(null);
      } else {
        setError("Analiz modu güncellenemedi");
      }
    } catch (err: any) {
      setError(`Hata: ${err?.message || 'Network error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl p-6 mb-6"
      style={{
        backgroundColor: '#1C1C1E',
        border: '1px solid #2C2C2E',
      }}
    >
      <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
        Analiz Modu
      </h2>

      {loading ? (
        <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-4">
          {/* FAST Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all ${
              analysisMode === 'fast' ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              backgroundColor: analysisMode === 'fast' ? '#007AFF20' : '#000000',
              border: `1px solid ${analysisMode === 'fast' ? '#007AFF' : '#2C2C2E'}`,
            }}
          >
            <input
              type="radio"
              name="analysis_mode"
              value="fast"
              checked={analysisMode === 'fast'}
              onChange={() => handleModeChange('fast')}
              disabled={saving}
              className="mt-1 w-5 h-5"
              style={{ accentColor: '#007AFF' }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold" style={{ color: '#E5E5EA' }}>
                  FAST — Hızlı Analiz
                </h3>
                {analysisMode === 'fast' && (
                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#007AFF20', color: '#007AFF' }}>
                    Varsayılan
                  </span>
                )}
              </div>
              <p className="text-sm mb-3" style={{ color: '#8E8E93' }}>
                Günlük içerik üretimi için optimize edilmiş hızlı analiz modudur.
                Anında risk skoru üretir ve hızlı bir yeniden yazım önerisi sunar.
              </p>
              <ul className="space-y-1 text-xs" style={{ color: '#8E8E93' }}>
                <li>⚡ Çok hızlı sonuç</li>
                <li>📝 Günlük içerikler için ideal</li>
                <li>🛡️ Temel etik risk kontrolü</li>
              </ul>
            </div>
          </label>

          {/* PRO Option */}
          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all ${
              analysisMode === 'pro' ? 'ring-2 ring-purple-500' : ''
            }`}
            style={{
              backgroundColor: analysisMode === 'pro' ? '#8B5CF620' : '#000000',
              border: `1px solid ${analysisMode === 'pro' ? '#8B5CF6' : '#2C2C2E'}`,
            }}
          >
            <input
              type="radio"
              name="analysis_mode"
              value="pro"
              checked={analysisMode === 'pro'}
              onChange={() => handleModeChange('pro')}
              disabled={saving}
              className="mt-1 w-5 h-5"
              style={{ accentColor: '#8B5CF6' }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold" style={{ color: '#E5E5EA' }}>
                  PRO — Profesyonel Analiz
                </h3>
              </div>
              <p className="text-sm mb-3" style={{ color: '#8E8E93' }}>
                Derinlemesine bağlam analizi yapan, profesyonel editoryal yeniden yazım sunan gelişmiş analiz modudur.
                Hızdan ödün vererek en yüksek kaliteyi hedefler.
              </p>
              <ul className="space-y-1 text-xs mb-2" style={{ color: '#8E8E93' }}>
                <li>🧠 Paragraf bazlı derin analiz</li>
                <li>📚 Risk gerekçeleri ve bağlam değerlendirmesi</li>
                <li>✍️ İnsan editör seviyesinde yeniden yazım</li>
                <li>⏳ Daha uzun analiz süresi</li>
              </ul>
              <p className="text-xs italic" style={{ color: '#8E8E93' }}>
                Bu mod daha uzun sürede sonuç üretir ancak kritik ve kamusal etkisi yüksek içerikler için önerilir.
              </p>
            </div>
          </label>
        </div>
      )}

      {error && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{
            backgroundColor: '#E8434320',
            border: '1px solid #E84343',
          }}
        >
          <p className="text-sm" style={{ color: '#E84343' }}>{error}</p>
        </div>
      )}

      {saving && (
        <div className="mt-4">
          <p className="text-sm" style={{ color: '#8E8E93' }}>Kaydediliyor...</p>
        </div>
      )}
    </div>
  );
}

