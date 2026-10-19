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

type Props = {
  businessId: string;
  knowledge: Knowledge[];
  canEdit: boolean;
  onDraftSaved: () => Promise<void> | void;
  editDraft?: Draft | null;
  onClearEdit?: () => void;
};

type FlowPhase = 'sources' | 'topics' | 'generating' | 'preview' | 'manual';

const emptySteps = (): Step[] => Array.from({ length: 8 }, () => ({ question: '', answer: '', sources: [] }));

function publishedSources(knowledge: Knowledge[]): Knowledge[] {
  return knowledge.filter((k) => k.status === 'published' && k.public_allowed);
}

export default function BusinessYansiStudio({
  businessId,
  knowledge,
  canEdit,
  onDraftSaved,
  editDraft = null,
  onClearEdit,
}: Props) {
  const published = useMemo(() => publishedSources(knowledge), [knowledge]);
  const sourceTitles = useMemo(
    () => Object.fromEntries(published.map((k) => [k.id, k.title])),
    [published]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [topicHint, setTopicHint] = useState('');
  const [phase, setPhase] = useState<FlowPhase>('sources');
  const [manualOpen, setManualOpen] = useState(false);
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

  const toggleSource = (id: string) => {
    setSelectedIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 16) return cur;
      return [...cur, id];
    });
    setTopics(null);
    setTopicsJob(null);
    setSelectedTopicId(null);
    setDraftResult(null);
    setDraftJob(null);
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

  const runTopics = async () => {
    if (!canEdit || inFlightRef.current) return;
    setError('');
    setUnavailable(null);
    if (published.length === 0) {
      setError('Yayımlanmış ve herkese açık Bilgi Havuzu kaydı yok. Önce kaynak ekleyip onaylatın.');
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

      if (!isTerminalStudioStatus(job.status)) {
        job = await pollStudioGeneration(businessId, job.generationId);
      }

      setTopicsJob(job);

      if (job.status === 'blocked' || !job.executionAvailable) {
        setTopics(null);
        setUnavailable(
          studioErrorMessage(job.errorCode || 'studio_execution_not_implemented')
        );
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
    } catch (err) {
      const avail = classifyStudioAvailability(err);
      if (!avail.available && (isBusinessApiError(err) && (err.status === 503 || err.status === 404))) {
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
    setPhase('generating');
    inFlightRef.current = true;
    setBusy(true);

    // New topic selection → new draft idempotency key (same topic reuses key).
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
        setUnavailable(
          studioErrorMessage(job.errorCode || 'studio_execution_not_implemented')
        );
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

  const saveDraft = async (event: FormEvent) => {
    event.preventDefault();
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
    } catch (err) {
      if (isBusinessApiError(err)) setError(err.message);
      else setError('Taslak kaydedilemedi. Backend doğrulaması başarısız olabilir.');
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) {
    return (
      <p className="biz-empty" data-testid="biz-studio-readonly">
        Yansı Stüdyosu’nda AI üretim ve taslak düzenleme için editor veya owner yetkisi gerekir.
      </p>
    );
  }

  return (
    <div className="biz-studio" data-testid="biz-yansi-studio">
      <div className="biz-studio-hero">
        <p className="biz-studio-eyebrow">AI Yansı Stüdyosu</p>
        <h2 className="biz-section-title">Kaynaklardan sohbet üret</h2>
        <p className="biz-section-lead">
          Yalnızca yayımlanmış Bilgi Havuzu kayıtları kullanılır. Cevaplar kaynaklı alıntıdır; owner onayı ve Ayna
          yayını bu akışın dışındadır.
        </p>
        <ol className="biz-studio-steps-rail" aria-label="Stüdyo adımları">
          <li data-active={phase === 'sources' || phase === 'topics'}>Kaynaklar</li>
          <li data-active={phase === 'topics' || phase === 'generating'}>Konu</li>
          <li data-active={phase === 'generating' || phase === 'preview'}>Sohbet</li>
          <li data-active={phase === 'preview' || phase === 'manual'}>Önizle / düzenle</li>
        </ol>
      </div>

      {unavailable ? (
        <div className="biz-studio-banner biz-studio-banner--warn" role="status" data-testid="biz-studio-unavailable">
          <strong>AI üretim şu an kullanılamıyor.</strong>
          <p>{unavailable}</p>
          <p>Mevcut manuel taslak akışıyla devam edebilirsiniz; sahte konu veya sohbet gösterilmez.</p>
        </div>
      ) : null}

      {error ? (
        <p className="biz-alert" role="alert" data-testid="biz-studio-error">
          {error}
        </p>
      ) : null}

      <section className="biz-studio-panel" aria-labelledby="biz-studio-sources-title">
        <h3 id="biz-studio-sources-title" className="biz-studio-panel-title">
          1. Kaynakları seç
        </h3>
        {published.length === 0 ? (
          <p className="biz-empty" data-testid="biz-studio-no-sources">
            Uygun kaynak yok. Bilgi Havuzu’nda yayımlanmış ve herkese açık kayıtlar görünür.
          </p>
        ) : (
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
                        {k.category || 'genel'} · v{k.version}
                      </em>
                      <small>{k.source}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
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
            {busy && phase === 'topics' ? 'Konular isteniyor…' : 'AI ile konu öner'}
          </button>
        </div>
      </section>

      <StudioGenerationStatus
        generation={topicsJob}
        phaseLabel="Konu önerisi"
        busy={busy && phase === 'topics'}
      />

      {topics && topics.length > 0 ? (
        <section className="biz-studio-panel" aria-labelledby="biz-studio-topics-title">
          <h3 id="biz-studio-topics-title" className="biz-studio-panel-title">
            2. Konu seç
          </h3>
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
                    {busy && selectedTopicId === topic.id ? 'Üretiliyor…' : 'Sekiz soruluk sohbet oluştur'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <StudioGenerationStatus
        generation={draftJob}
        phaseLabel="Sohbet üretimi"
        busy={busy && phase === 'generating'}
      />

      {draftJob && !isTerminalStudioStatus(draftJob.status) ? (
        <div className="biz-actions">
          <button type="button" disabled={busy} onClick={() => void refreshDraftJob()}>
            Durumu yenile
          </button>
        </div>
      ) : null}

      {draftResult ? (
        <section className="biz-studio-panel" aria-labelledby="biz-studio-preview-title">
          <h3 id="biz-studio-preview-title" className="biz-studio-panel-title">
            3. Önizle
          </h3>
          <StudioChatPreview
            title={draftResult.title}
            summary={draftResult.summary}
            steps={draftResult.steps}
            sourceTitles={sourceTitles}
          />
          {draftJob?.draftId ? (
            <p className="biz-notice" role="status">
              Backend taslak kimliği: {draftJob.draftId}. Kaydetmeden önce metni gözden geçirin; incelemeye gönderme
              owner onayını atlamaz.
            </p>
          ) : (
            <p className="biz-notice" role="status">
              Üretim tamamlandı. Taslağı kaydetmek backend doğrulamasını yeniden çalıştırır.
            </p>
          )}
        </section>
      ) : null}

      <section className="biz-studio-panel" aria-labelledby="biz-studio-edit-title">
        <div className="biz-studio-panel-head">
          <h3 id="biz-studio-edit-title" className="biz-studio-panel-title">
            4. Düzenle ve kaydet
          </h3>
          <button
            type="button"
            className="biz-studio-linkish"
            onClick={() => {
              setManualOpen((v) => !v);
              setPhase('manual');
            }}
            data-testid="biz-studio-toggle-manual"
          >
            {manualOpen || !draftResult ? 'Gelişmiş manuel düzenleme' : 'Manuel formu gizle'}
          </button>
        </div>

        {(manualOpen || !draftResult || editDraft) && (
          <form className="biz-form biz-studio-manual" onSubmit={(e) => void saveDraft(e)} data-testid="biz-studio-manual-form">
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
                      onChange={(e) =>
                        setSteps((old) => old.map((v, j) => (j === i ? { ...v, question: e.target.value } : v)))
                      }
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
                      onChange={(e) =>
                        setSteps((old) => old.map((v, j) => (j === i ? { ...v, answer: e.target.value } : v)))
                      }
                      required
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Kaynak
                    <select
                      aria-label={`${i + 1}. kaynak`}
                      value={s.sources[0] || ''}
                      onChange={(e) =>
                        setSteps((old) => old.map((v, j) => (j === i ? { ...v, sources: [e.target.value] } : v)))
                      }
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
        )}
      </section>
    </div>
  );
}
