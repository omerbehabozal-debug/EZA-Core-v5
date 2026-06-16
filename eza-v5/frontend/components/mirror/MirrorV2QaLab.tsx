'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildMirrorV2ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { buildMirrorStateV2 } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorStateV2';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import { buildVisualPayloadFromMirrorV2 } from '@/lib/eza/mirror/conversationMirrorV2/visualPayloadAdapter';
import { generateMirrorScene } from '@/lib/eza/mirror/generateSceneApi';
import {
  applyV2PosterBrandOverlayUrl,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/conversationMirrorV2/applyV2SceneOverlay';
import {
  MIRROR_V2_QA_SCENARIOS,
  MIRROR_V2_QA_SCORE_LABELS,
  readMirrorV2QaScores,
  saveMirrorV2QaScore,
  type MirrorV2QaScore,
} from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';
import { isMirrorPipelineV2, setDevMirrorPipeline } from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';

type ScenarioPreview = {
  payloadJson: string;
  prompt: string;
  seasonLabel: string;
  keywords: string;
  safety: string;
  title: string;
  mirrorText: string;
  closingLine?: string;
  selectedTopic: string;
  candidateTopicsJson: string;
};

function buildScenarioPreview(scenarioId: string): ScenarioPreview | null {
  const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  const entries = scenario.buildEntries();
  const payload = buildMirrorPayload(entries, {
    seed: `qa-${scenario.id}`,
    season: scenario.season,
    conversationId:
      scenario.id === 'toothpaste-choice'
        ? 'demo-toothpaste-thread'
        : `qa-${scenario.id}`,
  });
  const season = getSeasonProfile(payload.season);
  return {
    payloadJson: JSON.stringify(payload, null, 2),
    prompt: buildMirrorV2ImagePrompt(payload),
    seasonLabel: season.labelTr,
    keywords: payload.visualKeywords.join(', '),
    safety: payload.safetyLevel,
    title: payload.mirrorTitle,
    mirrorText: payload.mirrorText,
    closingLine: payload.closingLine,
    selectedTopic: payload.selectedTopic,
    candidateTopicsJson: JSON.stringify(payload.candidateTopics, null, 2),
  };
}

export default function MirrorV2QaLab() {
  const [activeId, setActiveId] = useState(MIRROR_V2_QA_SCENARIOS[0]?.id ?? '');
  const [scores, setScores] = useState<Record<string, MirrorV2QaScore>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [pipelineV2, setPipelineV2] = useState(false);

  useEffect(() => {
    setScores(readMirrorV2QaScores());
    setPipelineV2(isMirrorPipelineV2());
  }, []);

  useEffect(() => {
    return () => {
      revokePosterObjectUrl(previewUrl);
    };
  }, [previewUrl]);

  const preview = useMemo(() => buildScenarioPreview(activeId), [activeId]);
  const activeScore = scores[activeId] ?? {};

  const updateScore = useCallback(
    (key: keyof MirrorV2QaScore, value: number) => {
      const next = { ...activeScore, [key]: value };
      setScores((prev) => ({ ...prev, [activeId]: next }));
      saveMirrorV2QaScore(activeId, next);
    },
    [activeId, activeScore]
  );

  const enableV2Pipeline = useCallback(() => {
    setDevMirrorPipeline('v2');
    setPipelineV2(true);
  }, []);

  const handleGeneratePreview = useCallback(async () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === activeId);
    if (!scenario) return;
    setGenerating(true);
    setGenerateError(null);
    revokePosterObjectUrl(previewUrl);
    setPreviewUrl(null);
    try {
      const entries = scenario.buildEntries();
      const state = buildMirrorStateV2(entries, {
        seed: `qa-gen-${scenario.id}`,
      });
      const card = state.dailyMirrorCard;
      const visual = card.visual;
      if (!visual || !card.mirrorV2Payload) {
        throw new Error('V2 kart görseli oluşturulamadı');
      }
      const visualForApi = buildVisualPayloadFromMirrorV2(card.mirrorV2Payload);
      const result = await generateMirrorScene(visualForApi, card.date);
      const overlaid = await applyV2PosterBrandOverlayUrl(
        result.sceneImageUrl,
        card.mirrorV2Payload
      );
      setPreviewUrl(overlaid);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Sahne üretimi başarısız');
    } finally {
      setGenerating(false);
    }
  }, [activeId, previewUrl]);

  return (
    <div className="mirror-v2-lab min-h-[100dvh] overflow-y-auto bg-[#071018] px-4 py-6 text-[#f6f4ef] sm:px-8">
      <header className="mx-auto mb-6 max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e7b45b]/80">
          Dev QA
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mirror V2 Lab</h1>
        <p className="mt-2 max-w-2xl text-sm text-[rgba(246,244,239,0.72)]">
          11 senaryo için payload, topic seçimi, prompt, sezon ve güvenlik çıktıları. V2 pipeline:{' '}
          <span className={pipelineV2 ? 'text-emerald-400' : 'text-amber-300'}>
            {pipelineV2 ? 'aktif' : 'kapalı (V1)'}
          </span>
        </p>
        {!pipelineV2 ? (
          <button
            type="button"
            className="mt-3 rounded-full border border-[rgba(231,180,91,0.35)] px-4 py-2 text-xs font-semibold text-[#e7b45b]"
            onClick={enableV2Pipeline}
          >
            localStorage ile V2&apos;yi etkinleştir
          </button>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1">
          {MIRROR_V2_QA_SCENARIOS.map((scenario, index) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setActiveId(scenario.id)}
              className={cn(
                'rounded-xl px-3 py-2 text-left text-sm transition-colors',
                activeId === scenario.id
                  ? 'bg-[rgba(231,180,91,0.14)] text-[#f6f4ef]'
                  : 'text-[rgba(246,244,239,0.7)] hover:bg-[rgba(255,255,255,0.04)]'
              )}
            >
              <span className="text-[10px] text-[rgba(246,244,239,0.45)]">{index + 1}.</span>{' '}
              {scenario.label}
            </button>
          ))}
        </nav>

        <div className="space-y-5">
          {preview ? (
            <>
              <section className="rounded-2xl border border-[rgba(231,180,91,0.18)] bg-[rgba(255,255,255,0.03)] p-4">
                <h2 className="text-lg font-semibold text-[#e7b45b]">{preview.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[rgba(246,244,239,0.88)]">
                  {preview.mirrorText}
                </p>
                {preview.closingLine ? (
                  <p className="mt-2 text-xs italic text-[rgba(246,244,239,0.55)]">
                    {preview.closingLine}
                  </p>
                ) : null}
                <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[rgba(246,244,239,0.5)]">Selected topic</dt>
                    <dd>{preview.selectedTopic}</dd>
                  </div>
                  <div>
                    <dt className="text-[rgba(246,244,239,0.5)]">Season</dt>
                    <dd>{preview.seasonLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[rgba(246,244,239,0.5)]">Safety</dt>
                    <dd>{preview.safety}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[rgba(246,244,239,0.5)]">Visual keywords</dt>
                    <dd>{preview.keywords}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(246,244,239,0.55)]">
                  candidateTopics
                </h3>
                <pre className="max-h-40 overflow-auto text-[10px] leading-relaxed text-[rgba(246,244,239,0.8)]">
                  {preview.candidateTopicsJson}
                </pre>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(246,244,239,0.55)]">
                    SainaMirrorPayload
                  </h3>
                  <pre className="max-h-64 overflow-auto text-[10px] leading-relaxed text-[rgba(246,244,239,0.8)]">
                    {preview.payloadJson}
                  </pre>
                </div>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgba(246,244,239,0.55)]">
                    Prompt
                  </h3>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-[rgba(246,244,239,0.8)]">
                    {preview.prompt}
                  </pre>
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] p-4">
                <h3 className="text-sm font-semibold">QA matrisi (1–5)</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {MIRROR_V2_QA_SCORE_LABELS.map(({ key, label }) => (
                    <label key={key} className="flex flex-col gap-1 text-xs">
                      <span>{label}</span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={activeScore[key] ?? 3}
                        onChange={(e) => updateScore(key, Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => void handleGeneratePreview()}
                    className="rounded-full border border-[rgba(231,180,91,0.35)] bg-[rgba(231,180,91,0.12)] px-4 py-2 text-xs font-semibold text-[#e7b45b] disabled:opacity-50"
                  >
                    {generating ? 'Üretiliyor…' : 'Sahne + overlay önizle (auth gerekir)'}
                  </button>
                  {generateError ? (
                    <p className="text-xs text-amber-300">{generateError}</p>
                  ) : null}
                </div>
                {previewUrl ? (
                  <div className="mt-4 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Mirror V2 poster preview"
                      className="max-h-[70vh] w-auto max-w-full rounded-xl border border-[rgba(231,180,91,0.2)]"
                      style={{ aspectRatio: '4/5' }}
                    />
                  </div>
                ) : (
                  <div
                    className="mt-4 flex aspect-[4/5] max-w-sm items-end rounded-xl border border-dashed border-[rgba(231,180,91,0.2)] bg-[rgba(0,0,0,0.25)] p-4"
                    aria-hidden
                  >
                    <div>
                      <p className="text-lg font-semibold text-[#e7b45b]">{preview.title}</p>
                      <p className="mt-2 text-xs text-[rgba(246,244,239,0.7)]">{preview.mirrorText}</p>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
