/**
 * Policy Pack Editor Component
 * List, toggle, weight control for policies
 */

"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/config";

interface PolicyInfo {
  id: string;
  name: string;
  description: string;
  categories: string[];
  enabled: boolean;
  weight: number;
  is_global: boolean;
  is_custom?: boolean;
}

interface PolicyPackEditorProps {
  orgId: string | null;
}

export default function PolicyPackEditor({ orgId }: PolicyPackEditorProps) {
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [globalPolicies, setGlobalPolicies] = useState<PolicyInfo[]>([]);
  const [customPolicies, setCustomPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      loadPolicies();
    }
  }, [orgId]);

  const loadPolicies = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/policy/org/${orgId}/policy`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        setError(`Politikalar yüklenemedi: ${errorMessage}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setPolicies(data.policies || []);
        setGlobalPolicies(data.global_policies || []);
        setCustomPolicies(data.custom_policies || []);
      } else {
        const errorMessage = data.detail || data.message || 'Bilinmeyen hata';
        setError(`Politikalar yüklenemedi: ${errorMessage}`);
      }
    } catch (err: any) {
      setError(`Politikalar yüklenemedi: ${err?.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePolicy = async (policyId: string, enabled: boolean) => {
    if (!orgId) {
      console.error('[Policy] Cannot toggle policy: orgId is null');
      setError('Organizasyon seçilmedi');
      return;
    }

    console.log('[Policy] Toggle request:', { policyId, enabled, orgId });
    setSaving({ ...saving, [policyId]: true });
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const url = `${API_BASE_URL}/api/policy/org/${orgId}/policy/${policyId}/enable`;
      console.log('[Policy] Request URL:', url);
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      
      console.log('[Policy] Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        setError(`Politika güncellenemedi: ${errorMessage}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        loadPolicies();
        setError(null); // Clear any previous errors
      } else {
        const errorMessage = data.detail || data.message || 'Bilinmeyen hata';
        setError(`Politika güncellenemedi: ${errorMessage}`);
      }
    } catch (err: any) {
      setError(`Politika güncellenemedi: ${err?.message || 'Network error'}`);
    } finally {
      setSaving({ ...saving, [policyId]: false });
    }
  };

  const handleWeightChange = async (policyId: string, weight: number) => {
    if (!orgId) return;

    setSaving({ ...saving, [policyId]: true });
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/policy/org/${orgId}/policy/${policyId}/weight`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weight }),
      });

      const data = await res.json();
      if (data.ok) {
        loadPolicies();
      } else {
        setError("Politika ağırlığı güncellenemedi");
      }
    } catch (err: any) {
      setError(`Hata: ${err?.message}`);
    } finally {
      setSaving({ ...saving, [policyId]: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Policies */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Global Politikalar
        </h2>

        {loading ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2C2C2E',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold" style={{ color: '#E5E5EA' }}>
                        {policy.name}
                      </h3>
                      {policy.is_global && (
                        <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#007AFF20', color: '#007AFF' }}>
                          Global
                        </span>
                      )}
                      {policy.is_custom && (
                        <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#FF950020', color: '#FF9500' }}>
                          Özel
                        </span>
                      )}
                    </div>
                    <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>
                      {policy.description}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {policy.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: '#2C2C2E',
                            color: '#8E8E93',
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      onChange={(e) => handleTogglePolicy(policy.id, e.target.checked)}
                      disabled={saving[policy.id]}
                      className="w-5 h-5"
                      style={{ accentColor: '#007AFF' }}
                    />
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        policy.enabled ? 'bg-[#22BF5520] text-[#22BF55]' : 'bg-[#8E8E9320] text-[#8E8E93]'
                      }`}
                    >
                      {policy.enabled ? 'Aktif' : 'Pasif'}
                    </span>
                  </label>
                </div>

                {/* Weight Slider */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: '#8E8E93' }}>
                      Ağırlık (Şiddet): {policy.weight.toFixed(2)}x
                    </span>
                    <span className="text-xs" style={{ color: '#8E8E93' }}>
                      {policy.weight < 0.5 ? 'Düşük' : policy.weight < 1.0 ? 'Orta' : policy.weight < 1.5 ? 'Yüksek' : 'Çok Yüksek'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={policy.weight}
                    onChange={(e) => handleWeightChange(policy.id, parseFloat(e.target.value))}
                    disabled={saving[policy.id]}
                    className="w-full"
                    style={{ accentColor: '#007AFF' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#E8434320',
            border: '1px solid #E84343',
          }}
        >
          <p className="text-sm" style={{ color: '#E84343' }}>{error}</p>
        </div>
      )}
    </div>
  );
}

