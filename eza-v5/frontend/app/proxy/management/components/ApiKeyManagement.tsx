/**
 * API Key Management Component
 * Create, list, delete API keys with masked display
 */

"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/config";
import Toast from "../../../proxy-lite/components/Toast";

interface ApiKeyInfo {
  key_id: string;
  name: string;
  masked_key: string;
  created_at: string;
  last_used?: string;
}

interface ApiKeyManagementProps {
  orgId: string | null;
}

export default function ApiKeyManagement({ orgId }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (orgId) {
      loadApiKeys();
    }
  }, [orgId]);

  const loadApiKeys = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
        },
      });

      const data = await res.json();
      if (data.ok) {
        setApiKeys(data.api_keys);
      }
    } catch (err: any) {
      setError(`API anahtarları yüklenemedi: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !newKeyName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      if (!orgId) {
        setError('Organizasyon ID bulunamadı');
        setLoading(false);
        return;
      }

      console.log('[ApiKeyManagement] Creating API key:', { orgId, name: newKeyName });
      
      const res = await fetch(`${API_BASE_URL}/api/org/${orgId}/api-key/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
          'x-org-id': orgId, // Required by organization guard middleware
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName }),
      });

      console.log('[ApiKeyManagement] Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Bilinmeyen hata' }));
        const errorMessage = errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
        setError(`API anahtarı oluşturulamadı: ${errorMessage}`);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setNewKeyValue(data.api_key);
        setShowNewKey(true);
        setNewKeyName("");
        loadApiKeys();
      } else {
        const errorMessage = data.detail || data.message || 'Bilinmeyen hata';
        setError(`API anahtarı oluşturulamadı: ${errorMessage}`);
      }
    } catch (err: any) {
      setError(`Hata: ${err?.message || 'Ağ hatası'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Bu API anahtarını silmek istediğinizden emin misiniz?")) return;

    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(`${API_BASE_URL}/api/org/api-key/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
        },
      });

      const data = await res.json();
      if (data.ok) {
        loadApiKeys();
      } else {
        setError("API anahtarı silinemedi");
      }
    } catch (err: any) {
      setError(`Hata: ${err?.message}`);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: "API anahtarı panoya kopyalandı", type: 'success' });
    } catch (err) {
      setToast({ message: "Kopyalama başarısız oldu", type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Key */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Yeni API Anahtarı Oluştur
        </h2>
        
        {showNewKey && newKeyValue && (
          <div
            className="mb-4 p-4 rounded-lg"
            style={{
              backgroundColor: '#22BF5520',
              border: '1px solid #22BF55',
            }}
          >
            <p className="text-sm mb-2" style={{ color: '#22BF55' }}>
              ⚠️ Bu anahtar sadece bir kez gösterilecek. Lütfen kaydedin!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded bg-black text-sm" style={{ color: '#E5E5EA' }}>
                {newKeyValue}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(newKeyValue)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: '#007AFF',
                  color: '#FFFFFF',
                }}
              >
                Kopyala
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewKey(false);
                setNewKeyValue("");
              }}
              className="mt-2 text-sm"
              style={{ color: '#8E8E93' }}
            >
              Kapat
            </button>
          </div>
        )}

        <form onSubmit={handleCreateKey} className="space-y-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="API anahtarı adı..."
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            style={{
              backgroundColor: '#000000',
              border: '1px solid #2C2C2E',
              color: '#E5E5EA',
            }}
          />
          <button
            type="submit"
            disabled={loading || !newKeyName.trim()}
            className="px-6 py-3 rounded-xl font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            {loading ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </form>
      </div>

      {/* API Keys List */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          API Anahtarları ({apiKeys.length})
        </h2>

        {loading && apiKeys.length === 0 ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Yükleniyor...</p>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm" style={{ color: '#8E8E93' }}>Henüz API anahtarı yok</p>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.key_id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{
                  backgroundColor: '#000000',
                  border: '1px solid #2C2C2E',
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium" style={{ color: '#E5E5EA' }}>
                      {key.name}
                    </span>
                    <code className="text-sm" style={{ color: '#8E8E93' }}>
                      {key.masked_key}
                    </code>
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                    Oluşturulma: {new Date(key.created_at).toLocaleString('tr-TR')}
                    {key.last_used && ` • Son kullanım: ${new Date(key.last_used).toLocaleString('tr-TR')}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(key.masked_key)}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      backgroundColor: '#2C2C2E',
                      color: '#E5E5EA',
                    }}
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteKey(key.key_id)}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{
                      backgroundColor: '#E8434320',
                      color: '#E84343',
                    }}
                  >
                    Sil
                  </button>
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

