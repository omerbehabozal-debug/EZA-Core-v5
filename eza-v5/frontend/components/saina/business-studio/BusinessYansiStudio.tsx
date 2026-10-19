'use client';

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Knowledge, Step, Draft } from '@/lib/eza/businessYansi';
import { businessRequest as api } from '@/lib/eza/businessYansi';
import {
  classifyStudioAvailability,
  fetchStudioGeneration,
  isBusinessApiError,
  isSuccessStudioStatus,
  isTerminalStudioStatus,
  newStudioIdempotencyKey,
  parseDraftResult,
  parseTopicsResult,
  pollStudioGeneration,
  requestStudioDraftGeneration,
  requestStudioTopics,
  studioErrorMessage,
  type StudioDraftResult,
  type StudioGeneration,
  type StudioTopic,
} from '@/lib/eza/businessStudio';
import StudioChatPreview from './StudioChatPreview';
import StudioGenerationStatus from './StudioGenerationStatus';
import StudioStepRail, { type StudioRailStep, type StudioRailStepId } from './StudioStepRail';

type Props = {
  businessId: string;
  knowledge: Knowledge[];
  canEdit: boolean;
  onDraftSaved: () => Promise<void> | void;
  editDraft?: Draft | null;
  onClearEdit?: () => void;
  onOpenKnowledgePool?: () => void;
};

type FlowPhase = 'sources' | 'topics' | 'chat' | 'preview';

const emptySteps = (): Step[] => Array.from({ length: 8 }, () => ({ question: '', answer: '', sources: [] }));

function publishedSources(knowledge: Knowledge[]): Knowledge[] {
  return knowledge.filter((k) => k.status === 'published' && k.public_allowed);
}

function hasFilledDraft(steps: Step[], title: string): boolean {
  return Boolean(title.trim()) && steps.every((s) => s.question.trim() && s.answer.trim() && s.sources[0]);
}

export default function BusinessYansiStudio({
  businessId,
  knowledge,
  canEdit,
  onDraftSaved,
  editDraft = null,
  onClearEdit,
  onOpenKnowledgePool,
}: Props) {
  const published = useMemo(() => publishedSources(knowledge), [knowledge]);
  const sourceTitles = useMemo(
    () => Object.fromEntries(published.map((k) => [k.id, k.title])),
    [published]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [topicHint, setTopicHint] = useState('');
  const [phase, setPhase] = useState<FlowPhase>(editDraft ? 'preview' : 'sources');
  const [manualOpen, setManualOpen] = useState(Boolean(editDraft));
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const [topicsJob, setTopicsJob] = useState<StudioGeneration | null>(null);
  const [topics, setTopics] = useState<StudioTopic[] | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const [draftJob, setDraftJob] = useState<StudioGeneration | null>(null);
  const [draftResult, setDraftResult] = useState<StudioDraftResult | null>(null);

  const [title, setTitle] = useState(editDraft?.title || '');
  const [summary, setSummary] = useState(editDraft?.summary || '');
  const [steps, setSteps] = useState<Step[]>(editDraft?.steps?.length === 8 ? editDraft.steps : emptySteps());

  const topicsKeyRef = useRef<string | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const base = `/${businessId}`;
  const hasTopics = Boolean(topics && topics.length > 0);
  const chatInProgress = phase === 'chat' && busy;
  const draftPending = Boolean(draftJob && !isTerminalStudioStatus(draftJob.status));

  const railSteps: StudioRailStep[] = useMemo(() => {
    const topicsUnlocked = hasTopics || phase === 'topics' || phase === 'chat' || phase === 'preview';
    const chatUnlocked = Boolean(draftResult) || draftPending || phase === 'chat' || phase === 'preview';
    const previewUnlocked = Boolean(draftResult) || Boolean(editDraft);

    return [
      {
        id: 'sources' as const,
        label: 'Kaynaklar',
        state: phase === 'sources' ? ('active' as const) : ('complete' as const),
      },
      {
        id: 'topics' as const,
        label: 'Konu',
        state:
          phase === 'topics'
            ? ('active' as const)
            : !topicsUnlocked
              ? ('locked' as const)
              : phase === 'sources'
                ? ('upcoming' as const)
                : ('complete' as const),
      },
      {
        id: 'chat' as const,
        label: 'Sohbet',
        state:
          phase === 'chat'
            ? ('active' as const)
            : !chatUnlocked
              ? ('locked' as const)
              : phase === 'preview'
                ? ('complete' as const)
                : ('upcoming' as const),
      },
      {
        id: 'preview' as const,
        label: 'Önizleme',
        state:
          phase === 'preview'
            ? ('active' as const)
            : !previewUnlocked
              ? ('locked' as const)
              : ('upcoming' as const),
      },
    ];
  }, [phase, hasTopics, draftResult, draftPending, editDraft]);

  const goToPhase = (id: StudioRailStepId) => {
    const target = railSteps.find((s) => s.id === id);
    if (!target || target.state === 'locked') return;
    if (id === 'sources' || id === 'topics' || id === 'chat' || id === 'preview') {
      setPhase(id);
      setError('');
    }
  };

  const toggleSource = (id: string) => {
    setSelectedIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 16) return cur;
      return [...cur, id];
    });
    // Changing sources invalidates downstream AI results (snapshot may go stale).
    setTopics(null);
    setTopicsJob(null);
    setSelectedTopicId(null);
    setDraftResult(null);
    setDraftJob(null);
    setEditingStep(null);
    topicsKeyRef.current = null;
    draftKeyRef.current = null;
  };

  const applyDraftToEditor = useCallback((candidate: StudioDraftResult) => {
    setTitle(candidate.title);
    setSummary(candidate.summary);
    setSteps(
      candidate.steps.map((s) => ({
        question: s.question,
        answer: s.answer,
        sources: [s.evidence.versionId],
      }))
    );
  }, []);

  const updateStepField = (index: number, patch: Partial<Step>) => {
    setSteps((old) => old.map((v, j) => (j === index ? { ...v, ...patch } : v)));
  };

  const runTopics = async () => {
    if (!canEdit || inFlightRef.current) return;
    setError('');
    setUnavailable(null);
    if (published.length === 0) {
      setError('Kullanıcılara açıklanmasına izin verilen Bilgi Havuzu kaydı yok. Önce Bilgi Havuzu’na kayıt ekleyin.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('En az bir yayımlanmış kaynak seçin.');
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    setPhase('topics');
    if (!topicsKeyRef.current) {
      topicsKeyRef.current = newStudioIdempotencyKey('topics');
    }
    const key = topicsKeyRef.current;

    try {
      let job = await requestStudioTopics(businessId, {
        idempotencyKey: key,
        sourceVersionIds: selectedIds,
        topicHint: topicHint.trim(),
      });

      // 202 / queued / running are not success — poll to terminal.
      if (!isTerminalStudioStatus(job.status)) {
        job = await pollStudioGeneration(businessId, job.generationId);
      }

      setTopicsJob(job);

      if (job.status === 'blocked' || !job.executionAvailable) {
        setTopics(null);
        setUnavailable(studioErrorMessage(job.errorCode || 'studio_execution_not_implemented'));
        return;
      }

      if (!isSuccessStudioStatus(job.status)) {
        setTopics(null);
        setError(studioErrorMessage(job.errorCode, 'Konu önerileri alınamadı.'));
        return;
      }

      const parsed = parseTopicsResult(job.result);
      if (!parsed) {
        setTopics(null);
        setError(
          job.errorCode === 'studio_insufficient_sources'
            ? studioErrorMessage('studio_insufficient_sources')
            : 'Sunucu konu listesi döndürmedi. Sahte öneri gösterilmez.'
        );
        return;
      }
      setTopics(parsed);
      setSelectedTopicId(null);
      setDraftResult(null);
      setDraftJob(null);
      draftKeyRef.current = null;
      setPhase('topics');
    } catch (err) {
      const avail = classifyStudioAvailability(err);
      if (!avail.available && isBusinessApiError(err) && (err.status === 503 || err.status === 404)) {
        setUnavailable(avail.message);
        setTopics(null);
      } else if (isBusinessApiError(err)) {
        setError(studioErrorMessage(err.code, err.message));
      } else {
        setError('Konu önerisi isteği başarısız oldu.');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const runDraftGeneration = async (topicId: string) => {
    if (!canEdit || inFlightRef.current || !topicsJob) return;
    setError('');
    setUnavailable(null);
    setSelectedTopicId(topicId);
    setPhase('chat');
    inFlightRef.current = true;
    setBusy(true);

    if (!draftKeyRef.current || draftKeyRef.current.indexOf(topicId) < 0) {
      draftKeyRef.current = newStudioIdempotencyKey(`draft.${topicId}`);
    }

    try {
      let job = await requestStudioDraftGeneration(businessId, {
        idempotencyKey: draftKeyRef.current,
        sourceVersionIds: selectedIds,
        expectedSnapshotHash: topicsJob.snapshotHash,
        topicsGenerationId: topicsJob.generationId,
        topicId,
        topicHint: topicHint.trim(),
      });

      if (!isTerminalStudioStatus(job.status)) {
        job = await pollStudioGeneration(businessId, job.generationId);
      }
      setDraftJob(job);

      if (job.status === 'blocked' || !job.executionAvailable) {
        setDraftResult(null);
        setUnavailable(studioErrorMessage(job.errorCode || 'studio_execution_not_implemented'));
        setPhase('topics');
        return;
      }

      if (!isSuccessStudioStatus(job.status)) {
        setDraftResult(null);
        setError(studioErrorMessage(job.errorCode, 'Sohbet üretimi başarısız oldu.'));
        setPhase('topics');
        return;
      }

      const parsed = parseDraftResult(job.result);
      if (!parsed) {
        setDraftResult(null);
        setError('Sunucu geçerli 8 adımlı sohbet döndürmedi. Sahte içerik gösterilmez.');
        setPhase('topics');
        return;
      }

      setDraftResult(parsed);
      applyDraftToEditor(parsed);
      setManualOpen(false);
      setEditingStep(null);
      setPhase('preview');
    } catch (err) {
      if (isBusinessApiError(err) && err.code === 'studio_snapshot_stale') {
        setError(studioErrorMessage('studio_snapshot_stale'));
        setTopics(null);
        setTopicsJob(null);
        topicsKeyRef.current = null;
        setPhase('sources');
      } else if (isBusinessApiError(err)) {
        const avail = classifyStudioAvailability(err);
        if (err.status === 503 || err.status === 404) setUnavailable(avail.message);
        else setError(studioErrorMessage(err.code, err.message));
        setPhase('topics');
      } else {
        setError('Sohbet üretimi isteği başarısız oldu.');
        setPhase('topics');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  const refreshDraftJob = async () => {
    if (!draftJob || inFlightRef.current) return;
    setBusy(true);
    try {
      const job = await fetchStudioGeneration(businessId, draftJob.generationId);
      setDraftJob(job);
      if (isSuccessStudioStatus(job.status)) {
        const parsed = parseDraftResult(job.result);
        if (parsed) {
          setDraftResult(parsed);
          applyDraftToEditor(parsed);
          setPhase('preview');
        }
      }
    } catch (err) {
      setError(isBusinessApiError(err) ? err.message : 'Durum yenilenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canEdit || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`${base}/drafts${editDraft ? '/' + editDraft.id : ''}`, editDraft ? 'PATCH' : 'POST', {
        title,
        summary,
        steps,
        ...(editDraft ? { revision: editDraft.revision } : {}),
      });
      onClearEdit?.();
      await onDraftSaved();
      setPhase('preview');
      setEditingStep(null);
    } catch (err) {
      if (isBusinessApiError(err)) setError(err.message);
      else setError('Taslak kaydedilemedi. Backend doğrulaması başarısız olabilir.');
    } finally {
      setBusy(false);
    }
  };

  const previewTurns = useMemo(() => {
    return steps.map((step, index) => {
      const evidence = draftResult?.steps[index]?.evidence ?? null;
      return {
        question: step.question || `Adım ${index + 1} sorusu henüz yok`,
        answer: step.answer || 'Cevap henüz yok',
        evidence,
        sourceLabel: sourceTitles[step.sources[0]] || sourceTitles[evidence?.versionId || ''],
      };
    });
  }, [steps, draftResult, sourceTitles]);

  if (!canEdit) {
    return (
      <p className="biz-empty" data-testid="biz-studio-readonly">
        Yansı Stüdyosu’nda AI üretim ve taslak düzenleme için editor veya owner yetkisi gerekir.
      </p>
    );
  }

  const showEmptyKnowledge = published.length === 0 && !editDraft;

  return (
    <div className="biz-studio" data-testid="biz-yansi-studio" data-phase={phase}>
      <div className="biz-studio-hero">
        <p className="biz-studio-eyebrow">AI Yansı Stüdyosu</p>
        <h2 className="biz-section-title">Kaynaklardan sohbet üret</h2>
        <p className="biz-section-lead">
          Adım adım ilerleyin. Kullanıcılara açıklanmasına izin verilen Bilgi Havuzu kayıtları kullanılır; owner onayı
          ve Ayna yayını bu akışın dışındadır.
        </p>
        <StudioStepRail steps={railSteps} onSelect={goToPhase} />
      </div>

      {unavailable ? (
        <div className="biz-studio-banner biz-studio-banner--warn" role="status" data-testid="biz-studio-unavailable">
          <strong>AI üretim şu an kullanılamıyor.</strong>
          <p>{unavailable}</p>
          <p>Sahte konu veya sohbet gösterilmez. Uygunsa gelişmiş manuel düzenlemeyi kullanın.</p>
        </div>
      ) : null}

      {error ? (
        <p className="biz-alert" role="alert" data-testid="biz-studio-error">
          {error}
        </p>
      ) : null}

      {/* —— 1. Kaynaklar —— */}
      {phase === 'sources' ? (
        <section className="biz-studio-panel" aria-labelledby="biz-studio-sources-title">
          <div className="biz-studio-panel-head">
            <h3 id="biz-studio-sources-title" className="biz-studio-panel-title">
              Kaynaklar
            </h3>
            <p className="biz-studio-count" data-testid="biz-studio-source-count">
              {published.length} uygun kaynak
              {selectedIds.length > 0 ? ` · ${selectedIds.length} seçili` : ''}
            </p>
          </div>

          {showEmptyKnowledge ? (
            <div className="biz-studio-empty" data-testid="biz-studio-no-sources">
              <p>
                Kullanıcılara açıklanmasına izin verilen Bilgi Havuzu kaydı yok. Önce Bilgi Havuzu’na kayıt ekleyin;
                sekiz soruluk manuel form burada açılmaz.
              </p>
              {onOpenKnowledgePool ? (
                <button
                  type="button"
                  className="biz-btn-primary"
                  onClick={onOpenKnowledgePool}
                  data-testid="biz-studio-goto-knowledge"
                >
                  Bilgi Havuzu’na git
                </button>
              ) : (
                <p className="biz-card-meta">Sol menüden Bilgi Havuzu sekmesine geçin.</p>
              )}
            </div>
          ) : (
            <>
              <ul className="biz-studio-source-list">
                {published.map((k) => {
                  const on = selectedIds.includes(k.id);
                  return (
                    <li key={k.id}>
                      <label className={`biz-studio-source${on ? ' is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleSource(k.id)}
                          disabled={busy}
                          data-testid={`biz-studio-source-${k.id}`}
                        />
                        <span>
                          <strong>{k.title}</strong>
                          <em>
                            {k.category || 'genel'} · v{k.version} · havuz
                          </em>
                          <small>{k.source}</small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <label className="biz-studio-hint">
                İsteğe bağlı yön (konu ipucu)
                <input
                  value={topicHint}
                  maxLength={500}
                  disabled={busy}
                  onChange={(e) => setTopicHint(e.target.value)}
                  placeholder="Örn. misafir deneyimi, menü hikâyesi…"
                  data-testid="biz-studio-topic-hint"
                />
              </label>
              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  disabled={busy || published.length === 0 || selectedIds.length === 0}
                  onClick={() => void runTopics()}
                  data-testid="biz-studio-suggest-topics"
                >
                  {busy ? 'Konular isteniyor…' : 'AI ile konu öner'}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* —— 2. Konu —— */}
      {phase === 'topics' ? (
        <section className="biz-studio-panel" aria-labelledby="biz-studio-topics-title">
          <div className="biz-studio-panel-head">
            <h3 id="biz-studio-topics-title" className="biz-studio-panel-title">
              Konu seçimi
            </h3>
            <button type="button" className="biz-studio-linkish" onClick={() => setPhase('sources')} disabled={busy}>
              ← Kaynaklara dön
            </button>
          </div>

          <StudioGenerationStatus
            generation={topicsJob}
            phaseLabel="Konu önerisi"
            busy={busy && !hasTopics}
          />

          {busy && !hasTopics ? (
            <p className="biz-empty" data-testid="biz-studio-topics-loading">
              Konu önerileri üretiliyor. Boş kart gösterilmez.
            </p>
          ) : null}

          {!busy && !hasTopics && !unavailable ? (
            <div className="biz-studio-empty" data-testid="biz-studio-topics-empty">
              <p>Henüz konu yok. Kaynaklardan “AI ile konu öner” ile devam edin.</p>
              <button type="button" className="biz-btn-primary" onClick={() => setPhase('sources')}>
                Kaynaklara dön
              </button>
            </div>
          ) : null}

          {hasTopics && topics ? (
            <div className="biz-studio-topic-grid" data-testid="biz-studio-topic-grid">
              {topics.map((topic) => {
                const selected = selectedTopicId === topic.id;
                const evidenceNote =
                  topic.evidence?.[0]?.text?.slice(0, 120) ||
                  (topic.answerPassageIds?.length
                    ? `${topic.answerPassageIds.length} kaynak pasajı`
                    : 'Kaynaklı öneri');
                return (
                  <article
                    key={topic.id}
                    className={`biz-studio-topic-card${selected ? ' is-selected' : ''}`}
                    data-testid={`biz-studio-topic-${topic.id}`}
                  >
                    <h4>{topic.title}</h4>
                    <p>{topic.description}</p>
                    <p className="biz-studio-topic-source">{evidenceNote}</p>
                    <button
                      type="button"
                      className="biz-btn-primary"
                      disabled={busy}
                      onClick={() => void runDraftGeneration(topic.id)}
                      data-testid={`biz-studio-generate-${topic.id}`}
                    >
                      {busy && selectedTopicId === topic.id ? 'Üretiliyor…' : 'Bu konuyla sohbet oluştur'}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* —— 3. Sohbet üretimi —— */}
      {phase === 'chat' ? (
        <section className="biz-studio-panel" aria-labelledby="biz-studio-chat-gen-title">
          <div className="biz-studio-panel-head">
            <h3 id="biz-studio-chat-gen-title" className="biz-studio-panel-title">
              Sohbet üretimi
            </h3>
            <button
              type="button"
              className="biz-studio-linkish"
              onClick={() => setPhase('topics')}
              disabled={busy}
            >
              ← Konuya dön
            </button>
          </div>
          <StudioGenerationStatus
            generation={draftJob}
            phaseLabel="Sekiz adımlı sohbet"
            busy={busy || draftPending}
          />
          <p className="biz-card-meta">
            Üretim tamamlanmadan önizleme açılmaz. HTTP 202 veya kuyruk durumu başarı sayılmaz. Tekrar tıklamayın —
            aynı işlem anahtarı ücretli yinelenen üretimi engeller.
          </p>
          {draftPending ? (
            <div className="biz-actions">
              <button type="button" disabled={busy} onClick={() => void refreshDraftJob()}>
                Durumu yenile
              </button>
            </div>
          ) : null}
          {chatInProgress ? (
            <p className="biz-empty" data-testid="biz-studio-chat-loading">
              Sohbet adımları üretiliyor…
            </p>
          ) : null}
        </section>
      ) : null}

      {/* —— 4. Önizleme / düzenleme —— */}
      {phase === 'preview' ? (
        <section className="biz-studio-panel biz-studio-panel--preview" aria-labelledby="biz-studio-preview-title">
          <div className="biz-studio-panel-head">
            <h3 id="biz-studio-preview-title" className="biz-studio-panel-title">
              Önizleme ve düzenleme
            </h3>
            <div className="biz-studio-preview-actions">
              {hasTopics ? (
                <button
                  type="button"
                  className="biz-studio-linkish"
                  onClick={() => setPhase('topics')}
                  disabled={busy}
                >
                  ← Konuya dön
                </button>
              ) : null}
              <button
                type="button"
                className="biz-studio-linkish"
                onClick={() => setManualOpen((v) => !v)}
                data-testid="biz-studio-toggle-manual"
              >
                {manualOpen ? 'Manuel formu gizle' : 'Gelişmiş manuel düzenleme'}
              </button>
            </div>
          </div>

          {(draftResult || hasFilledDraft(steps, title) || editDraft) && !manualOpen ? (
            <>
              <StudioChatPreview
                title={title}
                summary={summary}
                turns={previewTurns}
                editingStep={editingStep}
                onSelectStep={(index) => setEditingStep((cur) => (cur === index ? null : index))}
                onTitleChange={setTitle}
                onSummaryChange={setSummary}
                titleEditable
                disabled={busy}
              />

              {editingStep !== null && steps[editingStep] ? (
                <div className="biz-studio-step-editor" data-testid={`biz-studio-step-editor-${editingStep}`}>
                  <h4>Adım {editingStep + 1} düzenle</h4>
                  <label>
                    Soru
                    <input
                      aria-label={`${editingStep + 1}. soru`}
                      value={steps[editingStep].question}
                      disabled={busy}
                      onChange={(e) => updateStepField(editingStep, { question: e.target.value })}
                    />
                  </label>
                  <label>
                    Cevap
                    <textarea
                      aria-label={`${editingStep + 1}. cevap`}
                      value={steps[editingStep].answer}
                      maxLength={4000}
                      rows={4}
                      disabled={busy}
                      onChange={(e) => updateStepField(editingStep, { answer: e.target.value })}
                    />
                  </label>
                  <label>
                    Kaynak
                    <select
                      aria-label={`${editingStep + 1}. kaynak`}
                      value={steps[editingStep].sources[0] || ''}
                      disabled={busy}
                      onChange={(e) => updateStepField(editingStep, { sources: [e.target.value] })}
                    >
                      <option value="">Yayımlanmış kaynak seç</option>
                      {published.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title} v{k.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="biz-actions">
                    <button type="button" onClick={() => setEditingStep(null)} disabled={busy}>
                      Düzenlemeyi kapat
                    </button>
                  </div>
                </div>
              ) : null}

              {draftJob?.draftId ? (
                <p className="biz-notice" role="status">
                  Backend taslak kimliği: {draftJob.draftId}. Kaydetmeden önce metni gözden geçirin; incelemeye gönderme
                  owner onayını atlamaz.
                </p>
              ) : (
                <p className="biz-notice" role="status">
                  Taslağı kaydetmek mevcut Business draft API doğrulamasını çalıştırır.
                </p>
              )}

              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  disabled={busy}
                  onClick={() => void saveDraft()}
                  data-testid="biz-studio-save-draft"
                >
                  {busy ? 'Kaydediliyor…' : editDraft ? 'Taslağı güncelle' : 'Taslağı kaydet'}
                </button>
                {editDraft ? (
                  <button type="button" disabled={busy} onClick={() => onClearEdit?.()}>
                    Düzenlemeyi bırak
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {manualOpen ? (
            <form
              className="biz-form biz-studio-manual"
              onSubmit={(e) => void saveDraft(e)}
              data-testid="biz-studio-manual-form"
            >
              <p className="biz-card-meta">
                Gelişmiş manuel düzenleme isteğe bağlıdır. Varsayılan deneyim sohbet önizlemesidir.
              </p>
              <label>
                Başlık
                <input
                  aria-label="Yansı başlığı"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Özet
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} />
              </label>
              <div className="biz-step-grid">
                {steps.map((s, i) => (
                  <div className="biz-step" key={i}>
                    <h3>{i + 1}. adım</h3>
                    <label>
                      Soru
                      <input
                        aria-label={`${i + 1}. soru`}
                        value={s.question}
                        onChange={(e) => updateStepField(i, { question: e.target.value })}
                        required
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Cevap
                      <textarea
                        aria-label={`${i + 1}. cevap`}
                        value={s.answer}
                        maxLength={4000}
                        onChange={(e) => updateStepField(i, { answer: e.target.value })}
                        required
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Kaynak
                      <select
                        aria-label={`${i + 1}. kaynak`}
                        value={s.sources[0] || ''}
                        onChange={(e) => updateStepField(i, { sources: [e.target.value] })}
                        required
                        disabled={busy}
                      >
                        <option value="">Yayımlanmış kaynak seç</option>
                        {published.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.title} v{k.version}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <div className="biz-actions">
                <button type="submit" className="biz-btn-primary" disabled={busy} data-testid="biz-studio-save-draft">
                  {busy ? 'Kaydediliyor…' : editDraft ? 'Taslağı güncelle' : 'Taslağı kaydet'}
                </button>
                {editDraft ? (
                  <button type="button" disabled={busy} onClick={() => onClearEdit?.()}>
                    Düzenlemeyi bırak
                  </button>
                ) : null}
              </div>
              <p className="biz-card-meta">
                Kayıt, mevcut Business draft API’sinin doğrulamasından geçer. İncelemeye gönderme ve owner onayı ayrı
                adımlardır.
              </p>
            </form>
          ) : null}

          {!draftResult && !editDraft && !hasFilledDraft(steps, title) && !manualOpen ? (
            <div className="biz-studio-empty" data-testid="biz-studio-preview-empty">
              <p>Önizlenecek sohbet yok. Önce kaynaklardan konu ve sohbet üretin.</p>
              <button type="button" className="biz-btn-primary" onClick={() => setPhase('sources')}>
                Kaynaklara dön
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
