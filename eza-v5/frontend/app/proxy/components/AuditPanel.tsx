/**
 * Audit & Reporting Panel Component
 */

"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/api/config";
import { useOrganization } from "@/context/OrganizationContext";
import Toast from "../../proxy-lite/components/Toast";

interface AuditPanelProps {
  analysisId?: string;
}

export default function AuditPanel({ analysisId }: AuditPanelProps) {
  const { currentOrganization } = useOrganization();
  const [verificationHash, setVerificationHash] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleVerifyHash = async () => {
    if (!analysisId || !verificationHash || !currentOrganization?.id) {
      setToast({
        type: 'error',
        message: 'Analiz ID ve hash gerekli. Lütfen önce bir analiz yapın.',
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('eza_token');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/audit/verify?analysis_id=${analysisId}&provided_hash=${verificationHash}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-org-id': currentOrganization.id,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Hash doğrulama başarısız' }));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setVerificationResult(data);
      
      setToast({
        type: data.verified ? 'success' : 'error',
        message: data.verified ? 'Hash doğrulandı ✓' : 'Hash uyuşmazlığı tespit edildi ✗',
      });
    } catch (error: any) {
      console.error('[Audit] Verification error:', error);
      setToast({
        type: 'error',
        message: error.message || 'Hash doğrulama sırasında bir hata oluştu',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!analysisId || !currentOrganization?.id) {
      setToast({
        type: 'error',
        message: 'Analiz ID gerekli. Lütfen önce bir analiz yapın.',
      });
      return;
    }

    try {
      const token = localStorage.getItem('eza_token');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/report/pdf?analysis_id=${analysisId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-org-id': currentOrganization.id,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_report_${analysisId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setToast({
        type: 'success',
        message: 'Rapor indirildi',
      });
    } catch (error: any) {
      console.error('[Audit] PDF download error:', error);
      setToast({
        type: 'error',
        message: error.message || 'Rapor indirme sırasında bir hata oluştu',
      });
    }
  };

  const handleSendToRegulator = async () => {
    if (!analysisId || !currentOrganization?.id) {
      setToast({
        type: 'error',
        message: 'Analiz ID gerekli. Lütfen önce bir analiz yapın.',
      });
      return;
    }

    try {
      const token = localStorage.getItem('eza_token');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/regulator/send?analysis_id=${analysisId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-org-id': currentOrganization.id,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Uyum raporu oluşturma başarısız' }));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setToast({
        type: 'success',
        message: data.message || 'Uyum raporu oluşturuldu ve regülatör kanalına gönderildi',
      });
    } catch (error: any) {
      console.error('[Audit] Send to regulator error:', error);
      setToast({
        type: 'error',
        message: error.message || 'Uyum raporu oluşturulamadı',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hash Verification */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
          Hash Doğrulama
        </h3>
        <div className="space-y-4">
          <input
            type="text"
            value={verificationHash}
            onChange={(e) => setVerificationHash(e.target.value)}
            placeholder="SHA-256 hash girin..."
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
            style={{
              backgroundColor: '#000000',
              border: '1px solid #2C2C2E',
              color: '#E5E5EA',
            }}
          />
          <button
            type="button"
            onClick={handleVerifyHash}
            disabled={!analysisId || !verificationHash || loading || !currentOrganization?.id}
            className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </button>
          
          {!analysisId && (
            <p className="text-xs mt-2" style={{ color: '#8E8E93' }}>
              💡 İpucu: Hash doğrulamak için önce bir analiz yapın. Analiz sonrası oluşturulan hash'i buraya girebilirsiniz.
            </p>
          )}
          
          {verificationResult && (
            <div
              className={`p-4 rounded-xl ${
                verificationResult.verified
                  ? 'bg-[#22BF5520] border-[#22BF55]'
                  : 'bg-[#E8434320] border-[#E84343]'
              }`}
              style={{ border: '1px solid' }}
            >
              <p className="text-sm font-semibold" style={{ color: verificationResult.verified ? '#22BF55' : '#E84343' }}>
                {verificationResult.verified ? '✓ ' : '✗ '}{verificationResult.status}
              </p>
              <p className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                Kayıtlı Hash: {verificationResult.stored_hash?.substring(0, 16)}...{verificationResult.stored_hash?.substring(-8)}
              </p>
              {verificationResult.record_type && (
                <p className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                  Kayıt Tipi: {verificationResult.record_type}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Actions */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #2C2C2E',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
          Raporlama
        </h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!analysisId || !currentOrganization?.id}
              className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#2C2C2E',
                color: '#E5E5EA',
              }}
            >
              PDF Raporu İndir
            </button>
            <button
            type="button"
            onClick={handleSendToRegulator}
            disabled={!analysisId || !currentOrganization?.id}
            className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
            title="Uyum raporu oluştur ve regülatör kanalına gönder (anonimleştirilmiş veri)"
          >
            Uyum Raporu Oluştur
          </button>
          </div>
          
          {!analysisId && (
            <p className="text-xs" style={{ color: '#8E8E93' }}>
              💡 İpucu: Rapor indirmek veya regülatöre göndermek için önce bir analiz yapın.
            </p>
          )}
          
          <div className="text-xs space-y-1" style={{ color: '#8E8E93' }}>
            <p><strong>PDF Raporu:</strong> Analiz kaydının tam denetim raporunu içerir (hash, skorlar, risk bayrakları).</p>
            <p><strong>Uyum Raporu Oluştur:</strong> Anonimleştirilmiş veri (içerik ve kullanıcı bilgileri olmadan) uyum raporu olarak hazırlanır ve regülatör kanalına gönderilir. Regülatör, olası denetim tüketicilerinden biridir.</p>
          </div>
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


