/**
 * Analysis Snapshot Page
 * Full read-only snapshot of an analysis (Intent Log or Impact Event)
 * Audit-grade, immutable view for compliance and regulator purposes
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAnalysisSnapshot, AnalysisSnapshot } from "@/api/proxy_corporate";
import { useOrganization } from "@/context/OrganizationContext";
import RequireAuth from "@/components/auth/RequireAuth";
import ScoreBars from "../../components/ScoreBars";
import ComplianceMetrics from "../../components/ComplianceMetrics";

function AnalysisSnapshotContent() {
  const params = useParams();
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const analysisId = params && params.id ? (params.id as string) : undefined;
  
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId || !currentOrganization?.id) {
      if (!analysisId) {
        setError('Analiz ID bulunamadı');
        setLoading(false);
      }
      return;
    }
    
    loadSnapshot();
  }, [analysisId, currentOrganization?.id]);

  const loadSnapshot = async () => {
    if (!analysisId || !currentOrganization?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getAnalysisSnapshot(analysisId, currentOrganization.id);
      setSnapshot(data);
    } catch (err: any) {
      console.error('[Snapshot] Load error:', err);
      setError(err?.message || 'Snapshot yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--proxy-bg-primary)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: 'var(--proxy-action-primary)' }}></div>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            Snapshot yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--proxy-bg-primary)' }}>
        <div className="max-w-md w-full text-center">
          <div className="rounded-2xl p-8" style={{ backgroundColor: 'var(--proxy-surface)', border: '1px solid var(--proxy-border-soft)' }}>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
              Snapshot Yüklenemedi
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--proxy-text-secondary)' }}>
              {error || 'Snapshot bulunamadı'}
            </p>
            <button
              onClick={() => router.push('/proxy')}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--proxy-action-primary)',
                color: '#FFFFFF',
              }}
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--proxy-bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/proxy')}
            className="mb-4 text-sm font-medium transition-all hover:opacity-70"
            style={{ color: 'var(--proxy-text-secondary)' }}
          >
            ← Ana Sayfaya Dön
          </button>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
            Analiz Snapshot
          </h1>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            {snapshot.analysis_type_label} — {formatDate(snapshot.created_at)}
          </p>
        </div>

        {/* Immutable Banner */}
        <div
          className="rounded-xl p-4 mb-6 border-2"
          style={{
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderColor: 'var(--proxy-action-primary)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--proxy-text-primary)' }}>
              Bu analiz {formatDate(snapshot.created_at)} tarihinde oluşturulmuştur. İçerik değiştirilemez.
            </p>
          </div>
        </div>

        {/* Section 1: Analyzed Content */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
            Analiz Edilen İçerik
          </h2>
          <textarea
            value={snapshot.content || ''}
            readOnly
            disabled
            className="w-full p-4 rounded-xl text-sm leading-relaxed resize-none"
            style={{
              backgroundColor: 'var(--proxy-bg-secondary)',
              border: '1px solid var(--proxy-border-soft)',
              color: 'var(--proxy-text-primary)',
              minHeight: '200px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Section 2: Analysis Configuration */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
            Analiz Yapılandırması
          </h2>
          <div className="flex flex-wrap gap-3">
            {snapshot.sector && (
              <span
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--proxy-bg-secondary)',
                  color: 'var(--proxy-text-primary)',
                }}
              >
                Sektör: {snapshot.sector}
              </span>
            )}
            {snapshot.policies && snapshot.policies.length > 0 && (
              <>
                {snapshot.policies.map((policy) => (
                  <span
                    key={policy}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'rgba(37, 99, 235, 0.15)',
                      color: 'var(--proxy-action-primary)',
                    }}
                  >
                    {policy}
                  </span>
                ))}
              </>
            )}
            <span
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: 'var(--proxy-bg-secondary)',
                color: 'var(--proxy-text-primary)',
              }}
            >
              Analiz Türü: {snapshot.analysis_type === 'intent_log' ? 'Yayına Hazırlık' : 'Gerçek Etki'}
            </span>
          </div>
        </div>

        {/* Section 3: Scores */}
        {snapshot.scores && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              border: '1px solid var(--proxy-border-soft)',
            }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
              Skorlar (Kilitli Değerler)
            </h2>
            <ScoreBars scores={snapshot.scores} />
            <ComplianceMetrics scores={snapshot.scores} />
          </div>
        )}

        {/* Section 4: System Findings */}
        {snapshot.system_findings && snapshot.system_findings.length > 0 && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              border: '1px solid var(--proxy-border-soft)',
            }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
              Sistem Bulguları
            </h2>
            <div className="space-y-2">
              {snapshot.system_findings.map((finding, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--proxy-bg-secondary)',
                    color: 'var(--proxy-text-primary)',
                  }}
                >
                  {finding}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 5: User Action Summary */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
            Kullanıcı Aksiyonu
          </h2>
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--proxy-text-primary)' }}>
              <strong>Aksiyon:</strong> {snapshot.user_action.action_label}
            </p>
            <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
              <strong>Zaman:</strong> {formatDate(snapshot.user_action.timestamp)}
            </p>
            {snapshot.impact_details && (
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--proxy-danger)' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--proxy-danger)' }}>
                  Gerçek Etki Detayları
                </p>
                <p className="text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
                  Etki Türü: {snapshot.impact_details.impact_type_label}
                </p>
                <p className="text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
                  Kaynak Sistem: {snapshot.impact_details.source_system}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Impact Events (if any) */}
        {snapshot.impact_events && snapshot.impact_events.length > 0 && (
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              border: '1px solid var(--proxy-border-soft)',
            }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
              İlgili Etki Kayıtları ({snapshot.impact_events.length})
            </h2>
            <div className="space-y-3">
              {snapshot.impact_events.map((ie) => (
                <div
                  key={ie.id}
                  className="p-4 rounded-lg border-2"
                  style={{
                    backgroundColor: 'var(--proxy-bg-secondary)',
                    borderColor: 'var(--proxy-danger)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--proxy-text-primary)' }}>
                      {ie.impact_type}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                      {formatDate(ie.occurred_at)}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--proxy-text-secondary)' }}>
                    Kaynak: {ie.source_system}
                  </p>
                  {ie.risk_scores_locked && (
                    <div className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                      Etik İndeks: {ie.risk_scores_locked.ethical_index || 'N/A'}/100
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalysisSnapshotPage() {
  return (
    <RequireAuth allowedRoles={['admin', 'corporate', 'proxy_user', 'reviewer', 'auditor', 'org_admin', 'ops']}>
      <AnalysisSnapshotContent />
    </RequireAuth>
  );
}

