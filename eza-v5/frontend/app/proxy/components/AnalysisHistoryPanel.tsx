/**
 * Analysis History Panel
 * Displays Intent Logs and Impact Events
 * Working Draft → Intent Log → Impact Event flow
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HistoryResponse, IntentLog, ImpactEvent, softDeleteAnalysis } from '@/api/proxy_corporate';
import { useOrganization } from '@/context/OrganizationContext';
import { useAuth } from '@/context/AuthContext';

interface AnalysisHistoryPanelProps {
  history: HistoryResponse | null;
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
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIntent, setSelectedIntent] = useState<IntentLog | null>(null);
  const [selectedImpact, setSelectedImpact] = useState<ImpactEvent | null>(null);
  const [activeView, setActiveView] = useState<'intents' | 'impacts'>('intents');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  const truncateContent = (content: string | null | undefined, maxLength: number = 140): string => {
    if (!content) return 'İçerik mevcut değil';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
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

  const getTriggerActionLabel = (action: string): string => {
    switch (action) {
      case 'save':
        return 'Yayına Hazırlık Analizi';
      case 'rewrite':
        return 'Yeniden Yazma';
      case 'version':
        return 'Versiyon Oluşturma';
      case 'approval_request':
        return 'Onaya Gönderme';
      default:
        return action;
    }
  };

  const getImpactTypeLabel = (type: string): string => {
    switch (type) {
      case 'api_response':
        return 'API Yanıtı';
      case 'chatbot_display':
        return 'Chatbot Gösterimi';
      case 'cms_publish':
        return 'CMS Yayını';
      case 'campaign_send':
        return 'Kampanya Gönderimi';
      case 'notification':
        return 'Bildirim';
      case 'external_integration':
        return 'Harici Entegrasyon';
      default:
        return type;
    }
  };

  // Check if user can delete (owner or org admin)
  const canDelete = (intent: IntentLog | ImpactEvent): boolean => {
    if (!user) return false;
    const userRole = user.role || '';
    const isOrgAdmin = ['admin', 'org_admin', 'ops'].includes(userRole);
    const userId = user.user_id || user.id;
    
    // For Intent Logs: owner or org admin can delete
    if ('user_id' in intent) {
      return isOrgAdmin || intent.user_id === userId;
    }
    
    // For Impact Events: only org admin can delete
    return isOrgAdmin;
  };

  // Handle soft delete
  const handleDelete = async (analysisId: string) => {
    if (!currentOrganization?.id) {
      setDeleteError('Organizasyon seçilmedi.');
      return;
    }

    setDeletingId(analysisId);
    setDeleteError(null);

    try {
      await softDeleteAnalysis(analysisId, currentOrganization.id);
      setShowDeleteConfirm(null);
      // Refresh history after deletion
      onRefresh();
    } catch (err: any) {
      console.error('[History] Delete error:', err);
      setDeleteError(err.message || 'Silme işlemi başarısız oldu.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !history) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mb-4" style={{ borderColor: 'var(--proxy-action-primary)' }}></div>
          <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
            Geçmiş yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  if (!history || (history.intent_logs.length === 0 && history.impact_events.length === 0)) {
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
          Henüz Kayıt Yok
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--proxy-text-secondary)' }}>
          Yayına hazırlık analizi veya gerçek etki kaydı oluşturulduğunda burada görünecektir.
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
            {history.total_intents} niyet kaydı, {history.total_impacts} etki kaydı
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

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView('intents')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeView === 'intents' ? 'opacity-100' : 'opacity-50'
          }`}
          style={{
            backgroundColor: activeView === 'intents' ? 'var(--proxy-action-primary)' : 'var(--proxy-surface)',
            color: activeView === 'intents' ? '#FFFFFF' : 'var(--proxy-text-primary)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          Yayına Hazırlık Analizleri ({history.total_intents})
        </button>
        {history.total_impacts > 0 && (
          <button
            onClick={() => setActiveView('impacts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'impacts' ? 'opacity-100' : 'opacity-50'
            }`}
            style={{
              backgroundColor: activeView === 'impacts' ? 'var(--proxy-action-primary)' : 'var(--proxy-surface)',
              color: activeView === 'impacts' ? '#FFFFFF' : 'var(--proxy-text-primary)',
              border: '1px solid var(--proxy-border-soft)',
            }}
          >
            Gerçek Etki Kayıtları ({history.total_impacts})
          </button>
        )}
      </div>

      {/* Intent Logs */}
      {activeView === 'intents' && (
        <div className="space-y-4">
          {history.intent_logs.map((intent) => {
            const riskLevel = getRiskLevel(intent.risk_scores);
            const riskColor = getRiskColor(riskLevel);
            
            return (
              <div
                key={intent.id}
                className="rounded-xl p-6 transition-all hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div
                        className="px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: `${riskColor}20`,
                          color: riskColor,
                        }}
                      >
                        {riskLevel === 'low' ? 'Düşük Risk' : riskLevel === 'medium' ? 'Orta Risk' : 'Yüksek Risk'}
                      </div>
                      <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--proxy-action-primary)' }}>
                        {getTriggerActionLabel(intent.trigger_action)}
                      </span>
                      {intent.sector && (
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--proxy-bg-secondary)', color: 'var(--proxy-text-secondary)' }}>
                          {intent.sector}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                        {formatDate(intent.created_at)}
                      </span>
                    </div>
                    
                    {/* Content Preview */}
                    <div className="mb-3">
                      <p 
                        className="text-sm leading-relaxed"
                        style={{ 
                          color: 'var(--proxy-text-secondary)',
                          position: 'relative',
                          maxHeight: '3.6em',
                          overflow: 'hidden',
                        }}
                      >
                        {truncateContent(intent.input_content, 140)}
                        <span 
                          className="absolute bottom-0 right-0 pl-8"
                          style={{
                            background: 'linear-gradient(to right, transparent, var(--proxy-surface))',
                          }}
                        />
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--proxy-text-secondary)' }}>
                      <span>Etik İndeks: {intent.risk_scores?.ethical_index || 'N/A'}/100</span>
                      <span>Uyum: {intent.risk_scores?.compliance_score || 'N/A'}/100</span>
                      {intent.policy_set?.policies && intent.policy_set.policies.length > 0 && (
                        <span>Politikalar: {intent.policy_set.policies.join(', ')}</span>
                      )}
                    </div>

                    {intent.impact_events && intent.impact_events.length > 0 && (
                      <div className="mb-3">
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--proxy-success)' }}>
                          {intent.impact_events.length} Etki Kaydı
                        </span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/proxy/analysis/${intent.id}`)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--proxy-action-primary)',
                          color: '#FFFFFF',
                        }}
                      >
                        Analiz Detaylarını Gör
                      </button>
                      
                      {/* Delete Button (only if user can delete) */}
                      {canDelete(intent) && (
                        <button
                          onClick={() => setShowDeleteConfirm(intent.id)}
                          disabled={deletingId === intent.id}
                          className="p-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--proxy-danger)',
                            border: '1px solid var(--proxy-danger)',
                          }}
                          title="Geçmişten kaldır"
                        >
                          {deletingId === intent.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Impact Events */}
      {activeView === 'impacts' && (
        <div className="space-y-4">
          {history.impact_events.map((impact) => {
            const riskLevel = getRiskLevel(impact.risk_scores_locked);
            const riskColor = getRiskColor(riskLevel);
            
            return (
              <div
                key={impact.id}
                className="rounded-xl p-6 transition-all hover:bg-[var(--proxy-surface-hover)] border-2"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  borderColor: riskColor,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div
                        className="px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: `${riskColor}20`,
                          color: riskColor,
                        }}
                      >
                        {riskLevel === 'low' ? 'Düşük Risk' : riskLevel === 'medium' ? 'Orta Risk' : 'Yüksek Risk'}
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--proxy-danger)' }}>
                        Gerçek Etki — Kilitli
                      </span>
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--proxy-bg-secondary)', color: 'var(--proxy-text-secondary)' }}>
                        {getImpactTypeLabel(impact.impact_type)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                        {formatDate(impact.occurred_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'var(--proxy-text-secondary)' }}>
                      <span>Etik İndeks: {impact.risk_scores_locked?.ethical_index || 'N/A'}/100</span>
                      <span>Uyum: {impact.risk_scores_locked?.compliance_score || 'N/A'}/100</span>
                      <span>Kaynak: {impact.source_system}</span>
                    </div>

                    {impact.intent_log_id && (
                      <div className="mb-3">
                        <span className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                          İlgili Niyet Kaydı: {impact.intent_log_id.substring(0, 8)}...
                        </span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/proxy/analysis/${impact.id}`)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--proxy-action-primary)',
                          color: '#FFFFFF',
                        }}
                      >
                        Analiz Detaylarını Gör
                      </button>
                      
                      {/* Delete Button (only org admin can delete Impact Events) */}
                      {canDelete(impact) && (
                        <button
                          onClick={() => setShowDeleteConfirm(impact.id)}
                          disabled={deletingId === impact.id}
                          className="p-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--proxy-danger)',
                            border: '1px solid var(--proxy-danger)',
                          }}
                          title="Geçmişten kaldır"
                        >
                          {deletingId === impact.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {(history.total_intents > history.intent_logs.length || history.total_impacts > history.impact_events.length) && (
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
            {loading ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
          </button>
        </div>
      )}

      {/* Detail Modals */}
      {selectedIntent && (
        <IntentDetailModal
          intent={selectedIntent}
          onClose={() => setSelectedIntent(null)}
        />
      )}

      {selectedImpact && (
        <ImpactDetailModal
          impact={selectedImpact}
          onClose={() => setSelectedImpact(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => {
            setShowDeleteConfirm(null);
            setDeleteError(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              backgroundColor: 'var(--proxy-surface)',
              border: '1px solid var(--proxy-border-soft)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
              Analizi Geçmişten Kaldır
            </h3>
            
            <p className="text-sm mb-4" style={{ color: 'var(--proxy-text-secondary)' }}>
              Bu analiz geçmişinizden kaldırılacaktır. Sistem kayıtları korunur.
            </p>
            
            <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', border: '1px solid var(--proxy-action-primary)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--proxy-text-secondary)' }}>
                <strong>Not:</strong> Silinen analizler yalnızca kullanıcı geçmişinden kaldırılır. Denetim ve güvenlik amaçlı sistem kayıtları saklanır.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--proxy-danger)' }}>
                <p className="text-sm" style={{ color: 'var(--proxy-danger)' }}>{deleteError}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--proxy-danger)',
                  color: '#FFFFFF',
                }}
              >
                {deletingId === showDeleteConfirm ? 'Kaldırılıyor...' : 'Kaldır'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeleteError(null);
                }}
                disabled={deletingId === showDeleteConfirm}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  color: 'var(--proxy-text-primary)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntentDetailModal({
  intent,
  onClose
}: {
  intent: IntentLog;
  onClose: () => void;
}) {
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
            Yayına Hazırlık Analizi Detayı
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

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--proxy-text-muted)' }}>Tarih: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>
                {new Date(intent.created_at).toLocaleString('tr-TR')}
              </span>
            </div>
            {intent.sector && (
              <div>
                <span style={{ color: 'var(--proxy-text-muted)' }}>Sektör: </span>
                <span style={{ color: 'var(--proxy-text-primary)' }}>{intent.sector}</span>
              </div>
            )}
            <div className="col-span-2">
              <span style={{ color: 'var(--proxy-text-muted)' }}>Aksiyon: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>{intent.trigger_action}</span>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
              Skorlar
            </h4>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(intent.risk_scores || {}).map(([key, value]) => (
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

          {intent.impact_events && intent.impact_events.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
                İlgili Etki Kayıtları ({intent.impact_events.length})
              </h4>
              <div className="space-y-2">
                {intent.impact_events.map((ie) => (
                  <div key={ie.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--proxy-bg-secondary)' }}>
                    <div className="text-sm" style={{ color: 'var(--proxy-text-primary)' }}>
                      {ie.impact_type} — {new Date(ie.occurred_at).toLocaleString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactDetailModal({
  impact,
  onClose
}: {
  impact: ImpactEvent;
  onClose: () => void;
}) {
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
            Gerçek Etki Kaydı Detayı
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

        <div className="space-y-6">
          <div className="p-4 rounded-xl border-2" style={{ borderColor: 'var(--proxy-danger)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--proxy-danger)' }}>
              ⚠️ Bu kayıt gerçek etkiyi temsil eder ve hukuki referanstır.
            </p>
            <p className="text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
              Skorlar etki anında kilitlenmiştir ve değiştirilemez.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--proxy-text-muted)' }}>Etki Zamanı: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>
                {new Date(impact.occurred_at).toLocaleString('tr-TR')}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--proxy-text-muted)' }}>Etki Türü: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>{impact.impact_type}</span>
            </div>
            <div>
              <span style={{ color: 'var(--proxy-text-muted)' }}>Kaynak Sistem: </span>
              <span style={{ color: 'var(--proxy-text-primary)' }}>{impact.source_system}</span>
            </div>
            {impact.intent_log_id && (
              <div>
                <span style={{ color: 'var(--proxy-text-muted)' }}>İlgili Niyet Kaydı: </span>
                <span style={{ color: 'var(--proxy-text-primary)' }}>{impact.intent_log_id}</span>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--proxy-text-primary)' }}>
              Kilitli Skorlar (Etki Anında)
            </h4>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(impact.risk_scores_locked || {}).map(([key, value]) => (
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
        </div>
      </div>
    </div>
  );
}
