/**
 * Analysis History Panel
 * Displays saved analysis records with regulator-compliant snapshot view
 */

'use client';

import { useState } from 'react';
import { AnalysisHistoryResponse, AnalysisRecord, getAnalysisRecord } from '@/api/proxy_corporate';
import { useOrganization } from '@/context/OrganizationContext';

interface AnalysisHistoryPanelProps {
  history: AnalysisHistoryResponse | null;
  loading: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
}

export default function AnalysisHistoryPanel({
  history,
  loading,
  onLoadMore,
  onRefresh
}: AnalysisHistoryPanelProps) {
  const { currentOrganization } = useOrganization();
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadRecordDetail = async (recordId: string) => {
    if (!currentOrganization?.id) return;
    
    setLoadingDetail(true);
    try {
      const record = await getAnalysisRecord(recordId, currentOrganization.id);
      if (record) {
        setSelectedRecord(record);
      }
    } catch (err) {
      console.error('[History] Load record error:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getRiskLevel = (scores: any): 'low' | 'medium' | 'high' => {
    if (!scores || typeof scores.ethical_index !== 'number') return 'medium';
    const ethical = scores.ethical_index;
    if (ethical >= 80) return 'low';
    if (ethical >= 50) return 'medium';
    return 'high';
  };

  const getRiskColor = (level: 'low' | 'medium' | 'high'): string => {
    switch (level) {
      case 'low':
        return 'var(--proxy-success)';
      case 'medium':
        return 'var(--proxy-warning)';
      case 'high':
        return 'var(--proxy-danger)';
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

  if (loading && !history) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: 'var(--proxy-action-primary)' }}></div>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            Analiz geçmişi yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  if (!history || history.records.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          backgroundColor: 'var(--proxy-surface)',
          border: '1px solid var(--proxy-border-soft)',
        }}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
          <svg className="w-8 h-8" style={{ color: 'var(--proxy-action-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
          Henüz Kaydedilmiş Analiz Yok
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--proxy-text-secondary)' }}>
          Analiz sonuçlarını kaydettiğinizde burada görünecektir.
        </p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: 'var(--proxy-action-primary)',
            color: '#FFFFFF',
          }}
        >
          Yenile
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
            Analiz Geçmişi
          </h2>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            {history.total} kayıt bulundu
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            color: 'var(--proxy-text-primary)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          {loading ? 'Yenileniyor...' : 'Yenile'}
        </button>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {history.records.map((record) => {
          const riskLevel = getRiskLevel(record.scores);
          const riskColor = getRiskColor(riskLevel);
          
          return (
            <div
              key={record.id}
              className="rounded-xl p-6 transition-all hover:bg-[var(--proxy-surface-hover)] cursor-pointer"
              style={{
                backgroundColor: 'var(--proxy-surface)',
                border: '1px solid var(--proxy-border-soft)',
              }}
              onClick={() => loadRecordDetail(record.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="px-3 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        backgroundColor: `${riskColor}20`,
                        color: riskColor,
                      }}
                    >
                      {riskLevel === 'low' ? 'Düşük Risk' : riskLevel === 'medium' ? 'Orta Risk' : 'Yüksek Risk'}
                    </div>
                    {record.sector && (
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--proxy-bg-secondary)', color: 'var(--proxy-text-secondary)' }}>
                        {record.sector}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                      {formatDate(record.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--proxy-text-primary)' }}>
                    {record.input_text.substring(0, 150)}...
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
                    <span>Etik İndeks: {record.scores?.ethical_index || 'N/A'}/100</span>
                    <span>Uyum: {record.scores?.compliance_score || 'N/A'}/100</span>
                    {record.policies_snapshot?.policies && record.policies_snapshot.policies.length > 0 && (
                      <span>Politikalar: {record.policies_snapshot.policies.join(', ')}</span>
                    )}
                  </div>
                </div>
                
                <div className="ml-4">
                  <svg className="w-5 h-5" style={{ color: 'var(--proxy-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {history.total > history.records.length && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              color: 'var(--proxy-text-primary)',
              border: '1px solid var(--proxy-border-soft)',
            }}
          >
            {loading ? 'Yükleniyor...' : `Daha Fazla Yükle (${history.total - history.records.length} kaldı)`}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <AnalysisDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          loading={loadingDetail}
        />
      )}
    </div>
  );
}

function AnalysisDetailModal({
  record,
  onClose,
  loading
}: {
  record: AnalysisRecord;
  onClose: () => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: 'var(--proxy-action-primary)' }}></div>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            Yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--proxy-surface)',
          border: '1px solid var(--proxy-border-soft)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold" style={{ color: 'var(--proxy-text-primary)' }}>
            Analiz Detayı
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--proxy-surface-hover)] transition-colors"
            style={{ color: 'var(--proxy-text-secondary)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--proxy-text-muted)' }}>Tarih: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>
                {new Date(record.created_at).toLocaleString('tr-TR')}
              </span>
            </div>
            {record.sector && (
              <div>
                <span style={{ color: 'var(--proxy-text-muted)' }}>Sektör: </span>
                <span style={{ color: 'var(--proxy-text-primary)' }}>{record.sector}</span>
              </div>
            )}
            {record.policies_snapshot?.policies && (
              <div className="col-span-2">
                <span style={{ color: 'var(--proxy-text-muted)' }}>Politikalar: </span>
                <span style={{ color: 'var(--proxy-text-primary)' }}>
                  {record.policies_snapshot.policies.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Input Text */}
          <div>
            <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
              Analiz Edilen İçerik
            </h4>
            <div
              className="p-4 rounded-xl"
              style={{
                backgroundColor: 'var(--proxy-bg-secondary)',
                border: '1px solid var(--proxy-border-soft)',
              }}
            >
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--proxy-text-primary)' }}>
                {record.input_text}
              </p>
            </div>
          </div>

          {/* Scores */}
          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
              Skorlar
            </h4>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(record.scores || {}).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--proxy-text-muted)' }}>
                    {key.replace('_', ' ')}
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--proxy-text-primary)' }}>
                    {typeof value === 'number' ? value : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Violations */}
          {record.violations && (
            <div>
              <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
                Tespit Edilen İhlaller
              </h4>
              {record.violations.flags && record.violations.flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {record.violations.flags.map((flag: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-medium"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        color: 'var(--proxy-danger)',
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

