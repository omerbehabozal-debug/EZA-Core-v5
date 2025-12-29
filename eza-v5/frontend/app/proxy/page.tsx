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
import AutoResizeTextarea from "./components/AutoResizeTextarea";
import ProcessingStateIndicator from "./components/ProcessingStateIndicator";
import { useProcessingState } from "@/hooks/useProcessingState";

function ProxyCorporatePageContent() {
  const { currentOrganization, isLoading: orgLoading, updateOrganization } = useOrganization();
  const [content, setContent] = useState("");
  
  // Processing state hooks (with analysis_mode from organization or result)
  const [currentAnalysisMode, setCurrentAnalysisMode] = useState<'fast' | 'pro'>('fast');
  
  // Load analysis_mode from organization when it changes
  useEffect(() => {
    if (currentOrganization?.analysis_mode) {
      setCurrentAnalysisMode(currentOrganization.analysis_mode);
    } else {
      // Default to 'fast' if not set
      setCurrentAnalysisMode('fast');
    }
  }, [currentOrganization?.analysis_mode]);
  
  const analyzeProcessing = useProcessingState({ 
    action: 'analyze',
    analysis_mode: currentAnalysisMode  // NEW: Pass analysis_mode for message differentiation
  });
  const rewriteProcessing = useProcessingState({ 
    action: 'rewrite',
    analysis_mode: currentAnalysisMode  // NEW: Pass analysis_mode for message differentiation
  });
  
  // Legacy loading states (kept for compatibility, but controlled by processing hooks)
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
  const [analyzingAllParagraphs, setAnalyzingAllParagraphs] = useState(false);
  
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
          message: 'Hazırlık analizi kaydedildi. Niyet kaydı oluşturuldu.',
        });
        
        // Always refresh history to show the new record
        loadAnalysisHistory();
      } else {
        console.error('[Proxy] Intent Log creation returned null');
        setError('Kayıt oluşturulamadı. Backend yanıt vermedi.');
      }
    } catch (err: any) {
      console.error('[Proxy] Save analysis error:', err);
      const errorMessage = err?.message || 'Hazırlık analizi kaydedilemedi.';
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
    if (!content.trim() || loading || analyzeProcessing.isProcessing) return;

    // Start processing state FIRST - before any async operations
    console.log('[Proxy] Starting analysis, calling analyzeProcessing.start()');
    analyzeProcessing.start();
    setLoading(true);
    setAnalysisResult(null);
    setRewriteResult(null);
    setError(null);
    
    // Small delay to ensure state is set before async operation
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Get organization ID from context
      const orgId = currentOrganization?.id || null;
      if (!orgId) {
        setError('Organizasyon seçilmedi. Lütfen bir organizasyon seçin.');
        analyzeProcessing.stop();
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
        // UI Response Contract: Handle staged responses
        const stagedResponse = result._staged_response;
        
        if (stagedResponse) {
          // Stage 1: Immediate score (show immediately)
          const immediate = stagedResponse.stage0_immediate;
          if (immediate && immediate.status === "score_ready") {
            // Update UI with immediate score (optimistic update)
            setAnalysisResult({
              ...result,
              overall_scores: {
                ethical_index: immediate.score,
                compliance_score: immediate.score + 10,
                manipulation_score: immediate.score - 5,
                bias_score: immediate.score,
                legal_risk_score: immediate.score + 5,
              }
            });
          }
          
          // Stage 2: Risk summary (show after a short delay)
          setTimeout(() => {
            const riskSummary = stagedResponse.stage0_risk_summary;
            if (riskSummary && riskSummary.status === "risk_summary") {
              // Risk summary is already in the full result, just log for now
              console.log('[UI Response] Risk summary:', riskSummary.types);
            }
          }, 100);
          
          // Stage 3: Final analysis (show complete result)
          // Full result is already set above, this is just for logging
          const complete = stagedResponse.stage1_complete;
          if (complete && complete.status === "analysis_complete") {
            console.log('[UI Response] Analysis complete:', complete.details);
          }
        }
        
        // Set final result (overwrites optimistic update)
        console.log('[Proxy] Analysis result:', {
          hasParagraphs: !!result.paragraphs,
          paragraphsCount: result.paragraphs?.length || 0,
          paragraphs: result.paragraphs,
          stage0Status: result._stage0_status,
          stage1Status: result._stage1_status,
          overallScores: result.overall_scores,
          analysisMode: result.analysis_mode
        });
        setAnalysisResult(result);
        
        // Update current analysis mode for processing state messages
        if (result.analysis_mode) {
          setCurrentAnalysisMode(result.analysis_mode);
        }
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
      // Don't stop immediately on error - let user see the processing state
      // Only stop after a short delay to show the state
      setTimeout(() => {
        analyzeProcessing.stop();
        setLoading(false);
      }, 1000); // Keep state visible for 1 second even on error
    }
  };

  const handleAnalyzeAllParagraphs = async () => {
    if (!analysisResult || !content.trim() || analyzingAllParagraphs) return;

    setAnalyzingAllParagraphs(true);
    setError(null);

    try {
      const orgId = currentOrganization?.id || null;
      if (!orgId) {
        setError('Organizasyon seçilmedi. Lütfen bir organizasyon seçin.');
        setAnalyzingAllParagraphs(false);
        return;
      }

      // Re-analyze with analyze_all_paragraphs flag
      const result = await analyzeProxy({
        content: content.trim(),
        input_type: 'text',
        policies: policies.length > 0 ? policies : undefined,
        domain: domain || undefined,
        provider: 'openai',
        return_report: true,
        analyze_all_paragraphs: true,  // Flag to analyze all paragraphs
      }, orgId);

      if (result) {
        setAnalysisResult(result);
        setToast({
          message: 'Tüm paragraflar analiz edildi.',
          type: 'success'
        });
      } else {
        setError('Tüm paragraflar analiz edilemedi.');
      }
    } catch (err: any) {
      setError(`Analiz hatası: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setAnalyzingAllParagraphs(false);
    }
  };

  const handleRewrite = async () => {
    if (!content.trim() || rewriting || rewriteProcessing.isProcessing || !analysisResult) return;

    // Start processing state
    rewriteProcessing.start();
    setRewriting(true);
    setRewriteResult(null);
    setError(null);

    try {
      // Get organization ID from context
      const orgId = currentOrganization?.id || null;
      if (!orgId) {
        setError('Organizasyon seçilmedi. Lütfen bir organizasyon seçin.');
        rewriteProcessing.stop();
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
      rewriteProcessing.stop();
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
                İçerik / Çıktı
              </label>
              <AutoResizeTextarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Analiz edilecek AI çıktısını buraya yazın..."
                disabled={loading}
                minHeight={120}
                maxHeight="40vh"
                className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--proxy-bg-secondary)',
                  border: '1px solid var(--proxy-border-soft)',
                  color: 'var(--proxy-text-primary)',
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  '--tw-ring-color': 'var(--proxy-action-primary)',
                } as React.CSSProperties}
              />
            </div>

            {/* Analysis Mode Toggle */}
            <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--proxy-bg-secondary)', border: '1px solid var(--proxy-border-soft)' }}>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--proxy-text-primary)' }}>
                Analiz Modu
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 p-3 rounded-lg cursor-pointer transition-all ${
                    currentAnalysisMode === 'fast' ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{
                    backgroundColor: currentAnalysisMode === 'fast' ? '#007AFF20' : 'transparent',
                    border: `1px solid ${currentAnalysisMode === 'fast' ? '#007AFF' : 'var(--proxy-border-soft)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="analysis_mode"
                    value="fast"
                    checked={currentAnalysisMode === 'fast'}
                    onChange={async () => {
                      if (currentOrganization?.id) {
                        const success = await updateOrganization(currentOrganization.id, { analysis_mode: 'fast' });
                        if (success) {
                          setCurrentAnalysisMode('fast');
                          setToast({ message: 'Analiz modu FAST olarak güncellendi', type: 'success' });
                        } else {
                          setToast({ message: 'Analiz modu güncellenemedi', type: 'error' });
                        }
                      }
                    }}
                    className="mr-2"
                    style={{ accentColor: '#007AFF' }}
                  />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--proxy-text-primary)' }}>
                      ⚡ FAST — Hızlı Analiz
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--proxy-text-muted)' }}>
                      Günlük içerikler için optimize edilmiş
                    </div>
                  </div>
                </label>
                <label
                  className={`flex-1 p-3 rounded-lg cursor-pointer transition-all ${
                    currentAnalysisMode === 'pro' ? 'ring-2 ring-purple-500' : ''
                  }`}
                  style={{
                    backgroundColor: currentAnalysisMode === 'pro' ? '#8B5CF620' : 'transparent',
                    border: `1px solid ${currentAnalysisMode === 'pro' ? '#8B5CF6' : 'var(--proxy-border-soft)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="analysis_mode"
                    value="pro"
                    checked={currentAnalysisMode === 'pro'}
                    onChange={async () => {
                      if (currentOrganization?.id) {
                        const success = await updateOrganization(currentOrganization.id, { analysis_mode: 'pro' });
                        if (success) {
                          setCurrentAnalysisMode('pro');
                          setToast({ message: 'Analiz modu PRO olarak güncellendi', type: 'success' });
                        } else {
                          setToast({ message: 'Analiz modu güncellenemedi', type: 'error' });
                        }
                      }
                    }}
                    className="mr-2"
                    style={{ accentColor: '#8B5CF6' }}
                  />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--proxy-text-primary)' }}>
                      🧠 PRO — Profesyonel Analiz
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--proxy-text-muted)' }}>
                      Derinlemesine bağlam analizi
                    </div>
                  </div>
                </label>
              </div>
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
                  <span className="ml-2 text-xs" style={{ color: 'var(--proxy-text-muted)' }} title="Bu politika seti, ilgili sektör için örnek bir uyum çerçevesidir. Proxy, sektör-bağımsız çalışır; yalnızca aktif politika seti değişir.">
                    ℹ️
                  </span>
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
              disabled={!content.trim() || loading || analyzeProcessing.isProcessing}
              className="w-full py-4 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                backgroundColor: 'var(--proxy-action-primary)',
                color: '#FFFFFF',
              }}
            >
              {loading || analyzeProcessing.isProcessing 
                ? (currentAnalysisMode === 'pro' ? 'Profesyonel Analiz Yapılıyor…' : 'Analiz Ediliyor…')
                : 'Analiz Et'}
            </button>

            {/* Processing State Indicator - Show below button for better visibility */}
            {(analyzeProcessing.isProcessing || loading) && (
              <div className="mt-4" style={{ minHeight: '80px' }}>
                <ProcessingStateIndicator
                  message={
                    analyzeProcessing.message || 
                    (loading 
                      ? (currentAnalysisMode === 'pro' 
                          ? 'Ön tarama tamamlandı. Profesyonel analiz başlatıldı.' 
                          : 'Analiz başlatılıyor...')
                      : 'İçerik alınıyor...')
                  }
                  isProcessing={analyzeProcessing.isProcessing || loading}
                />
                {/* PRO Mode Wait State Message */}
                {currentAnalysisMode === 'pro' && analyzeProcessing.isProcessing && (
                  <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <p className="text-xs" style={{ color: '#8E8E93' }}>
                      Bu analiz profesyonel modda çalışmaktadır. Daha yüksek kalite için biraz daha uzun sürebilir.
                    </p>
                  </div>
                )}
              </div>
            )}
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
                    {analysisResult.analysis_mode && (
                      <span 
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          analysisResult.analysis_mode === 'pro' 
                            ? 'bg-purple-500/20 text-purple-300' 
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                        title={analysisResult.analysis_mode === 'pro' 
                          ? 'Derinlemesine profesyonel analiz modu' 
                          : 'Hız odaklı analiz modu'}
                      >
                        {analysisResult.analysis_mode === 'pro' ? 'PRO (Profesyonel)' : 'FAST'}
                      </span>
                    )}
                    {analysisResult.ui_status_message && (
                      <span className="text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
                        {analysisResult.ui_status_message}
                      </span>
                    )}
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
                      <span>Hazırlık Analizi Kaydet</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--proxy-text-muted)' }}>
                Bu analiz hazırlık niyeti olarak kaydedilecek. Gerçek etki anlamına gelmez. Etkileşim Kaydı (Impact Event), yapay zekâ tarafından üretilen içeriğin kullanıcıya, müşteriye veya kamuya sunulduğu anı temsil eder.
              </p>
              <ScoreBars scores={analysisResult.overall_scores} />
            </div>

            {/* Compliance Metrics */}
            <ComplianceMetrics
              policies={policies}
              complianceScore={analysisResult.overall_scores.compliance_score}
            />

            {/* Paragraph-Based Analysis View (Premium Unified Flow) */}
            {analysisResult.paragraphs && Array.isArray(analysisResult.paragraphs) && analysisResult.paragraphs.length > 0 && (
              <div
                className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
                style={{
                  backgroundColor: 'var(--proxy-surface)',
                  border: '1px solid var(--proxy-border-soft)',
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                      {(() => {
                        // Dynamic title based on risk_band
                        const riskBand = analysisResult._stage0_status?.risk_band || analysisResult._stage0_result?.risk_band || 'low';
                        return riskBand === 'low' 
                          ? 'Analiz Özeti & Paragraf Görünümü'
                          : 'Detaylı Paragraf Analizi';
                      })()}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                      Metin paragraflara ayrılarak analiz edildi. Her paragraf için riskler, gerekçeler ve öneriler gösterilmektedir.
                    </p>
                  </div>
                </div>
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

              {/* Processing State Indicator for Rewrite */}
              {rewriteProcessing.isProcessing && (
                <ProcessingStateIndicator
                  message={rewriteProcessing.message}
                  isProcessing={rewriteProcessing.isProcessing}
                  className="mt-4"
                />
              )}

              <button
                type="button"
                onClick={handleRewrite}
                disabled={rewriting || rewriteProcessing.isProcessing || !analysisResult}
                className="w-full mt-6 py-4 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  backgroundColor: 'var(--proxy-action-primary)',
                  color: '#FFFFFF',
                }}
              >
                {rewriting || rewriteProcessing.isProcessing 
                  ? (currentAnalysisMode === 'pro' 
                      ? 'Profesyonel Yeniden Yazım Hazırlanıyor…' 
                      : 'Hızlı Yeniden Yazım Önerisi Hazırlanıyor…')
                  : (currentAnalysisMode === 'pro' 
                      ? 'Profesyonel Yeniden Yazım Oluştur' 
                      : 'Öneri Yazı Oluştur')}
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
                      {currentAnalysisMode === 'pro' 
                        ? 'Profesyonel yeniden yazım hazırlandı. Orijinal metin korunmuştur. İstediğiniz değişiklikleri yapabilirsiniz.'
                        : 'Hızlı yeniden yazım önerisi hazır. Orijinal metin korunmuştur. İstediğiniz değişiklikleri yapabilirsiniz.'}
                    </p>

                    {/* PRO Mode Rewrite Explanation (Org Admin Only) */}
                    {rewriteResult.rewrite_explanation && (
                      <div className="mt-6 p-4 rounded-xl border" style={{ 
                        backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                        borderColor: 'rgba(139, 92, 246, 0.3)' 
                      }}>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--proxy-text-primary)' }}>
                          <span className="text-purple-400">🔍</span>
                          Profesyonel Analiz Açıklaması (İç Kullanım)
                        </h4>
                        
                        {/* Detected Risks */}
                        {rewriteResult.rewrite_explanation.detected_risks.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--proxy-text-secondary)' }}>
                              Tespit Edilen Riskler:
                            </p>
                            <ul className="space-y-1">
                              {rewriteResult.rewrite_explanation.detected_risks.map((risk, idx) => (
                                <li key={idx} className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                              • Paragraf {risk.paragraph}: {risk.risk_type} ({risk.severity}) - {risk.count} adet
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Rewrite Actions */}
                        {rewriteResult.rewrite_explanation.rewrite_actions.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--proxy-text-secondary)' }}>
                              Yapılan Düzenlemeler:
                            </p>
                            <ul className="space-y-1">
                              {rewriteResult.rewrite_explanation.rewrite_actions.map((action, idx) => (
                                <li key={idx} className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                              • Paragraf {action.paragraph}: {action.action} - {action.preserved}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Preservation Notes */}
                        {rewriteResult.rewrite_explanation.preservation_notes.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--proxy-text-secondary)' }}>
                              Korunan Özellikler:
                            </p>
                            <ul className="space-y-1">
                              {rewriteResult.rewrite_explanation.preservation_notes.map((note, idx) => (
                                <li key={idx} className="text-xs" style={{ color: 'var(--proxy-text-muted)' }}>
                              ✓ {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Outcome Summary */}
                        {rewriteResult.rewrite_explanation.outcome_summary && (
                          <div className="pt-3 border-t" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--proxy-text-secondary)' }}>
                              <strong>Özet:</strong> {rewriteResult.rewrite_explanation.outcome_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

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

            {/* Decision Justification Layer - Only show if paragraph-based analysis is not available */}
            {analysisResult?.justification && 
             analysisResult.justification.length > 0 && 
             (!analysisResult.paragraphs || analysisResult.paragraphs.length === 0) && (
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
