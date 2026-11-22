'use client';

/**
 * Primary Yansı create flow: Select → AI propose → Review & publish.
 * Reuses V2 draft HTTP + Stage 03B conversation-proposals. V1 Studio / PhotoCreate stay secondary.
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  type BrandAsset,
  type Knowledge,
  applyYansiV2ConversationProposal,
  createYansiV2ConversationDraft,
  fetchBrandAssetPreview,
  isBusinessApiError,
  isSuccessYansiV2ProposalStatus,
  isTerminalYansiV2ProposalStatus,
  pollYansiV2ConversationProposal,
  publishYansiV2ConversationDraft,
  requestYansiV2ConversationProposal,
  reviseYansiV2ConversationDraft,
  transitionYansiV2ConversationDraft,
  yansiV2PublicHref,
  type YansiV2ConversationDraftDto,
  type YansiV2ConversationProposalDto,
  type YansiV2ConversationPublishResult,
} from '@/lib/eza/businessYansi';
import {
  addTurn,
  applyServerDraft,
  buildConversationApiInput,
  buildConversationPreview,
  canAddTurn,
  clearConversationDraftStorage,
  conversationErrorMessage,
  emptyConversationLocalDraft,
  moveTurn,
  normalizeConversationLocalDraft,
  readConversationDraftStorage,
  removeTurn,
  validateConversationCompose,
  writeConversationDraftStorage,
  YANSI_V2_CONV_MAX_TEXT,
  YANSI_V2_CONV_MAX_TITLE,
  YANSI_V2_CONV_MAX_TURNS,
  type YansiV2ConversationLocalDraft,
} from '@/lib/eza/yansiV2ConversationCreate';
import {
  knowledgeAiAvailability,
  publishableImageAssets,
  YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE,
} from '@/lib/eza/yansiV2PhotoCreate';
import YansiStudioDraftPreview from './YansiStudioDraftPreview';

type Phase = 'compose' | 'preview' | 'busy' | 'done';
type FlowStep = 1 | 2 | 3;
type PreviewTab = 'discover' | 'experience';
type SourceFilter = 'all' | 'ready' | 'private_view' | 'unavailable';

type Props = {
  businessId: string;
  assets: BrandAsset[];
  knowledge: Knowledge[];
  role: string;
  canEdit: boolean;
  busy?: boolean;
  brandName?: string | null;
  onPublished?: (result: YansiV2ConversationPublishResult) => void;
  onOpenLibrary?: () => void;
  onOpenKnowledgePool?: () => void;
  onSaveKnowledge?: (payload: {
    title: string;
    category: string;
    content: string;
    source: string;
    publicAllowed: boolean;
  }) => Promise<void>;
  onKnowledgeChanged?: () => Promise<void> | void;
};

function newIdempotencyKey(prefix = 'conv'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function revokeObjectUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    /* jsdom */
  }
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'draft':
      return 'Taslak';
    case 'review':
      return 'İncelemede';
    case 'approved':
      return 'Onaylı';
    case 'published':
      return 'Yayında';
    default:
      return status || 'Yeni';
  }
}

function CoverThumb({
  businessId,
  assetId,
  selected,
  title,
  onSelect,
}: {
  businessId: string;
  assetId: string;
  selected: boolean;
  title: string;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBrandAssetPreview(businessId, assetId, 'thumb')
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      revokeObjectUrl(revoked);
    };
  }, [businessId, assetId]);

  return (
    <button
      type="button"
      className={`biz-photo-create-thumb${selected ? ' is-selected' : ''}`}
      data-testid={`biz-conv-cover-${assetId}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="biz-photo-create-thumb-fallback">{title.slice(0, 1) || 'G'}</span>
      )}
      <span className="biz-photo-create-thumb-label">{title || 'Görsel'}</span>
    </button>
  );
}

export default function BusinessYansiConversationCreate({
  businessId,
  assets,
  knowledge,
  role,
  canEdit,
  busy = false,
  brandName = null,
  onPublished,
  onOpenLibrary,
  onOpenKnowledgePool,
  onSaveKnowledge,
  onKnowledgeChanged,
}: Props) {
  const formId = useId();
  const isOwner = role === 'owner';
  const isViewer = role === 'viewer';
  const images = useMemo(() => publishableImageAssets(assets), [assets]);
  const [open, setOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>(1);
  const [phase, setPhase] = useState<Phase>('compose');
  const [draft, setDraft] = useState<YansiV2ConversationLocalDraft>(emptyConversationLocalDraft);
  const [server, setServer] = useState<YansiV2ConversationDraftDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YansiV2ConversationPublishResult | null>(null);
  const [bindOpen, setBindOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sourceQuery, setSourceQuery] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [topicHint, setTopicHint] = useState('');
  const [proposalJob, setProposalJob] = useState<YansiV2ConversationProposalDto | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatusLabel, setAiStatusLabel] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('discover');
  const idempotencyRef = useRef(newIdempotencyKey('publish'));
  const proposeKeyRef = useRef(newIdempotencyKey('v2prop'));
  const actionLock = useRef(false);
  const proposeAbortRef = useRef<AbortController | null>(null);

  const preview = useMemo(
    () => buildConversationPreview(draft, assets, knowledge),
    [draft, assets, knowledge],
  );

  const readySourceIds = useMemo(
    () =>
      draft.linkedKnowledgeIds.filter((id) => {
        const row = knowledge.find((k) => k.id === id);
        return row && knowledgeAiAvailability(row).aiReady;
      }),
    [draft.linkedKnowledgeIds, knowledge],
  );

  const proposalResult = proposalJob?.proposal?.result ?? null;
  const proposalWarnings = proposalJob?.proposal?.warnings || [];

  useEffect(() => {
    const stored = readConversationDraftStorage(businessId);
    if (stored && (stored.title || stored.turns.some((t) => t.question || t.answer))) {
      setDraft(stored);
      setOpen(true);
      setFlowStep(3);
      setDirty(true);
    }
  }, [businessId]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const bindCandidates = useMemo(() => {
    const q = sourceQuery.trim().toLocaleLowerCase('tr');
    return knowledge
      .filter((row) => row.status !== 'archived')
      .map((row) => knowledgeAiAvailability(row))
      .filter((row) => {
        if (sourceFilter === 'ready' && !(row.aiReady && row.publicAllowed)) return false;
        if (sourceFilter === 'private_view' && !(row.aiReady && !row.publicAllowed)) return false;
        if (sourceFilter === 'unavailable' && row.aiReady) return false;
        if (!q) return true;
        return `${row.title} ${row.category}`.toLocaleLowerCase('tr').includes(q);
      });
  }, [knowledge, sourceFilter, sourceQuery]);

  function persist(next: YansiV2ConversationLocalDraft) {
    const normalized = normalizeConversationLocalDraft(next);
    setDraft(normalized);
    writeConversationDraftStorage(businessId, normalized);
    setDirty(true);
  }

  function resetAll(keepInputs: boolean) {
    proposeAbortRef.current?.abort();
    proposeAbortRef.current = null;
    setFlowStep(1);
    setPhase('compose');
    setError(null);
    setResult(null);
    setServer(null);
    setProposalJob(null);
    setBindOpen(false);
    setAddOpen(false);
    setTopicHint('');
    setAiBusy(false);
    setAiStatusLabel(null);
    setPreviewTab('discover');
    actionLock.current = false;
    idempotencyRef.current = newIdempotencyKey('publish');
    proposeKeyRef.current = newIdempotencyKey('v2prop');
    if (!keepInputs) {
      const empty = emptyConversationLocalDraft();
      setDraft(empty);
      clearConversationDraftStorage(businessId);
      setDirty(false);
    }
  }

  function goToManualEdit() {
    setFlowStep(3);
    setPhase('compose');
    setError(null);
  }

  async function withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (actionLock.current || busy) return undefined;
    actionLock.current = true;
    try {
      return await fn();
    } finally {
      actionLock.current = false;
    }
  }

  function mapErr(err: unknown): string {
    if (isBusinessApiError(err)) return conversationErrorMessage(err);
    return conversationErrorMessage(err);
  }

  async function runAiPropose(repropose = false) {
    if (!readySourceIds.length) {
      setError('AI için en az bir yayımlanmış bilgi kaynağı seçin.');
      return;
    }
    // New idempotency key = new Studio job (same pattern as V1 Studio re-run).
    if (repropose) {
      proposeKeyRef.current = newIdempotencyKey('v2prop');
      setProposalJob(null);
    }
    proposeAbortRef.current?.abort();
    const abort = new AbortController();
    proposeAbortRef.current = abort;
    setAiBusy(true);
    setAiStatusLabel('Öneri isteniyor…');
    setError(null);
    // Keep linked sources / cover / prior edits — never clear draft on AI failure.
    try {
      let job = await requestYansiV2ConversationProposal(businessId, {
        idempotencyKey: proposeKeyRef.current,
        sourceVersionIds: readySourceIds,
        topicHint,
      });
      setProposalJob(job);
      if (!isTerminalYansiV2ProposalStatus(job.status)) {
        setAiStatusLabel('Üretim sürüyor…');
        job = await pollYansiV2ConversationProposal(businessId, job.generationId, {
          signal: abort.signal,
        });
        setProposalJob(job);
      }
      if (job.status === 'blocked' || job.errorCode === 'studio_execution_not_implemented') {
        setError(conversationErrorMessage({ code: job.errorCode || 'studio_execution_not_implemented' }));
        setAiStatusLabel('Beklemede');
      } else if (job.status === 'failed' || !isSuccessYansiV2ProposalStatus(job.status)) {
        setError(conversationErrorMessage({ code: job.errorCode || 'proposal_not_ready' }));
        setAiStatusLabel('Başarısız');
      } else if (!job.proposal?.result) {
        setError(
          job.proposal?.insufficientSources
            ? conversationErrorMessage({ code: 'studio_insufficient_sources' })
            : 'AI önerisi oluşmadı. Elle yazmayı deneyebilirsiniz.',
        );
        setAiStatusLabel('Tamamlanamadı');
      } else {
        setAiStatusLabel('Hazır — henüz taslağa yazılmadı');
        setError(null);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(mapErr(err));
      setAiStatusLabel('Hata');
    } finally {
      if (proposeAbortRef.current === abort) proposeAbortRef.current = null;
      setAiBusy(false);
    }
  }

  async function acceptProposal() {
    if (!proposalJob?.generationId || !proposalResult) {
      setError('Önce AI önerisi oluşturun.');
      return;
    }
    await withLock(async () => {
      setPhase('busy');
      setError(null);
      try {
        const applied = await applyYansiV2ConversationProposal(
          businessId,
          proposalJob.generationId,
          draft.draftId && draft.revision != null
            ? { draftId: draft.draftId, expectedRevision: draft.revision }
            : {},
        );
        const merged = applyServerDraft({ ...draft, slug: draft.slug }, applied.draft);
        persist(merged);
        setServer(applied.draft);
        setDirty(false);
        setFlowStep(3);
        setPhase('compose');
      } catch (err) {
        setError(mapErr(err));
        setPhase('compose');
      }
    });
  }

  async function saveDraft(): Promise<YansiV2ConversationDraftDto | null> {
    const composeError = validateConversationCompose(draft);
    if (composeError) {
      setError(composeError);
      return null;
    }
    const input = buildConversationApiInput(draft, assets, knowledge);
    setPhase('busy');
    setError(null);
    try {
      let saved: YansiV2ConversationDraftDto;
      if (draft.draftId && draft.revision != null) {
        saved = await reviseYansiV2ConversationDraft(businessId, draft.draftId, {
          ...input,
          expectedRevision: draft.revision,
        });
      } else {
        saved = await createYansiV2ConversationDraft(businessId, input);
      }
      const merged = applyServerDraft(draft, saved);
      if (draft.slug) merged.slug = draft.slug;
      persist(merged);
      setServer(saved);
      setDirty(false);
      setFlowStep(3);
      setPhase('preview');
      return saved;
    } catch (err) {
      setError(mapErr(err));
      setPhase('compose');
      return null;
    }
  }

  async function submitReview() {
    await withLock(async () => {
      let current = server;
      if (!current || dirty) {
        current = (await saveDraft()) || null;
      }
      if (!current) return;
      if (current.status === 'review' || current.status === 'approved') {
        setPhase('preview');
        return;
      }
      setPhase('busy');
      try {
        const next = await transitionYansiV2ConversationDraft(businessId, current.id, {
          target: 'review',
          expectedRevision: current.revision,
        });
        persist(applyServerDraft({ ...draft, slug: draft.slug }, next));
        setServer(next);
        setDirty(false);
        setPhase('preview');
      } catch (err) {
        setError(mapErr(err));
        setPhase('preview');
      }
    });
  }

  async function approveDraft() {
    if (!isOwner) {
      setError('Onay yalnızca owner tarafından verilir.');
      return;
    }
    await withLock(async () => {
      const current = server;
      if (!current || current.status !== 'review') {
        setError('Önce incelemeye gönderin.');
        return;
      }
      setPhase('busy');
      setError(null);
      try {
        const next = await transitionYansiV2ConversationDraft(businessId, current.id, {
          target: 'approved',
          expectedRevision: current.revision,
          approvalNote: 'Studio onayı',
        });
        persist(applyServerDraft({ ...draft, slug: draft.slug }, next));
        setServer(next);
        setDirty(false);
        setPhase('preview');
      } catch (err) {
        setError(mapErr(err));
        setPhase('preview');
      }
    });
  }

  async function publishDraft() {
    if (!isOwner) {
      setError('Yayın yalnızca owner tarafından yapılır.');
      return;
    }
    await withLock(async () => {
      const current = server;
      if (!current || current.status !== 'approved') {
        setError('Yayın için onaylı taslak gerekir.');
        return;
      }
      setPhase('busy');
      setError(null);
      try {
        const published = await publishYansiV2ConversationDraft(businessId, current.id, {
          expectedDraftRevision: current.revision,
          slug: draft.slug || null,
          expectedCurrentVersion: null,
          idempotencyKey: idempotencyRef.current,
        });
        setResult(published);
        setPhase('done');
        clearConversationDraftStorage(businessId);
        setDirty(false);
        onPublished?.(published);
      } catch (err) {
        setError(mapErr(err));
        setPhase('preview');
      }
    });
  }

  async function submitAddKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSaveKnowledge) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setAddBusy(true);
    setError(null);
    try {
      writeConversationDraftStorage(businessId, draft);
      await onSaveKnowledge({
        title: String(data.title || '').trim(),
        category: String(data.category || '').trim(),
        content: String(data.content || '').trim(),
        source: String(data.source || '').trim(),
        publicAllowed: data.publicAllowed === 'on' || data.publicAllowed === 'true',
      });
      await onKnowledgeChanged?.();
      form.reset();
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilgi kaydı eklenemedi.');
    } finally {
      setAddBusy(false);
    }
  }

  if (isViewer || !canEdit) {
    return null;
  }

  const status = server?.status || draft.status;
  const approvalDropped =
    Boolean(draft.draftId) && status === 'draft' && (draft.revision || 0) > 1;
  const locked = phase === 'busy' || busy || aiBusy;

  return (
    <div className="biz-yansi-workspace-block biz-conv-create" data-testid="biz-conv-create">
      <div className="biz-studio-hero">
        <p className="biz-studio-eyebrow">Yansı Stüdyosu</p>
        <h2 className="biz-section-title">Yansı Oluştur</h2>
        <p className="biz-section-lead">
          Kaynaklarını seç, AI ile sohbet önerisi al, incele ve yayınla. Video Yansı ve Keşfet
          birleşimi bu sürümde yok.
        </p>
        {!open ? (
          <div className="biz-actions">
            <button
              type="button"
              className="biz-btn-primary"
              data-testid="biz-conv-create-open"
              onClick={() => {
                setOpen(true);
                resetAll(false);
              }}
            >
              Yansı Oluştur
            </button>
            {onOpenLibrary ? (
              <button type="button" className="biz-btn-ghost" onClick={onOpenLibrary}>
                İçerik Kütüphanesi
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="biz-studio-panel" data-testid="biz-conv-create-panel">
          <nav className="biz-conv-flow-rail" aria-label="Oluşturma adımları" data-testid="biz-conv-flow-rail">
            {(
              [
                [1, 'İçeriğini Seç'],
                [2, 'AI ile Oluştur'],
                [3, 'İncele ve Yayınla'],
              ] as const
            ).map(([step, label]) => (
              <button
                key={step}
                type="button"
                className={`biz-conv-flow-step${flowStep === step ? ' is-active' : ''}${
                  flowStep > step ? ' is-done' : ''
                }`}
                data-testid={`biz-conv-flow-${step}`}
                data-state={flowStep === step ? 'active' : flowStep > step ? 'done' : 'upcoming'}
                onClick={() => {
                  if (phase === 'done') return;
                  setFlowStep(step);
                  if (step < 3) setPhase('compose');
                }}
              >
                <span className="biz-conv-flow-index">{step}</span>
                {label}
              </button>
            ))}
          </nav>

          {!isOwner ? (
            <p className="biz-notice" role="status">
              Editor taslak oluşturup incelemeye gönderebilir; onay ve yayın owner yetkisidir.
            </p>
          ) : null}

          {status ? (
            <p className="biz-card-meta" data-testid="biz-conv-status">
              Durum: {statusLabel(status)}
              {dirty ? ' · kaydedilmemiş değişiklikler var' : ''}
            </p>
          ) : null}
          {approvalDropped && status === 'draft' ? (
            <p className="biz-notice" data-testid="biz-conv-approval-dropped" role="status">
              İçerik değiştiği için önceki onay geçersiz. Yeniden incelemeye gönderip onay alın.
            </p>
          ) : null}

          {flowStep === 1 ? (
            <div className="biz-conv-step-panel" data-testid="biz-conv-step-select">
              <section data-testid="biz-conv-section-media">
                <h3>Kapak görseli</h3>
                <p className="biz-card-meta">İsteğe bağlı. Video yayın bu akışta yok.</p>
                {!images.length ? (
                  <p className="biz-empty">
                    Yayımlanabilir görsel yok — kapaksız devam edebilirsiniz.
                  </p>
                ) : (
                  <div className="biz-photo-create-grid" role="listbox" aria-label="Kapak görseli">
                    <button
                      type="button"
                      className={`biz-photo-create-thumb${!draft.coverAssetId ? ' is-selected' : ''}`}
                      data-testid="biz-conv-cover-none"
                      aria-pressed={!draft.coverAssetId}
                      onClick={() => persist({ ...draft, coverAssetId: '' })}
                    >
                      <span className="biz-photo-create-thumb-fallback">—</span>
                      <span className="biz-photo-create-thumb-label">Kapaksız</span>
                    </button>
                    {images.map((asset) => (
                      <CoverThumb
                        key={asset.id}
                        businessId={businessId}
                        assetId={asset.id}
                        title={asset.title}
                        selected={draft.coverAssetId === asset.id}
                        onSelect={() => persist({ ...draft, coverAssetId: asset.id })}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section data-testid="biz-conv-section-knowledge">
                <h3>Bilgi kaynakları</h3>
                <p className="biz-card-meta">
                  AI önerisi için yayımlanmış Bilgi Havuzu kayıtları gerekir.
                </p>
                <div className="biz-actions">
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid="biz-conv-bind"
                    onClick={() => {
                      setBindOpen((v) => !v);
                      setAddOpen(false);
                    }}
                  >
                    Kaynak bağla
                    {draft.linkedKnowledgeIds.length
                      ? ` (${draft.linkedKnowledgeIds.length})`
                      : ''}
                  </button>
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid="biz-conv-add-knowledge"
                    onClick={() => {
                      setAddOpen((v) => !v);
                      setBindOpen(false);
                      writeConversationDraftStorage(businessId, draft);
                    }}
                  >
                    Yeni kayıt ekle
                  </button>
                  {onOpenKnowledgePool ? (
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      onClick={() => {
                        writeConversationDraftStorage(businessId, draft);
                        onOpenKnowledgePool();
                      }}
                    >
                      Havuzu aç
                    </button>
                  ) : null}
                  {onOpenLibrary ? (
                    <button type="button" className="biz-btn-ghost" onClick={onOpenLibrary}>
                      Medya kütüphanesi
                    </button>
                  ) : null}
                </div>
                {bindOpen ? (
                  <div className="biz-photo-create-bind" data-testid="biz-conv-bind-panel">
                    <div className="biz-actions">
                      <input
                        data-testid="biz-conv-bind-search"
                        placeholder="Ara…"
                        value={sourceQuery}
                        onChange={(e) => setSourceQuery(e.target.value)}
                      />
                      <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                        data-testid="biz-conv-bind-filter"
                      >
                        <option value="all">Tümü</option>
                        <option value="ready">AI + görünür</option>
                        <option value="private_view">AI, görüntüleme kapalı</option>
                        <option value="unavailable">Bağlanamaz</option>
                      </select>
                    </div>
                    <div className="biz-photo-create-bind-list">
                      {bindCandidates.map((row) => {
                        const checked = draft.linkedKnowledgeIds.includes(row.id);
                        const disabled = !row.aiReady;
                        return (
                          <label key={row.id}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              data-testid={`biz-conv-bind-${row.id}`}
                              onChange={() => {
                                if (disabled) return;
                                const nextIds = checked
                                  ? draft.linkedKnowledgeIds.filter((id) => id !== row.id)
                                  : draft.linkedKnowledgeIds.length >=
                                      YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE
                                    ? draft.linkedKnowledgeIds
                                    : [...draft.linkedKnowledgeIds, row.id];
                                persist({ ...draft, linkedKnowledgeIds: nextIds });
                              }}
                            />
                            <span>
                              {row.title}
                              <small> · {row.aiStatusLabel}</small>
                            </span>
                          </label>
                        );
                      })}
                      {!bindCandidates.length ? (
                        <p className="biz-empty">Uygun kayıt yok.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {addOpen && onSaveKnowledge ? (
                  <form
                    className="biz-photo-create-add biz-form"
                    data-testid="biz-conv-add-panel"
                    onSubmit={submitAddKnowledge}
                  >
                    <label>
                      Başlık
                      <input name="title" required maxLength={200} />
                    </label>
                    <label>
                      Kategori
                      <input name="category" maxLength={80} />
                    </label>
                    <label>
                      İçerik
                      <textarea name="content" required rows={4} maxLength={8000} />
                    </label>
                    <label>
                      Kaynak
                      <input name="source" maxLength={200} />
                    </label>
                    <label>
                      <input type="checkbox" name="publicAllowed" /> Kamuya görünür
                    </label>
                    <button type="submit" className="biz-btn-primary" disabled={addBusy}>
                      {addBusy ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                  </form>
                ) : null}
              </section>

              {error ? (
                <p className="biz-error" role="alert" data-testid="biz-conv-error">
                  {error}
                </p>
              ) : null}

              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  data-testid="biz-conv-to-ai"
                  onClick={() => {
                    setError(null);
                    setFlowStep(2);
                  }}
                >
                  Devam · AI ile oluştur
                </button>
                <button
                  type="button"
                  className="biz-btn-ghost"
                  data-testid="biz-conv-goto-manual"
                  onClick={goToManualEdit}
                >
                  Elle yaz
                </button>
              </div>
            </div>
          ) : null}

          {flowStep === 2 ? (
            <div className="biz-conv-step-panel" data-testid="biz-conv-step-ai">
              <h3>AI ile Yansı Oluştur</h3>
              <p className="biz-card-meta">
                Öneri ayrı tutulur; “Taslağa uygula” demeden draft yazılmaz. Soru sayısı 1–8
                arasında içeriğe göre seçilir. Video medya önerisi yok.
              </p>
              <label>
                İpucu (isteğe bağlı)
                <input
                  data-testid="biz-conv-topic-hint"
                  value={topicHint}
                  maxLength={500}
                  placeholder="Örn. ürün bakımı"
                  onChange={(e) => setTopicHint(e.target.value)}
                />
              </label>
              <p className="biz-card-meta">
                Seçili kaynak: {readySourceIds.length || 'yok'}
              </p>
              {aiStatusLabel ? (
                <p
                  className="biz-notice"
                  role="status"
                  data-testid="biz-conv-ai-status"
                  data-busy={aiBusy ? 'true' : 'false'}
                >
                  {aiStatusLabel}
                </p>
              ) : null}
              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  data-testid="biz-conv-ai-generate"
                  disabled={locked || !readySourceIds.length}
                  onClick={() => void runAiPropose(Boolean(proposalJob))}
                >
                  {aiBusy
                    ? 'Üretiliyor…'
                    : proposalJob
                      ? 'Yeni öneri üret'
                      : 'AI ile Yansı Oluştur'}
                </button>
                <button
                  type="button"
                  className="biz-btn-ghost"
                  data-testid="biz-conv-goto-manual"
                  onClick={goToManualEdit}
                >
                  Elle yaz
                </button>
              </div>

              {proposalResult ? (
                <article className="biz-conv-proposal" data-testid="biz-conv-proposal">
                  <p className="biz-studio-eyebrow">Öneri · henüz uygulanmadı</p>
                  <h4>{proposalResult.title}</h4>
                  {proposalResult.summary ? (
                    <p className="biz-copy">{proposalResult.summary}</p>
                  ) : null}
                  <p className="biz-card-meta">
                    Merak: {proposalResult.curiosityQuestion}
                  </p>
                  {proposalResult.coverSuggestion?.assetId ? (
                    <p className="biz-card-meta">
                      Kapak önerisi:{' '}
                      {images.find((a) => a.id === proposalResult.coverSuggestion?.assetId)
                        ?.title || 'Görsel'}
                    </p>
                  ) : null}
                  <ol>
                    {proposalResult.turns.map((turn) => (
                      <li key={turn.stepIndex}>
                        <strong>
                          {turn.stepIndex}. {turn.question}
                        </strong>
                        <p>{turn.answer}</p>
                        {turn.mediaSuggestions?.[0]?.assetId ? (
                          <small>
                            Medya:{' '}
                            {images.find((a) => a.id === turn.mediaSuggestions?.[0]?.assetId)
                              ?.title || 'Görsel'}
                          </small>
                        ) : null}
                        {turn.claimSafety === 'unsupported' ? (
                          <small className="biz-notice">Destek zayıf — kontrol edin</small>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {proposalWarnings.length ? (
                    <ul data-testid="biz-conv-proposal-warnings">
                      {proposalWarnings.map((w, i) => (
                        <li key={`${w.code}-${i}`}>{w.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="biz-actions">
                    <button
                      type="button"
                      className="biz-btn-primary"
                      data-testid="biz-conv-ai-apply"
                      disabled={locked}
                      onClick={() => void acceptProposal()}
                    >
                      Taslağa uygula
                    </button>
                  </div>
                </article>
              ) : null}

              {error ? (
                <p className="biz-error" role="alert" data-testid="biz-conv-error">
                  {error}
                </p>
              ) : null}

              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-ghost"
                  onClick={() => setFlowStep(1)}
                >
                  Geri
                </button>
              </div>
            </div>
          ) : null}

          {flowStep === 3 && phase !== 'done' ? (
            <div className="biz-conv-step-panel biz-conv-review-workspace" data-testid="biz-conv-step-review">
              {phase === 'compose' ? (
                <form
                  id={formId}
                  className="biz-form biz-conv-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void withLock(async () => {
                      await saveDraft();
                    });
                  }}
                >
                  <section data-testid="biz-conv-section-chat">
                    <h3>Sohbet düzenleme</h3>
                    <div data-testid="biz-conv-review-cover">
                      <p className="biz-card-meta">Kapak</p>
                      <div className="biz-photo-create-grid" role="listbox" aria-label="Kapak">
                        <button
                          type="button"
                          className={`biz-photo-create-thumb${!draft.coverAssetId ? ' is-selected' : ''}`}
                          data-testid="biz-conv-review-cover-none"
                          aria-pressed={!draft.coverAssetId}
                          onClick={() => persist({ ...draft, coverAssetId: '' })}
                        >
                          <span className="biz-photo-create-thumb-fallback">—</span>
                          <span className="biz-photo-create-thumb-label">Kapaksız</span>
                        </button>
                        {images.map((asset) => (
                          <CoverThumb
                            key={`review-${asset.id}`}
                            businessId={businessId}
                            assetId={asset.id}
                            title={asset.title}
                            selected={draft.coverAssetId === asset.id}
                            onSelect={() => persist({ ...draft, coverAssetId: asset.id })}
                          />
                        ))}
                      </div>
                    </div>
                    <label>
                      Başlık
                      <input
                        data-testid="biz-conv-title"
                        value={draft.title}
                        maxLength={YANSI_V2_CONV_MAX_TITLE}
                        required
                        onChange={(e) => persist({ ...draft, title: e.target.value })}
                      />
                    </label>
                    <label>
                      Özet
                      <input
                        data-testid="biz-conv-summary"
                        value={draft.summary}
                        maxLength={500}
                        onChange={(e) => persist({ ...draft, summary: e.target.value })}
                      />
                    </label>
                    <label>
                      Slug (isteğe bağlı)
                      <input
                        data-testid="biz-conv-slug"
                        value={draft.slug}
                        maxLength={80}
                        onChange={(e) => persist({ ...draft, slug: e.target.value })}
                      />
                    </label>
                    <label>
                      Bilgi notu
                      <textarea
                        data-testid="biz-conv-note"
                        value={draft.knowledgeNotes[0] || ''}
                        maxLength={8000}
                        rows={2}
                        onChange={(e) =>
                          persist({ ...draft, knowledgeNotes: [e.target.value] })
                        }
                      />
                    </label>

                    <div className="biz-conv-turns" data-testid="biz-conv-turns">
                      {draft.turns.map((turn, index) => (
                        <article
                          key={`turn-${index}`}
                          className="biz-conv-turn"
                          data-testid={`biz-conv-turn-${index + 1}`}
                        >
                          <header className="biz-conv-turn-head">
                            <strong>
                              Tur {index + 1}
                              {index === 0 ? ' · merak sorusu' : ''}
                            </strong>
                            <div className="biz-actions">
                              <button
                                type="button"
                                className="biz-btn-ghost"
                                disabled={index === 0}
                                data-testid={`biz-conv-turn-up-${index + 1}`}
                                onClick={() =>
                                  persist({
                                    ...draft,
                                    turns: moveTurn(draft.turns, index, index - 1),
                                  })
                                }
                              >
                                Yukarı
                              </button>
                              <button
                                type="button"
                                className="biz-btn-ghost"
                                disabled={index >= draft.turns.length - 1}
                                data-testid={`biz-conv-turn-down-${index + 1}`}
                                onClick={() =>
                                  persist({
                                    ...draft,
                                    turns: moveTurn(draft.turns, index, index + 1),
                                  })
                                }
                              >
                                Aşağı
                              </button>
                              <button
                                type="button"
                                className="biz-btn-ghost"
                                disabled={draft.turns.length <= 1}
                                data-testid={`biz-conv-turn-remove-${index + 1}`}
                                onClick={() =>
                                  persist({
                                    ...draft,
                                    turns: removeTurn(draft.turns, index),
                                  })
                                }
                              >
                                Sil
                              </button>
                            </div>
                          </header>
                          <label>
                            Soru
                            <textarea
                              data-testid={`biz-conv-question-${index + 1}`}
                              value={turn.question}
                              maxLength={YANSI_V2_CONV_MAX_TEXT}
                              rows={2}
                              required
                              onChange={(e) => {
                                const turns = [...draft.turns];
                                turns[index] = { ...turns[index], question: e.target.value };
                                persist({ ...draft, turns });
                              }}
                            />
                          </label>
                          <label>
                            Cevap
                            <textarea
                              data-testid={`biz-conv-answer-${index + 1}`}
                              value={turn.answer}
                              maxLength={YANSI_V2_CONV_MAX_TEXT}
                              rows={3}
                              required
                              onChange={(e) => {
                                const turns = [...draft.turns];
                                turns[index] = { ...turns[index], answer: e.target.value };
                                persist({ ...draft, turns });
                              }}
                            />
                          </label>
                          <label>
                            Tur görseli
                            <select
                              data-testid={`biz-conv-turn-media-${index + 1}`}
                              value={turn.mediaAssetId}
                              onChange={(e) => {
                                const turns = [...draft.turns];
                                turns[index] = {
                                  ...turns[index],
                                  mediaAssetId: e.target.value,
                                };
                                persist({ ...draft, turns });
                              }}
                            >
                              <option value="">Yok</option>
                              {images.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                  {asset.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        </article>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      data-testid="biz-conv-add-turn"
                      disabled={!canAddTurn(draft.turns)}
                      onClick={() => persist({ ...draft, turns: addTurn(draft.turns) })}
                    >
                      Soru ekle ({draft.turns.length}/{YANSI_V2_CONV_MAX_TURNS})
                    </button>
                  </section>

                  {error && phase === 'compose' ? (
                    <p className="biz-error" role="alert" data-testid="biz-conv-error">
                      {error}
                    </p>
                  ) : null}

                  <div className="biz-actions">
                    <button
                      type="submit"
                      className="biz-btn-primary"
                      data-testid="biz-conv-save-preview"
                      disabled={locked}
                    >
                      Kaydet ve önizle
                    </button>
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      onClick={() => setFlowStep(2)}
                    >
                      AI adımına dön
                    </button>
                  </div>
                </form>
              ) : null}

              {(phase === 'preview' || phase === 'busy') && preview ? (
                <div className="biz-conv-preview" data-testid="biz-conv-preview">
                  <h3>Önizleme</h3>
                  <div className="biz-conv-preview-tabs" role="tablist" aria-label="Önizleme">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewTab === 'discover'}
                      className={`biz-conv-preview-tab${previewTab === 'discover' ? ' is-active' : ''}`}
                      data-testid="biz-conv-preview-tab-discover"
                      onClick={() => setPreviewTab('discover')}
                    >
                      Keşfet
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={previewTab === 'experience'}
                      className={`biz-conv-preview-tab${previewTab === 'experience' ? ' is-active' : ''}`}
                      data-testid="biz-conv-preview-tab-experience"
                      onClick={() => setPreviewTab('experience')}
                    >
                      Deneyimle
                    </button>
                  </div>
                  <YansiStudioDraftPreview
                    mode={previewTab}
                    businessId={businessId}
                    brandName={brandName}
                    preview={preview}
                    coverAssetId={draft.coverAssetId || null}
                    turnMediaAssetIds={draft.turns.map((t) => t.mediaAssetId || null)}
                  />

                  {error ? (
                    <p className="biz-error" role="alert" data-testid="biz-conv-error">
                      {error}
                    </p>
                  ) : null}

                  <div className="biz-actions">
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      data-testid="biz-conv-back-compose"
                      disabled={locked}
                      onClick={() => setPhase('compose')}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      data-testid="biz-conv-submit-review"
                      disabled={locked || status === 'review' || status === 'approved'}
                      onClick={() => void submitReview()}
                    >
                      İncelemeye gönder
                    </button>
                    {isOwner ? (
                      <>
                        <button
                          type="button"
                          className="biz-btn-ghost"
                          data-testid="biz-conv-approve"
                          disabled={locked || status !== 'review'}
                          onClick={() => void approveDraft()}
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          className="biz-btn-primary"
                          data-testid="biz-conv-publish"
                          disabled={locked || status !== 'approved'}
                          onClick={() => void publishDraft()}
                        >
                          {phase === 'busy' ? 'İşleniyor…' : 'Yayınla'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'done' && result ? (
            <div className="biz-conv-done" data-testid="biz-conv-done">
              <h3>Yayınlandı</h3>
              <p className="biz-copy">
                Sohbet mühürlendi. Keşfet birleşimi henüz yok — public bağlantıyı paylaşın.
              </p>
              <ul data-testid="biz-conv-publish-meta">
                <li>Slug: {result.slug}</li>
                <li>Tur: {result.turnCount}</li>
                <li>
                  Public URL:{' '}
                  <a
                    href={yansiV2PublicHref(result.slug, result.publicationVersion)}
                    data-testid="biz-conv-public-url"
                  >
                    {yansiV2PublicHref(result.slug, result.publicationVersion)}
                  </a>
                </li>
              </ul>
              <button
                type="button"
                className="biz-btn-primary"
                data-testid="biz-conv-new-after-publish"
                onClick={() => {
                  setOpen(true);
                  resetAll(false);
                }}
              >
                Yeni Yansı
              </button>
            </div>
          ) : null}

          {open && phase !== 'done' ? (
            <div className="biz-actions">
              <button
                type="button"
                className="biz-btn-ghost"
                onClick={() => {
                  if (dirty && !window.confirm('Kaydedilmemiş değişiklikler silinsin mi?')) return;
                  setOpen(false);
                  resetAll(false);
                }}
              >
                Kapat
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
