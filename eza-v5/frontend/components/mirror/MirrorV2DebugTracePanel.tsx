'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MirrorV2DebugTrace } from '@/lib/eza/mirror/conversationMirrorV2/mirrorDebugTypes';

type SectionId =
  | 'raw'
  | 'signals'
  | 'clusters'
  | 'selection'
  | 'story'
  | 'scene'
  | 'payload'
  | 'prompt'
  | 'quality'
  | 'flags';

const SECTIONS: { id: SectionId; title: string; step: number }[] = [
  { id: 'raw', title: 'Raw Conversation', step: 1 },
  { id: 'signals', title: 'Signal Extraction', step: 2 },
  { id: 'clusters', title: 'Topic Clustering', step: 3 },
  { id: 'selection', title: 'Topic Selection', step: 4 },
  { id: 'story', title: 'Mirror Story Engine', step: 5 },
  { id: 'scene', title: 'Scene Generation', step: 6 },
  { id: 'payload', title: 'Final Payload', step: 7 },
  { id: 'prompt', title: 'OpenAI Prompt', step: 8 },
  { id: 'quality', title: 'Quality Evaluation', step: 9 },
  { id: 'flags', title: 'Red Flag Detector', step: 10 },
];

function TraceSection({
  title,
  step,
  children,
  defaultOpen = true,
}: {
  title: string;
  step: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgba(246,244,239,0.55)]">
          <span className="mr-2 text-[#e7b45b]">{step}.</span>
          {title}
        </span>
        <span className="text-[10px] text-[rgba(246,244,239,0.4)]">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-4">{children}</div> : null}
    </section>
  );
}

function MonoBlock({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={cn(
        'overflow-auto whitespace-pre-wrap rounded-xl bg-[rgba(0,0,0,0.35)] p-3 text-[11px] leading-relaxed text-[rgba(246,244,239,0.88)]',
        className
      )}
    >
      {children}
    </pre>
  );
}

export type MirrorV2DebugTracePanelProps = {
  trace: MirrorV2DebugTrace;
};

export default function MirrorV2DebugTracePanel({ trace }: MirrorV2DebugTracePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trace.openAiPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [trace.openAiPrompt]);

  const alignmentColor = useMemo(() => {
    if (trace.quality.alignmentScore >= 80) return 'text-emerald-400';
    if (trace.quality.alignmentScore >= 55) return 'text-amber-300';
    return 'text-red-400';
  }, [trace.quality.alignmentScore]);

  return (
    <div className="space-y-4" data-testid="mirror-v2-debug-trace">
      <header className="rounded-2xl border border-[rgba(231,180,91,0.22)] bg-[rgba(231,180,91,0.06)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e7b45b]/90">
          Debug Trace
        </p>
        <h2 className="mt-1 text-lg font-semibold">Mirror V2 Karar Zinciri</h2>
        <p className="mt-2 text-xs text-[rgba(246,244,239,0.65)]">
          conversationId: <span className="text-[#f6f4ef]">{trace.conversationId}</span> · seed:{' '}
          <span className="text-[#f6f4ef]">{trace.seed}</span>
        </p>
      </header>

      <TraceSection title="RAW CONVERSATION" step={1}>
        <div className="space-y-3">
          {trace.rawConversation.map((msg) => (
            <div
              key={msg.index}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#e7b45b]/80">
                Message {msg.index}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#f6f4ef]">&quot;{msg.text}&quot;</p>
              {msg.mirrorCueHints?.length ? (
                <p className="mt-2 text-[10px] text-[rgba(246,244,239,0.5)]">
                  Cues: {msg.mirrorCueHints.join(', ')}
                  {msg.engagementScore != null ? ` · engagement ${msg.engagementScore}` : ''}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </TraceSection>

      <TraceSection title="SIGNAL EXTRACTION" step={2}>
        <p className="mb-3 text-xs text-[rgba(246,244,239,0.6)]">
          Sistem bu mesajlardan hangi sinyalleri çıkardı?
        </p>
        <div className="space-y-2">
          {trace.signals.map((sig) => (
            <div
              key={sig.signal}
              className="rounded-lg border border-[rgba(255,255,255,0.05)] px-3 py-2 text-[11px]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[#f6f4ef]">{sig.signal}</span>
                <span className="text-[#e7b45b]">score {sig.score}</span>
              </div>
              <p className="mt-1 text-[rgba(246,244,239,0.5)]">
                sourceMessages: [{sig.sourceMessages.join(', ')}]
              </p>
            </div>
          ))}
          {!trace.signals.length ? (
            <p className="text-xs text-amber-300">Sinyal çıkarılamadı — mirrorCueHints boş.</p>
          ) : null}
        </div>
      </TraceSection>

      <TraceSection title="TOPIC CLUSTERING" step={3}>
        <MonoBlock>{JSON.stringify(trace.candidateTopics, null, 2)}</MonoBlock>
      </TraceSection>

      <TraceSection title="TOPIC SELECTION" step={4}>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-[rgba(246,244,239,0.5)]">
              Selected Topic
            </dt>
            <dd className="text-lg font-semibold text-[#e7b45b]">{trace.topicSelection.selectedTopic}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-[rgba(246,244,239,0.5)]">Method</dt>
            <dd>{trace.topicSelection.method}</dd>
          </div>
          {trace.topicSelection.dominantRatio != null ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-[rgba(246,244,239,0.5)]">
                Dominant ratio
              </dt>
              <dd>{Math.round(trace.topicSelection.dominantRatio * 100)}%</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-[rgba(246,244,239,0.5)]">
              Consistency
            </dt>
            <dd>{trace.topicSelection.conversationConsistency}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgba(246,244,239,0.5)]">
            Reason
          </p>
          <MonoBlock className="mt-2">{trace.topicSelection.reasonLines.join('\n')}</MonoBlock>
        </div>
      </TraceSection>

      <TraceSection title="MIRROR STORY ENGINE" step={5}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-[rgba(246,244,239,0.5)]">Narrative Theme</dt>
            <dd>{trace.storyEngine.narrativeTheme}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[rgba(246,244,239,0.5)]">Emotional Tone</dt>
            <dd className="capitalize">{trace.storyEngine.emotionalTone}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[rgba(246,244,239,0.5)]">Archetype</dt>
            <dd>{trace.storyEngine.archetype}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[rgba(246,244,239,0.5)]">Relationship Mode</dt>
            <dd>{trace.storyEngine.relationshipMode}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase text-[rgba(246,244,239,0.5)]">
            Mirror Title Candidates
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {trace.storyEngine.mirrorTitleCandidates.map((title) => (
              <li
                key={title}
                className={cn(
                  title === trace.storyEngine.selectedMirrorTitle
                    ? 'font-semibold text-[#e7b45b]'
                    : 'text-[rgba(246,244,239,0.75)]'
                )}
              >
                {title === trace.storyEngine.selectedMirrorTitle ? '→ ' : '· '}
                {title}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[rgba(246,244,239,0.6)]">
            {trace.storyEngine.mirrorTitleReason}
          </p>
        </div>
      </TraceSection>

      <TraceSection title="SCENE GENERATION" step={6} defaultOpen={false}>
        <p className="text-[10px] font-semibold uppercase text-[rgba(246,244,239,0.5)]">
          Scene Candidates
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {trace.storyEngine.sceneMetaphorCandidates.map((scene) => (
            <li
              key={scene}
              className={cn(
                scene === trace.storyEngine.selectedSceneMetaphor
                  ? 'font-semibold text-[#e7b45b]'
                  : 'text-[rgba(246,244,239,0.75)]'
              )}
            >
              {scene === trace.storyEngine.selectedSceneMetaphor ? '→ ' : '· '}
              {scene}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[rgba(246,244,239,0.65)]">
          {trace.storyEngine.sceneMetaphorReason}
        </p>
      </TraceSection>

      <TraceSection title="FINAL PAYLOAD" step={7} defaultOpen={false}>
        <MonoBlock className="max-h-80">{JSON.stringify(trace.payload, null, 2)}</MonoBlock>
      </TraceSection>

      <TraceSection title="OPENAI PROMPT" step={8}>
        <textarea
          readOnly
          value={trace.openAiPrompt}
          className="h-64 w-full resize-y rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.35)] p-3 font-mono text-[11px] leading-relaxed text-[rgba(246,244,239,0.9)]"
        />
        <button
          type="button"
          onClick={() => void handleCopyPrompt()}
          className="mt-2 rounded-full border border-[rgba(231,180,91,0.35)] px-3 py-1.5 text-[11px] font-semibold text-[#e7b45b]"
        >
          {copied ? 'Kopyalandı' : 'Promptu kopyala'}
        </button>
      </TraceSection>

      <TraceSection title="QUALITY EVALUATION" step={9}>
        <p className={cn('text-3xl font-semibold', alignmentColor)}>
          Alignment Score: {trace.quality.alignmentScore}
        </p>
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase text-[rgba(246,244,239,0.5)]">Reason</p>
          <MonoBlock className="mt-2">{trace.quality.reasonLines.join('\n\n')}</MonoBlock>
        </div>
      </TraceSection>

      <TraceSection title="RED FLAG DETECTOR" step={10}>
        {trace.quality.redFlags.length ? (
          <div className="space-y-3">
            {trace.quality.redFlags.map((flag, i) => (
              <div
                key={`${flag.mirrorTitle}-${i}`}
                className={cn(
                  'rounded-xl border p-4',
                  flag.severity === 'critical'
                    ? 'border-red-500/40 bg-red-950/30'
                    : 'border-amber-400/35 bg-amber-950/20'
                )}
              >
                <p className="text-sm font-bold text-amber-200">{flag.title}</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <div>
                    <dt className="text-[rgba(246,244,239,0.5)]">Conversation Topic</dt>
                    <dd>{flag.conversationTopic}</dd>
                  </div>
                  <div>
                    <dt className="text-[rgba(246,244,239,0.5)]">Mirror Title</dt>
                    <dd className="font-medium">{flag.mirrorTitle}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-[rgba(246,244,239,0.8)]">
                  {flag.reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-emerald-400">
            Kopukluk tespit edilmedi — kart ile sohbet arasında belirgin uyumsuzluk yok.
          </p>
        )}
      </TraceSection>
    </div>
  );
}
