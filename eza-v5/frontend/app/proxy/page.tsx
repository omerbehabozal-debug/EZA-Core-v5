/**
 * EZA Proxy - Corporate Page
 * Dark Navy corporate theme, data-first approach
 * For banks, media, fintech, autonomous systems
 */

"use client";

import { useState } from "react";
import { analyzeProxy, rewriteProxy, ProxyAnalyzeResponse, ProxyRewriteResponse } from "@/api/proxy_corporate";
import RequireAuth from "@/components/auth/RequireAuth";
import UserProfileDropdown from "@/components/UserProfileDropdown";
import ScoreBars from "./components/ScoreBars";
import ComplianceMetrics from "./components/ComplianceMetrics";
import RiskFlags from "./components/RiskFlags";
import RewriteOptions from "./components/RewriteOptions";
import Tabs, { TabList, Tab, TabPanel } from "./components/Tabs";
import TelemetryDashboard from "./components/TelemetryDashboard";
import DecisionJustification from "./components/DecisionJustification";
import AuditPanel from "./components/AuditPanel";
import PipelineDiagram from "./components/PipelineDiagram";

function ProxyCorporatePageContent() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ProxyAnalyzeResponse | null>(null);
  const [rewriteResult, setRewriteResult] = useState<ProxyRewriteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analiz' | 'telemetry' | 'pipeline' | 'audit'>('analiz');
  
  // Configuration
  const [domain, setDomain] = useState<'finance' | 'health' | 'retail' | 'media' | 'autonomous' | ''>('');
  const [policies, setPolicies] = useState<('TRT' | 'FINTECH' | 'HEALTH')[]>([]);
  const [rewriteMode, setRewriteMode] = useState<'strict_compliance' | 'neutral_rewrite' | 'policy_bound' | 'autonomous_safety' | 'corporate_voice'>('neutral_rewrite');

  // Wrapper function to handle tab changes from Tabs component
  const handleTabChange = (tab: string) => {
    if (tab === 'analiz' || tab === 'telemetry' || tab === 'pipeline' || tab === 'audit') {
      setActiveTab(tab);
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
      const result = await analyzeProxy({
        content: content.trim(),
        input_type: 'text',
        policies: policies.length > 0 ? policies : undefined,
        domain: domain || undefined,
        provider: 'openai',
        return_report: true,
      });

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
        // Redirect to login after showing error
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (errorMessage.includes('API key required') || errorMessage.includes('X-Api-Key')) {
        userFriendlyMessage = 'API anahtarı gerekli. Lütfen Platform\'dan (platform.ezacore.ai) bir API anahtarı oluşturun veya yöneticinize başvurun.';
        // Optionally redirect to platform
        const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://platform.ezacore.ai';
        setTimeout(() => {
          if (confirm('API anahtarı oluşturmak için Platform\'a yönlendirilsin mi?')) {
            window.location.href = platformUrl;
          }
        }, 2000);
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
      const result = await rewriteProxy({
        content: content.trim(),
        mode: rewriteMode,
        policies: policies.length > 0 ? policies : undefined,
        domain: domain || undefined,
        provider: 'openai',
        auto_reanalyze: true,
      });

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
              <p className="text-sm" style={{ color: 'var(--proxy-text-secondary)' }}>
                Operational AI Safety Interface
              </p>
            </div>
            {/* User Profile Dropdown */}
            <UserProfileDropdown />
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
              <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                Analiz Sonuçları
              </h2>
              <ScoreBars scores={analysisResult.overall_scores} />
            </div>

            {/* Compliance Metrics */}
            <ComplianceMetrics
              policies={policies}
              complianceScore={analysisResult.overall_scores.compliance_score}
            />

            {/* Risk Flags */}
            <div
              className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
              style={{
                backgroundColor: 'var(--proxy-surface)',
                border: '1px solid var(--proxy-border-soft)',
              }}
            >
              <RiskFlags
                flags={analysisResult.flags}
                riskLocations={analysisResult.risk_locations}
              />
            </div>

            {/* Rewrite Section */}
            <div
              className="rounded-2xl p-6 transition-colors hover:bg-[var(--proxy-surface-hover)]"
              style={{
                backgroundColor: 'var(--proxy-surface)',
                border: '1px solid var(--proxy-border-soft)',
              }}
            >
              <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                Yeniden Yazma
              </h2>
              
              <RewriteOptions
                selectedMode={rewriteMode}
                onModeChange={handleModeChange}
              />

              <button
                type="button"
                onClick={handleRewrite}
                disabled={rewriting}
                className="w-full mt-6 py-4 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  backgroundColor: 'var(--proxy-action-primary)',
                  color: '#FFFFFF',
                }}
              >
                {rewriting ? 'Yeniden Yazılıyor...' : 'Yeniden Yaz'}
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
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--proxy-text-primary)', fontWeight: 600 }}>
                  Yeniden Yazılmış İçerik
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

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(rewriteResult.rewritten_content)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[var(--proxy-surface-hover)]"
                  style={{
                    backgroundColor: 'var(--proxy-surface)',
                    color: 'var(--proxy-text-primary)',
                    border: '1px solid var(--proxy-border-soft)',
                  }}
                >
                  Kopyala
                </button>
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
      </div>
    </div>
  );
}

export default function ProxyCorporatePage() {
  return (
    <RequireAuth allowedRoles={['admin', 'corporate']}>
      <ProxyCorporatePageContent />
    </RequireAuth>
  );
}
