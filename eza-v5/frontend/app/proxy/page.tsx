/**
 * EZA Proxy - Corporate Page
 * Dark Navy corporate theme, data-first approach
 * For banks, media, fintech, autonomous systems
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analyzeProxy, rewriteProxy, ProxyAnalyzeResponse, ProxyRewriteResponse, createIntentLog, getAnalysisHistory, IntentLog, HistoryResponse } from "@/api/proxy_corporate";
import RequireAuth from "@/components/auth/RequireAuth";
import { useOrganization } from "@/context/OrganizationContext";
import ProxyUserProfileDropdown from "./components/ProxyUserProfileDropdown";
import ScoreBars from "./components/ScoreBars";
import ComplianceMetrics from "./components/ComplianceMetrics";
import RiskFlags from "./components/RiskFlags";
import RewriteOptions from "./components/RewriteOptions";
import Tabs, { TabList, Tab, TabPanel } from "./components/Tabs";
import TelemetryDashboard from "./components/TelemetryDashboard";
import DecisionJustification from "./components/DecisionJustification";
import AuditPanel from "./components/AuditPanel";
import PipelineDiagram from "./components/PipelineDiagram";
import AnalysisHistoryPanel from "./components/AnalysisHistoryPanel";
import Toast from "../proxy-lite/components/Toast";
import ParagraphAnalysisView from "./components/ParagraphAnalysisView";

function ProxyCorporatePageContent() {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ProxyAnalyzeResponse | null>(null);
  const [rewriteResult, setRewriteResult] = useState<ProxyRewriteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analiz' | 'telemetry' | 'pipeline' | 'audit' | 'history'>('analiz');
  const [saving, setSaving] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Configuration
  const [domain, setDomain] = useState<'finance' | 'health' | 'retail' | 'media' | 'autonomous' | ''>('');
  const [policies, setPolicies] = useState<('TRT' | 'FINTECH' | 'HEALTH')[]>([]);
  const [rewriteMode, setRewriteMode] = useState<'strict_compliance' | 'neutral_rewrite' | 'policy_bound' | 'autonomous_safety' | 'corporate_voice'>('neutral_rewrite');

  // Wrapper function to handle tab changes from Tabs component
  const handleTabChange = (tab: string) => {
    if (tab === 'analiz' || tab === 'telemetry' || tab === 'pipeline' || tab === 'audit' || tab === 'history') {
      setActiveTab(tab);
      // Load history when history tab is opened (always reload to get latest data)
      if (tab === 'history') {
        loadAnalysisHistory();
      }
    }
  };

  // Load analysis history
  const loadAnalysisHistory = useCallback(async () => {
    if (!currentOrganization?.id) {
      console.warn('[Proxy] Cannot load history: organization not selected');
      return;
    }
    
    setHistoryLoading(true);
    setError(null); // Clear previous errors
    try {
      const history = await getAnalysisHistory(currentOrganization.id, 1, 20); // Always start from page 1
      if (history) {
        setAnalysisHistory(history);
        setHistoryPage(1); // Reset to page 1
      } else {
        // If no history returned, set empty history
        setAnalysisHistory({
          intent_logs: [],
          impact_events: [],
          total_intents: 0,
          total_impacts: 0,
          page: 1,
          page_size: 20
        });
      }
    } catch (err: any) {
      console.error('[Proxy] Load history error:', err);
      setError(`Geçmiş yüklenemedi: ${err?.message || 'Bilinmeyen hata'}`);
      // Set empty history on error
      setAnalysisHistory({
        intent_logs: [],
        impact_events: [],
        total_intents: 0,
        total_impacts: 0,
        page: 1,
        page_size: 20
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [currentOrganization?.id]);

  // Load history when component mounts and organization is available
  useEffect(() => {
    if (currentOrganization?.id && activeTab === 'history') {
      loadAnalysisHistory();
    }
  }, [currentOrganization?.id, activeTab, loadAnalysisHistory]);

  // Create Intent Log (publication readiness intent)
  const handleSaveAnalysis = async () => {
    if (!analysisResult || !currentOrganization?.id) {
      setError('Analiz sonucu veya organizasyon bulunamadı. Lütfen önce analiz yapın.');
      return;
    }
    
    if (!content.trim()) {
      setError('Kaydedilecek içerik bulunamadı.');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      console.log('[Proxy] Saving analysis as Intent Log...', {
        orgId: currentOrganization.id,
        contentLength: content.trim().length,
        hasAnalysisResult: !!analysisResult,
        sector: domain,
        policies: policies
      });
      
      const intentLog = await createIntentLog(
        {
          analysis_result: {
            ...analysisResult,
            input_text: content.trim(),
            content: content.trim()
          } as ProxyAnalyzeResponse & { input_text: string; content: string },
          trigger_action: 'save',
          sector: domain || null,
          policies: policies.length > 0 ? policies : null,
        },
        currentOrganization.id
      );
      
      if (intentLog) {
        console.log('[Proxy] Intent Log created successfully:', intentLog.id);
        
        // Show success message with premium toast
        setToast({
          type: 'success',
          message: 'Yayına hazırlık analizi kaydedildi. Niyet kaydı oluşturuldu.',
        });
        
        // Always refresh history to show the new record
        loadAnalysisHistory();
      } else {
        console.error('[Proxy] Intent Log creation returned null');
        setError('Kayıt oluşturulamadı. Backend yanıt vermedi.');
      }
    } catch (err: any) {
      console.error('[Proxy] Save analysis error:', err);
      const errorMessage = err?.message || 'Yayına hazırlık analizi kaydedilemedi.';
      setError(`Kaydetme hatası: ${errorMessage}`);
      setToast({
        type: 'error',
        message: `Kaydetme başarısız: ${errorMessage}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // Wrapper function to handle rewrite mode changes from RewriteOptions component
  const handleModeChange = (mode: string) => {
    if (mode === 'strict_compliance' || mode === 'neutral_rewrite' || mode === 'policy_bound' || mode === 'autonomous_safety' || mode === 'corporate_voice') {
      setRewriteMode(mode);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    setLoading(true);
    setAnalysisResult(null);
    setRewriteResult(null);
    setError(null);

    try {
      // Get organization ID from context
      const orgId = currentOrganization?.id || null;
      if (!orgId) {
        setError('Organizasyon seçilmedi. Lütfen bir organizasyon seçin.');
        setLoading(false);
        return;
      }

      const result = await analyzeProxy({
        content: content.trim(),
        input_type: 'text',
        policies: policies.length > 0 ? policies : undefined,
        domain: domain || undefined,
        provider: 'openai',
        return_report: true,
      }, orgId);

      if (result) {
        setAnalysisResult(result);
      } else {
        setError("Analiz tamamlanamadı. Backend yanıt vermedi. Lütfen backend'in çalıştığından ve erişilebilir olduğundan emin olun.");
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Bilinmeyen hata';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('fetch')) {
        userFriendlyMessage = 'Backend\'e bağlanılamıyor. Backend sunucusunun çalıştığından ve erişilebilir olduğundan emin olun.';
      } else if (errorMessage.includes('HTTP 404')) {
        userFriendlyMessage = 'Backend endpoint bulunamadı. Backend API\'sinin doğru yapılandırıldığından emin olun.';
      } else if (errorMessage.includes('HTTP 500')) {
        userFriendlyMessage = 'Backend sunucu hatası. Backend loglarını kontrol edin.';
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Not authenticated')) {
        userFriendlyMessage = 'Yetkilendirme hatası. Lütfen giriş yapın.';
        // Redirect to Proxy login after showing error
        setTimeout(() => {
          window.location.href = '/proxy/login';
        }, 2000);
      } else if (errorMessage.includes('aktif bir API anahtarı bulunamadı') || errorMessage.includes('API key')) {
        userFriendlyMessage = 'Bu organizasyon için aktif bir API anahtarı bulunamadı. Platform panelinden (platform.ezacore.ai) oluşturulmalıdır.';
      } else if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
        userFriendlyMessage = 'CORS hatası. Backend CORS ayarlarını kontrol edin.';
      } else if (errorMessage.includes('NEXT_PUBLIC_EZA_API_URL')) {
        userFriendlyMessage = 'Backend URL yapılandırılmamış. Lütfen sistem yöneticisine başvurun.';
      }
      
      setError(`Analiz hatası: ${userFriendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async () => {
    if (!content.trim() || rewriting || !analysisResult) return;

    setRewriting(true);
    setRewriteResult(null);
    setError(null);

    try {
      // Get organization ID from context
      const orgId = currentOrganization?.id || null;
      if (!orgId) {
        setError('Organizasyon seçilmedi. Lütfen bir organizasyon seçin.');
        setRewriting(false);
        return;
      }

      const result = await rewriteProxy({
        content: content.trim(),
        mode: rewriteMode,
        policies: policies.length > 0 ? policies : undefined,
        domain: domain || undefined,
        provider: 'openai',
        auto_reanalyze: true,
      }, orgId);

      if (result) {
        setRewriteResult(result);
      } else {
        setError("Yeniden yazma tamamlanamadı. Backend yanıt vermedi.");
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Bilinmeyen hata';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        userFriendlyMessage = 'Backend\'e bağlanılamıyor. Backend\'in çalıştığından emin olun.';
      } else if (errorMessage.includes('HTTP 404')) {
        userFriendlyMessage = 'Backend endpoint bulunamadı.';
      } else if (errorMessage.includes('HTTP 500')) {
        userFriendlyMessage = 'Backend sunucu hatası. Backend loglarını kontrol edin.';
      }
      
      setError(`Yeniden yazma hatası: ${userFriendlyMessage}`);
    } finally {
      setRewriting(false);
    }
  };

  // Show loading state if organization is still loading
  if (orgLoading || !currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1115' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#2563EB' }}></div>
          <p className="mt-4 text-sm" style={{ color: '#8E8E93' }}>
            Organizasyon yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--proxy-bg-primary)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="border-b pb-6" style={{ borderColor: 'var(--proxy-border-soft)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-4xl font-bold mb-2"
                style={{
                  color: 'var(--proxy-text-primary)',
                  fontWeight: 600,
                }}
              >
                EZA Proxy
              </h1>
              <p className="text-sm mb-2" style={{ color: 'var(--proxy-text-secondary)' }}>
                Operational AI Safety Interface
              </p>
              <p className="text-xs" style={{ color: 'var(--proxy-text-muted)', maxWidth: '600px', lineHeight: '1.5' }}>
                Bu panel, yapay zekâ sistemlerini yöneten uzman kullanıcılar için tasarlanmıştır. Burada yapılan analizler, yapay zekâ çıktılarının etik, güvenlik ve risk durumunu detaylı şekilde değerlendirir.
              </p>
            </div>
            {/* User Profile Dropdown (Proxy - No Platform Navigation) */}
            <ProxyUserProfileDropdown />
          </div>
        </div>

        {/* Input Section */}
        <div
          className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
          style={{
            backgroundColor: 'var(--proxy-surface)',
            border: '1px solid var(--proxy-border-soft)',
          }}
        >
          <form onSubmit={handleAnalyze} className="space-y-6">
            {/* Content Input */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
                İçerik
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Analiz edilecek içeriği buraya yazın..."
                disabled={loading}
                className="w-full min-h-[200px] px-4 py-3 rounded-xl resize-y transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--proxy-bg-secondary)',
                  border: '1px solid var(--proxy-border-soft)',
                  color: 'var(--proxy-text-primary)',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  '--tw-ring-color': 'var(--proxy-action-primary)',
                } as React.CSSProperties}
              />
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
                  Sektör
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as any || '')}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--proxy-bg-secondary)',
                    border: '1px solid var(--proxy-border-soft)',
                    color: 'var(--proxy-text-primary)',
                    '--tw-ring-color': 'var(--proxy-action-primary)',
                  } as React.CSSProperties}
                >
                  <option value="">Seçiniz</option>
                  <option value="finance">Finans</option>
                  <option value="health">Sağlık</option>
                  <option value="retail">Perakende</option>
                  <option value="media">Medya</option>
                  <option value="autonomous">Otonom Sistemler</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--proxy-text-primary)' }}>
                  Politikalar
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['TRT', 'FINTECH', 'HEALTH'] as const).map((policy) => (
                    <label
                      key={policy}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        backgroundColor: policies.includes(policy) 
                          ? 'rgba(37, 99, 235, 0.15)' 
                          : 'var(--proxy-bg-secondary)',
                        border: `1px solid ${policies.includes(policy) 
                          ? 'var(--proxy-action-primary)' 
                          : 'var(--proxy-border-soft)'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={policies.includes(policy)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPolicies([...policies, policy]);
                          } else {
                            setPolicies(policies.filter(p => p !== policy));
                          }
                        }}
                        className="w-4 h-4"
                        style={{ accentColor: 'var(--proxy-action-primary)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--proxy-text-primary)' }}>{policy}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              type="submit"
              disabled={!content.trim() || loading}
              className="w-full py-4 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                backgroundColor: 'var(--proxy-action-primary)',
                color: '#FFFFFF',
              }}
            >
              {loading ? 'Analiz Ediliyor...' : 'Analiz Et'}
            </button>
          </form>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultTab={activeTab} onTabChange={handleTabChange}>
          <TabList activeTab={activeTab} setActiveTab={handleTabChange}>
            <Tab id="analiz" activeTab={activeTab} setActiveTab={handleTabChange}>Analiz</Tab>
            <Tab id="history" activeTab={activeTab} setActiveTab={handleTabChange}>Analiz Geçmişi</Tab>
            <Tab id="telemetry" activeTab={activeTab} setActiveTab={handleTabChange}>Durum & Telemetri</Tab>
            <Tab id="pipeline" activeTab={activeTab} setActiveTab={handleTabChange}>AI Güvenlik Akışı</Tab>
            <Tab id="audit" activeTab={activeTab} setActiveTab={handleTabChange}>Denetim & Raporlama</Tab>
          </TabList>

          {/* Analiz Tab */}
          <TabPanel id="analiz" activeTab={activeTab}>
            {/* Results Section */}
            {analysisResult && (
              <div className="space-y-6 mt-6">
            {/* Score Bars */}
            <div
              className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
              style={{
                backgroundColor: 'var(--proxy-surface)',
                border: '1px solid var(--proxy-border-soft)',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                    Analiz Sonuçları
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(37, 99, 235, 0.15)', color: 'var(--proxy-action-primary)' }}>
                      Çalışma Taslağı — Kayıtlı Değil
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAnalysis}
                  disabled={saving}
                  className="px-6 py-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--proxy-action-primary)',
                    color: '#FFFFFF',
                  }}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Yayına Hazırlık Analizi</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--proxy-text-muted)' }}>
                Bu analiz yayına hazırlık niyeti olarak kaydedilecek. Gerçek etki anlamına gelmez.
              </p>
              <ScoreBars scores={analysisResult.overall_scores} />
            </div>

            {/* Compliance Metrics */}
            <ComplianceMetrics
              policies={policies}
              complianceScore={analysisResult.overall_scores.compliance_score}
            />

            {/* Paragraph-Based Analysis View (Proxy Lite Style) */}
            {analysisResult.paragraphs && analysisResult.paragraphs.length > 0 && (
              <div
                className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                  Paragraf Bazlı Analiz
                </h2>
                <p className="text-xs mb-6" style={{ color: 'var(--proxy-text-muted)' }}>
                  Metin paragraflara ayrılarak analiz edildi. Her paragraf için riskler, gerekçeler ve öneriler gösterilmektedir.
                </p>
                <ParagraphAnalysisView
                  paragraphs={analysisResult.paragraphs}
                  riskLocations={analysisResult.risk_locations}
                  justifications={analysisResult.justification}
                />
              </div>
            )}

            {/* Risk Flags (Summary View - Collapsed) */}
            {analysisResult.risk_locations && analysisResult.risk_locations.length > 0 && (
              <div
                className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                  Risk Özeti
                </h2>
                <RiskFlags
                  flags={analysisResult.flags}
                  riskLocations={analysisResult.risk_locations}
                />
              </div>
            )}

            {/* Rewrite Section */}
            <div
              className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
              style={{
                backgroundColor: 'var(--proxy-surface)',
                border: '1px solid var(--proxy-border-soft)',
              }}
            >
              <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                Öneri Yazı Oluştur
              </h2>
              
              <RewriteOptions
                selectedMode={rewriteMode}
                onModeChange={handleModeChange}
              />

              <button
                type="button"
                onClick={handleRewrite}
                disabled={rewriting || !analysisResult}
                className="w-full mt-6 py-4 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  backgroundColor: 'var(--proxy-action-primary)',
                  color: '#FFFFFF',
                }}
              >
                {rewriting ? 'Öneri Oluşturuluyor...' : 'Öneri Yazı Oluştur'}
              </button>
            </div>

            {/* Rewrite Result */}
            {rewriteResult && (
              <div
                className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                {/* Check if context preservation failed */}
                {rewriteResult.rewritten_content.includes('EZA müdahale etmez') ? (
                  // Context preservation failed - show message only
                  <div>
                    <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                      Öneri Oluşturulamadı
                    </h3>
                    <div
                      className="p-4 rounded-xl mb-4"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--proxy-danger)',
                      }}
                    >
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--proxy-text-primary)' }}>
                        {rewriteResult.rewritten_content}
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                      Riskli noktalar yukarıdaki analiz sonuçlarında işaretlendi. Düzenleme size bırakıldı.
                    </p>
                  </div>
                ) : (
                  // Context preserved - show rewrite suggestion
                  <>
                    <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                      Önerilen Metin
                    </h3>
                    
                    {/* Score Comparison */}
                    {rewriteResult.improvement && (
                      <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--proxy-bg-secondary)' }}>
                        <div className="grid grid-cols-5 gap-4 text-center">
                          {Object.entries(rewriteResult.improvement).map(([key, value]) => (
                            <div key={key}>
                              <div className="text-xs mb-1" style={{ color: 'var(--proxy-text-muted)' }}>
                                {key.replace('_', ' ')}
                              </div>
                              <div
                                className={`text-lg font-bold ${
                                  value > 0 ? 'text-[var(--proxy-success)]' : value < 0 ? 'text-[var(--proxy-danger)]' : 'text-[var(--proxy-text-muted)]'
                                }`}
                              >
                                {value > 0 ? '+' : ''}{value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className="p-4 rounded-xl mb-4"
                      style={{
                        backgroundColor: 'var(--proxy-bg-secondary)',
                        border: '1px solid var(--proxy-border-soft)',
                      }}
                    >
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--proxy-text-primary)' }}>
                        {rewriteResult.rewritten_content}
                      </p>
                    </div>

                    <p className="text-xs mb-4" style={{ color: 'var(--proxy-text-muted)' }}>
                      Bu bir öneridir. Orijinal metin korunmuştur. İstediğiniz değişiklikleri yapabilirsiniz.
                    </p>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(rewriteResult.rewritten_content);
                          setToast({
                            type: 'success',
                            message: 'Önerilen metin panoya kopyalandı',
                          });
                        } catch (err) {
                          console.error('Copy failed:', err);
                          setToast({
                            type: 'error',
                            message: 'Kopyalama başarısız oldu',
                          });
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--proxy-surface-hover)]"
                      style={{
                        backgroundColor: 'var(--proxy-surface)',
                        color: 'var(--proxy-text-primary)',
                        border: '1px solid var(--proxy-border-soft)',
                      }}
                    >
                      Öneriyi Kopyala
                    </button>
                  </>
                )}
              </div>
            )}
              </div>
            )}

            {/* Decision Justification Layer */}
            {analysisResult?.justification && analysisResult.justification.length > 0 && (
              <div
                className="rounded-2xl p-6 mt-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                  Karar Gerekçesi
                </h2>
                <DecisionJustification justification={analysisResult.justification} />
              </div>
            )}
          </TabPanel>

          {/* Telemetry Tab */}
          <TabPanel id="telemetry" activeTab={activeTab}>
            <div className="mt-6">
              <TelemetryDashboard />
            </div>
          </TabPanel>

          {/* Pipeline Tab */}
          <TabPanel id="pipeline" activeTab={activeTab}>
            <div className="mt-6">
              <PipelineDiagram />
            </div>
          </TabPanel>

          {/* History Tab */}
          <TabPanel id="history" activeTab={activeTab}>
            <div className="mt-6">
              <AnalysisHistoryPanel 
                history={analysisHistory}
                loading={historyLoading}
                onLoadMore={() => {
                  setHistoryPage(prev => prev + 1);
                  loadAnalysisHistory();
                }}
                onRefresh={loadAnalysisHistory}
              />
            </div>
          </TabPanel>

          {/* Audit Tab */}
          <TabPanel id="audit" activeTab={activeTab}>
            <div className="mt-6">
              <AuditPanel analysisId={analysisResult?.analysis_id} />
            </div>
          </TabPanel>
        </Tabs>

        {/* Error Display */}
        {error && (
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--proxy-danger)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--proxy-danger)' }}>{error}</p>
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
    </div>
  );
}

export default function ProxyCorporatePage() {
  return (
    <RequireAuth allowedRoles={['admin', 'corporate', 'proxy_user', 'reviewer', 'auditor', 'org_admin', 'ops']}>
      <ProxyOrganizationGuard>
        <ProxyCorporatePageContent />
      </ProxyOrganizationGuard>
    </RequireAuth>
  );
}

/**
 * Proxy Organization Guard
 * Ensures organization context is set before rendering Proxy pages
 */
function ProxyOrganizationGuard({ children }: { children: React.ReactNode }) {
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Wait for organization context to load
    if (orgLoading) {
      return;
    }

    // Check if organization is set
    if (!currentOrganization || !currentOrganization.id) {
      // Redirect to organization selection
      router.push('/proxy/select-organization');
      return;
    }

    // Validate organization has proxy_access
    if (!currentOrganization.proxy_access) {
      // Organization doesn't have proxy access, redirect to selection
      router.push('/proxy/select-organization');
      return;
    }

    setChecking(false);
  }, [currentOrganization, orgLoading, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1115' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: '#2563EB' }}></div>
          <p className="mt-4 text-sm" style={{ color: '#8E8E93' }}>
            Organizasyon kontrol ediliyor...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
