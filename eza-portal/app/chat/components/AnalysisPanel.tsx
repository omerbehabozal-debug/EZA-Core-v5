"use client";

import { useState } from "react";
import { useChatStore } from "@/stores/chatStore";
import ScoreBadge from "./ScoreBadge";
import ScoreBreakdown from "./ScoreBreakdown";
import LoadingSkeleton from "./LoadingSkeleton";
import ErrorBox from "./ErrorBox";

type TabType = "overview" | "intent" | "risk" | "bias" | "moral" | "memory";

const tabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "intent", label: "Intent" },
  { id: "risk", label: "Risk" },
  { id: "bias", label: "Bias" },
  { id: "moral", label: "Moral Compass" },
  { id: "memory", label: "Memory Check" },
];

export default function AnalysisPanel() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const analysis = useChatStore((s) => s.analysis);
  const messages = useChatStore((s) => s.messages);
  const selectedMessageIndex = useChatStore((s) => s.selectedMessageIndex);
  const engineMode = useChatStore((s) => s.engineMode);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(false);

  // Get analysis for selected message or latest
  // For now, we use the latest analysis for all messages
  // In a full implementation, you'd store analysis per message
  const currentAnalysis = analysis;

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!currentAnalysis) {
    return (
      <div className="w-full p-4">
        <div className="text-text-dim text-sm text-center py-8">
          ⓘ Analiz sonuçları burada görünecek.
          <br />
          <span className="text-xs mt-2 block">
            Bir mesaja tıklayarak analizini görüntüleyebilirsiniz.
          </span>
        </div>
      </div>
    );
  }

  const rawData = currentAnalysis._raw || currentAnalysis;

  // Extract data
  const ezaScore = currentAnalysis.eza_score?.eza_score ?? 
                   currentAnalysis.eza_score ?? 
                   rawData.eza_alignment?.alignment_score ?? 
                   rawData.reasoning_shield?.alignment_score ?? 
                   rawData.eza_score?.eza_score ?? null;

  const riskLevel = rawData.reasoning_shield?.final_risk_level ?? 
                    rawData.risk_level ?? 
                    rawData.final_verdict?.level ?? null;

  const intent = rawData.intent?.primary ?? 
                 rawData.intent_engine?.primary ?? 
                 currentAnalysis.intent?.level ?? null;

  const intentScore = rawData.intent_engine?.risk_score ?? 
                      rawData.intent?.risk_score ?? null;

  const criticalBias = rawData.critical_bias ?? currentAnalysis.critical_bias;
  const moralCompass = rawData.moral_compass ?? currentAnalysis.moral_compass;
  const abuse = rawData.abuse ?? currentAnalysis.abuse;
  const memoryConsistency = rawData.memory_consistency ?? currentAnalysis.memory_consistency;
  const driftMatrix = rawData.drift_matrix;
  const finalVerdict = rawData.final_verdict ?? currentAnalysis.final_verdict;
  const reasoningShield = rawData.reasoning_shield;
  const deception = rawData.deception;
  const psychologicalPressure = rawData.psychological_pressure;
  const legalRisk = rawData.legal_risk;

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-panel/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-accent/20 text-accent"
                : "text-text-dim hover:text-text hover:bg-panel/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4 animate-fade-in">
            {/* EZA Score - Radial Display */}
            <div className="flex flex-col items-center justify-center py-6 glass rounded-xl border border-panel/50">
              <div className="relative w-32 h-32 mb-4">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-panel"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(ezaScore || 0) * 351.86} 351.86`}
                    className="text-accent transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-accent">{ezaScore ?? "—"}</div>
                    <div className="text-xs text-text-dim">EZA Score</div>
                  </div>
                </div>
              </div>
              {riskLevel && (
                <ScoreBadge
                  score={riskLevel}
                  level={riskLevel as any}
                  label="Risk Level"
                />
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              {intent && (
                <div className="glass rounded-lg p-3 border border-panel/50">
                  <div className="text-xs text-text-dim mb-1">Intent</div>
                  <div className="text-sm font-semibold text-text">{intent}</div>
                </div>
              )}
              {intentScore !== null && (
                <div className="glass rounded-lg p-3 border border-panel/50">
                  <div className="text-xs text-text-dim mb-1">Intent Score</div>
                  <div className="text-sm font-semibold text-text">{intentScore.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            {criticalBias && (
              <ScoreBreakdown
                title="Critical Bias"
                data={criticalBias}
                collapsible={true}
              />
            )}
            {moralCompass && (
              <ScoreBreakdown
                title="Moral Compass"
                data={moralCompass}
                collapsible={true}
              />
            )}
            {abuse && (
              <ScoreBreakdown
                title="Abuse & Coercion"
                data={abuse}
                collapsible={true}
              />
            )}
          </div>
        )}

        {/* Intent Tab */}
        {activeTab === "intent" && (
          <div className="space-y-4 animate-fade-in">
            {intent && (
              <ScoreBreakdown
                title="Primary Intent"
                data={{ primary: intent, score: intentScore }}
                collapsible={false}
              />
            )}
            {rawData.intent_engine && (
              <ScoreBreakdown
                title="Intent Engine Details"
                data={rawData.intent_engine}
                collapsible={true}
              />
            )}
            {rawData.intent && (
              <ScoreBreakdown
                title="Intent Analysis"
                data={rawData.intent}
                collapsible={true}
              />
            )}
          </div>
        )}

        {/* Risk Tab */}
        {activeTab === "risk" && (
          <div className="space-y-4 animate-fade-in">
            {reasoningShield && (
              <ScoreBreakdown
                title="Reasoning Shield"
                data={reasoningShield}
                collapsible={true}
              />
            )}
            {deception && (
              <ScoreBreakdown
                title="Deception Detection"
                data={deception}
                collapsible={true}
              />
            )}
            {psychologicalPressure && (
              <ScoreBreakdown
                title="Psychological Pressure"
                data={psychologicalPressure}
                collapsible={true}
              />
            )}
            {legalRisk && (
              <ScoreBreakdown
                title="Legal Risk"
                data={legalRisk}
                collapsible={true}
              />
            )}
            {finalVerdict && (
              <ScoreBreakdown
                title="Final Verdict"
                data={finalVerdict}
                collapsible={true}
              />
            )}
          </div>
        )}

        {/* Bias Tab */}
        {activeTab === "bias" && criticalBias && (
          <div className="space-y-4 animate-fade-in">
            <ScoreBreakdown
              title="Critical Bias Analysis"
              data={criticalBias}
              collapsible={false}
            />
          </div>
        )}

        {/* Moral Compass Tab */}
        {activeTab === "moral" && moralCompass && (
          <div className="space-y-4 animate-fade-in">
            <ScoreBreakdown
              title="Moral Compass Analysis"
              data={moralCompass}
              collapsible={false}
            />
          </div>
        )}

        {/* Memory Check Tab */}
        {activeTab === "memory" && (
          <div className="space-y-4 animate-fade-in">
            {memoryConsistency && (
              <ScoreBreakdown
                title="Memory Consistency"
                data={memoryConsistency}
                collapsible={true}
              />
            )}
            {driftMatrix && (
              <ScoreBreakdown
                title="Drift Matrix"
                data={driftMatrix}
                collapsible={true}
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {activeTab !== "overview" && 
         !intent && 
         !criticalBias && 
         !moralCompass && 
         !memoryConsistency && (
          <div className="text-center py-8 text-text-dim text-sm">
            Bu sekme için analiz verisi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

