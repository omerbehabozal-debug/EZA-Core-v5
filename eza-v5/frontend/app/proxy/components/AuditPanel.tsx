/**
 * Audit & Reporting Panel Component
 */

"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/api/config";

interface AuditPanelProps {
  analysisId?: string;
}

export default function AuditPanel({ analysisId }: AuditPanelProps) {
  const [verificationHash, setVerificationHash] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerifyHash = async () => {
    if (!analysisId || !verificationHash) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/audit/verify?analysis_id=${analysisId}&provided_hash=${verificationHash}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': apiKey || '',
          },
        }
      );

      const data = await res.json();
      setVerificationResult(data);
    } catch (error) {
      console.error('[Audit] Verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!analysisId) return;

    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/report/pdf?analysis_id=${analysisId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': apiKey || '',
          },
        }
      );

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_report_${analysisId}.txt`;
      a.click();
    } catch (error) {
      console.error('[Audit] PDF download error:', error);
    }
  };

  const handleSendToRegulator = async () => {
    if (!analysisId) return;

    try {
      const token = localStorage.getItem('auth_token');
      const apiKey = localStorage.getItem('proxy_api_key');
      
      const res = await fetch(
        `${API_BASE_URL}/api/proxy/regulator/send?analysis_id=${analysisId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': apiKey || '',
          },
        }
      );

      const data = await res.json();
      alert(data.message || 'Regülatöre gönderildi');
    } catch (error) {
      console.error('[Audit] Send to regulator error:', error);
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
            disabled={!analysisId || !verificationHash || loading}
            className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </button>
          
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
                {verificationResult.status}
              </p>
              <p className="text-xs mt-1" style={{ color: '#8E8E93' }}>
                Stored: {verificationResult.stored_hash?.substring(0, 16)}...
              </p>
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!analysisId}
            className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
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
            disabled={!analysisId}
            className="px-4 py-2 rounded-lg font-medium transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: '#007AFF',
              color: '#FFFFFF',
            }}
          >
            Regülatöre Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

