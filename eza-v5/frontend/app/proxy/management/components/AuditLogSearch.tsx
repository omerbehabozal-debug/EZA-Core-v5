/**
 * Audit Log Search Component
 * Search and filter audit logs with export options
 */

"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/api/config";

interface AuditLogEntry {
  uuid: string;
  sha256: string;
  timestamp: string;
  policy_trace: any[];
  risk_flags: any[];
  raw_data?: {
    org_id?: string;
    scores?: {
      ethical_index?: number;
    };
  };
}

interface AuditLogSearchProps {
  orgId: string | null;
}

export default function AuditLogSearch({ orgId }: AuditLogSearchProps) {
  const [results, setResults] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    risk_level: "",
    flag: "",
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const handleSearch = async () => {
    if (!orgId) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const params = new URLSearchParams({
        orgId: orgId,
        ...(filters.from_date && { from_date: filters.from_date }),
        ...(filters.to_date && { to_date: filters.to_date }),
        ...(filters.risk_level && { risk_level: filters.risk_level }),
        ...(filters.flag && { flag: filters.flag }),
      });

      const res = await fetch(`${API_BASE_URL}/api/proxy/audit/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': apiKey || '',
        },
      });

      const data = await res.json();
      if (data.ok) {
        setResults(data.results);
      }
    } catch (err: any) {
      console.error('[Audit] Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['UUID', 'Tarih', 'Etik Skor', 'Risk Bayrakları', 'Politikalar'].join(','),
      ...results.map((entry) => [
        entry.uuid,
        entry.timestamp,
        entry.raw_data?.scores?.ethical_index || 'N/A',
        entry.risk_flags.map((f) => f.flag).join(';'),
        entry.policy_trace.map((p) => p.policy).join(';'),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getRiskLevel = (score?: number): string => {
    if (!score) return 'N/A';
    if (score >= 80) return 'Düşük';
    if (score >= 50) return 'Orta';
    return 'Yüksek';
  };

  const getRiskColor = (score?: number): string => {
    if (!score) return '#8E8E93';
    if (score >= 80) return '#22BF55';
    if (score >= 50) return '#FF9500';
    return '#E84343';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
          Filtreler
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8E8E93' }}>
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8E8E93' }}>
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8E8E93' }}>
              Risk Seviyesi
            </label>
            <select
              value={filters.risk_level}
              onChange={(e) => setFilters({ ...filters, risk_level: e.target.value })}
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            >
              <option value="">Tümü</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '#8E8E93' }}>
              Risk Bayrağı
            </label>
            <input
              type="text"
              value={filters.flag}
              onChange={(e) => setFilters({ ...filters, flag: e.target.value })}
              placeholder="ethical, compliance, manipulation..."
              className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              style={{
                backgroundColor: '#000000',
                border: '1px solid #2C2C2E',
                color: '#E5E5EA',
              }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 rounded-xl font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            {loading ? 'Aranıyor...' : 'Ara'}
          </button>
          {results.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-6 py-3 rounded-xl font-medium"
              style={{
                backgroundColor: '#2C2C2E',
                color: '#E5E5EA',
              }}
            >
              CSV İndir
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: '#E5E5EA' }}>
            Sonuçlar ({results.length})
          </h2>

          <div className="space-y-2">
            {results.map((entry) => {
              const score = entry.raw_data?.scores?.ethical_index;
              return (
                <div
                  key={entry.uuid}
                  onClick={() => setSelectedEntry(entry)}
                  className="p-4 rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
                  style={{
                    backgroundColor: '#000000',
                    border: `1px solid ${selectedEntry?.uuid === entry.uuid ? '#007AFF' : '#2C2C2E'}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <code className="text-xs" style={{ color: '#8E8E93' }}>
                          {entry.uuid.substring(0, 8)}...
                        </code>
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${getRiskColor(score)}20`,
                            color: getRiskColor(score),
                          }}
                        >
                          {getRiskLevel(score)}
                        </span>
                      </div>
                      <div className="text-sm" style={{ color: '#E5E5EA' }}>
                        {new Date(entry.timestamp).toLocaleString('tr-TR')}
                      </div>
                      <div className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                        {entry.risk_flags.length} risk bayrağı • {entry.policy_trace.length} politika
                      </div>
                    </div>
                    <span className="text-sm" style={{ color: '#8E8E93' }}>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail View */}
      {selectedEntry && (
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: '#E5E5EA' }}>
              Denetim Detayı
            </h3>
            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="text-2xl"
              style={{ color: '#8E8E93' }}
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>UUID</p>
              <code className="text-sm" style={{ color: '#E5E5EA' }}>{selectedEntry.uuid}</code>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>SHA-256 Hash</p>
              <code className="text-sm" style={{ color: '#E5E5EA' }}>{selectedEntry.sha256}</code>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#8E8E93' }}>Tarih</p>
              <p className="text-sm" style={{ color: '#E5E5EA' }}>
                {new Date(selectedEntry.timestamp).toLocaleString('tr-TR')}
              </p>
            </div>
            <div>
              <p className="text-sm mb-2" style={{ color: '#8E8E93' }}>Politika İzleme</p>
              <div className="space-y-1">
                {selectedEntry.policy_trace.map((trace, idx) => (
                  <div key={idx} className="text-sm" style={{ color: '#E5E5EA' }}>
                    • {trace.policy} (Şiddet: {trace.severity})
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

