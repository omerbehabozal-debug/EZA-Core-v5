'use client';

/**
 * Primary Yansı create flow: Select → AI propose → Review & publish.
 * Image-only reuses publishYansiV2Image contract inside the same UI (no separate product screen).
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  type BrandAsset,
  type Knowledge,
  BRAND_LIBRARY_IMAGE_MAX_BYTES,
  applyYansiV2ConversationProposal,
  createYansiV2ConversationDraft,
  fetchBrandAssetPreview,
  getYansiV2ConversationDraft,
  isBusinessApiError,
  isSuccessYansiV2ProposalStatus,
  isTerminalYansiV2ProposalStatus,
  pollYansiV2ConversationProposal,
  publishYansiV2ConversationDraft,
  publishYansiV2Image,
  requestYansiV2ConversationProposal,
  reviseYansiV2ConversationDraft,
  transitionYansiV2ConversationDraft,
  uploadBrandImage,
  yansiV2PublicHref,
  type YansiV2ConversationDraftDto,
  type YansiV2ConversationProposalDto,
  type YansiV2ConversationPublishResult,
  type YansiV2ImagePublishResult,
} from '@/lib/eza/businessYansi';
import {
  addTurn,
  applyServerDraft,
  buildConversationApiInput,
  buildConversationPreview,
  canAddTurn,
  clearConversationDraftStorage,
  conversationErrorMessage,
  COVER_NONE_YET_MESSAGE,
  emptyConversationLocalDraft,
  formatConversationProposalWarning,
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
  isConversationDraftEditable,
  isConversationDraftLocked,
  upsertConversationDraftIndex,
} from '@/lib/eza/yansiV2ConversationDraftIndex';
import {
  buildKnowledgeSourcePins,
  buildPhotoPreviewManifest,
  knowledgeAiAvailability,
  normalizePhotoDraft,
  publishableImageAssets,
  YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE,
  YANSI_V2_PHOTO_MAX_TITLE,
} from '@/lib/eza/yansiV2PhotoCreate';
import YansiProductCard from '@/components/mirror/YansiProductCard';
import YansiStudioDraftPreview from './YansiStudioDraftPreview';
import ConversationCoverAiPanel from './ConversationCoverAiPanel';
import StudioBrandImagePicker from './StudioBrandImagePicker';
import {
  SAINA_DISCOVER_OPEN_CTA,
  SAINA_DISCOVER_OPEN_CTA_SHORT,
} from '@/lib/eza/mirror-network/discoverCopy';

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
  /** When true, open the three-step create panel immediately (Business hub). */
  startOpen?: boolean;
  /** Hydrate this conversation draft via GET (same business only). */
  resumeDraftId?: string | null;
  onResumeConsumed?: () => void;
  onConversationDraftIndexed?: (draft: YansiV2ConversationDraftDto) => void;
  onPublished?: (result: YansiV2ConversationPublishResult) => void;
  onImagePublished?: (result: YansiV2ImagePublishResult) => void;
  /** Switch Business hub to Yansılarım after a successful publish. */
  onOpenMine?: () => void;
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
  /** Refresh asset list after in-flow library upload (same validation path as İçerik Kütüphanesi). */
  onAssetsChanged?: () => Promise<void> | void;
  /** Business Cover AI flag (same source as V1 CoverExperience). Off by default. */
  coverAiEnabled?: boolean;
};

const DIRECTION_EXAMPLES = [
  'Bilgi ve merak uyandıran bir keşif',
  'Mimari detaylarla bir yerin ruhunu anlat',
  'Kültür ve geleneklerin hikâyesini aç',
  'Bilimsel bir olayı sade ve net anlat',
  'Kısa bir hikâye gibi aktar',
  'Keşfe çağıran bir yolculuk kur',
] as const;

function isLibraryImageFile(file: File) {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(file.type);
}

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

/** Display-only: strip common markdown emphasis without mutating stored values. */
function displayPlainText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
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

function mapErrSafe(err: unknown): string {
  if (isBusinessApiError(err)) return conversationErrorMessage(err);
  return conversationErrorMessage(err);
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
  startOpen = false,
  resumeDraftId = null,
  onResumeConsumed,
  onConversationDraftIndexed,
  onPublished,
  onImagePublished,
  onOpenMine,
  onOpenLibrary,
  onOpenKnowledgePool,
  onSaveKnowledge,
  onKnowledgeChanged,
  onAssetsChanged,
  coverAiEnabled = false,
}: Props) {
  const formId = useId();
  const uploadInputId = useId();
  const isOwner = role === 'owner';
  const isViewer = role === 'viewer';
  const images = useMemo(() => publishableImageAssets(assets), [assets]);
  const [open, setOpen] = useState(Boolean(startOpen));
  const [flowStep, setFlowStep] = useState<FlowStep>(1);
  const [phase, setPhase] = useState<Phase>('compose');
  const [draft, setDraft] = useState<YansiV2ConversationLocalDraft>(emptyConversationLocalDraft);
  const [server, setServer] = useState<YansiV2ConversationDraftDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<YansiV2ConversationPublishResult | null>(null);
  const [imageResult, setImageResult] = useState<YansiV2ImagePublishResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sourceQuery, setSourceQuery] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [topicHint, setTopicHint] = useState('');
  const [proposalJob, setProposalJob] = useState<YansiV2ConversationProposalDto | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatusLabel, setAiStatusLabel] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('discover');
  const [publishKind, setPublishKind] = useState<'conversation' | 'image'>('conversation');
  const [imageConfirm, setImageConfirm] = useState(false);
  const [hydrateBusy, setHydrateBusy] = useState(false);
  const [editLocked, setEditLocked] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  /** True after this session (or hydrate) observed an approval — survives revise clearing approved*. */
  const [sawApproved, setSawApproved] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const idempotencyRef = useRef(newIdempotencyKey('publish'));
  const proposeKeyRef = useRef(newIdempotencyKey('v2prop'));
  const actionLock = useRef(false);
  const proposeAbortRef = useRef<AbortController | null>(null);
  const resumeHandledRef = useRef<string | null>(null);

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

  const selectedKnowledge = useMemo(
    () =>
      draft.linkedKnowledgeIds
        .map((id) => knowledge.find((row) => row.id === id))
        .filter((row): row is Knowledge => Boolean(row)),
    [draft.linkedKnowledgeIds, knowledge],
  );

  const isImageOnly = readySourceIds.length === 0 && Boolean(draft.coverAssetId);
  const canContinueSelect = readySourceIds.length > 0 || Boolean(draft.coverAssetId);
  const selectBlockedReason = !canContinueSelect
    ? !knowledge.some((row) => row.status !== 'archived') && !images.length
      ? 'Devam edilemiyor: henüz bilgi kaynağı veya yayınlanabilir görsel yok. Yeni kayıt ekleyin ya da görsel yükleyin.'
      : 'Devam edilemiyor: en az bir hazır bilgi kaynağı seçin veya kapak görseli ekleyin.'
    : null;

  const selectedCover = useMemo(
    () => images.find((row) => row.id === draft.coverAssetId) || null,
    [images, draft.coverAssetId],
  );

  const photoDraft = useMemo(
    () =>
      normalizePhotoDraft({
        assetId: draft.coverAssetId,
        title: draft.title,
        description: draft.summary,
        knowledgeNotes: draft.knowledgeNotes,
        linkedKnowledgeIds: [],
        slug: draft.slug,
      }),
    [draft],
  );

  const photoPreview = useMemo(() => {
    if (!selectedCover || publishKind !== 'image') return null;
    return buildPhotoPreviewManifest(businessId, selectedCover, photoDraft, knowledge);
  }, [businessId, selectedCover, photoDraft, knowledge, publishKind]);

  const proposalResult = proposalJob?.proposal?.result ?? null;
  const proposalWarnings = proposalJob?.proposal?.warnings || [];
  const coverLibraryEmpty = images.length === 0;
  const proposalWarningViews = proposalWarnings.map((w) =>
    formatConversationProposalWarning(w, { coverLibraryEmpty }),
  );
  const showCoverNoneYet =
    Boolean(proposalResult) &&
    !proposalResult?.coverSuggestion?.assetId &&
    coverLibraryEmpty &&
    !proposalWarningViews.some((w) => w.code === 'cover_skipped' || w.code === 'cover_not_eligible');

  function rememberDraft(dto: YansiV2ConversationDraftDto) {
    upsertConversationDraftIndex(businessId, dto);
    onConversationDraftIndexed?.(dto);
  }

  useEffect(() => {
    // Skip after a resume hydrate: clearing resumeDraftId must not re-read localStorage
    // and falsely mark the just-loaded server draft as dirty.
    if (resumeDraftId || resumeHandledRef.current) return;
    const stored = readConversationDraftStorage(businessId);
    if (stored && (stored.title || stored.turns.some((t) => t.question || t.answer) || stored.coverAssetId)) {
      setDraft(stored);
      setOpen(true);
      setFlowStep(stored.draftId || stored.title || stored.turns.some((t) => t.question) ? 3 : 1);
      setPublishKind(stored.linkedKnowledgeIds.length ? 'conversation' : stored.coverAssetId ? 'image' : 'conversation');
      // Local scratch without an explicit user edit is not publish-dirty.
      setDirty(false);
    }
  }, [businessId, resumeDraftId]);

  useEffect(() => {
    if (!resumeDraftId || resumeHandledRef.current === resumeDraftId) return;
    let cancelled = false;
    resumeHandledRef.current = resumeDraftId;
    setHydrateBusy(true);
    setError(null);
    void getYansiV2ConversationDraft(businessId, resumeDraftId)
      .then((dto) => {
        if (cancelled) return;
        if (
          dto.businessId &&
          dto.businessId.toLowerCase() !== businessId.toLowerCase()
        ) {
          setOpen(true);
          setFlowStep(1);
          setError('Bu taslak bu markaya ait değil.');
          onResumeConsumed?.();
          return;
        }
        const permanentlyLocked = isConversationDraftLocked(dto.status, dto.publishedNodeId);
        const canEditContent = isConversationDraftEditable(dto.status, dto.publishedNodeId);
        const merged = applyServerDraft(emptyConversationLocalDraft(), dto);
        setDraft(merged);
        writeConversationDraftStorage(businessId, merged);
        setServer(dto);
        if (
          dto.status === 'approved' ||
          dto.status === 'published' ||
          dto.approvedAt ||
          dto.approvedRevision != null
        ) {
          setSawApproved(true);
        }
        rememberDraft(dto);
        setOpen(true);
        setPublishKind('conversation');
        setFlowStep(3);
        setPhase(canEditContent ? 'compose' : 'preview');
        setEditLocked(permanentlyLocked);
        setDirty(false);
        onResumeConsumed?.();
      })
      .catch((err) => {
        if (cancelled) return;
        setOpen(true);
        setFlowStep(1);
        setError(mapErrSafe(err));
        onResumeConsumed?.();
      })
      .finally(() => {
        if (!cancelled) setHydrateBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // mapErrSafe is stable below; intentionally omit rememberDraft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDraftId, businessId]);

  useEffect(() => {
    if (!draft.coverAssetId) {
      setCoverPreviewUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBrandAssetPreview(businessId, draft.coverAssetId, 'thumb')
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        revoked = url;
        setCoverPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setCoverPreviewUrl(null);
      });
    return () => {
      cancelled = true;
      revokeObjectUrl(revoked);
    };
  }, [businessId, draft.coverAssetId]);

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
    // Fresh create session: drop transient UI/API state. Does NOT delete server drafts
    // or the Yansılarım index — only the in-progress workspace + localStorage scratch.
    proposeAbortRef.current?.abort();
    proposeAbortRef.current = null;
    setFlowStep(1);
    setPhase('compose');
    setError(null);
    setResult(null);
    setImageResult(null);
    setServer(null);
    setSawApproved(false);
    setCopyFeedback(null);
    setProposalJob(null);
    setAddOpen(false);
    setSourcesOpen(false);
    setSourceFilter('all');
    setSourceQuery('');
    setTopicHint('');
    setUploadBusy(false);
    setAiBusy(false);
    setAiStatusLabel(null);
    setPreviewTab('discover');
    setPublishKind('conversation');
    setImageConfirm(false);
    setEditLocked(false);
    setCoverPreviewUrl(null);
    setHydrateBusy(false);
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

  function forkAwayFromPublishedLocally() {
    // Keep visible content; drop published identity so save/create cannot revise frozen draft.
    const forked = normalizeConversationLocalDraft({
      ...draft,
      draftId: '',
      revision: null,
      status: 'draft',
      slug: '',
    });
    setDraft(forked);
    writeConversationDraftStorage(businessId, forked);
    setServer(null);
    setEditLocked(false);
    setSawApproved(false);
    setResult(null);
    setImageResult(null);
    setProposalJob(null);
    setDirty(true);
    idempotencyRef.current = newIdempotencyKey('publish');
  }

  function goToManualEdit() {
    if (isCurrentDraftImmutable()) {
      forkAwayFromPublishedLocally();
    }
    setPublishKind('conversation');
    setFlowStep(3);
    setPhase('compose');
    setError(null);
  }

  function continueFromSelect() {
    setError(null);
    if (readySourceIds.length) {
      setPublishKind('conversation');
      setFlowStep(2);
      return;
    }
    if (draft.coverAssetId) {
      setPublishKind('image');
      setImageConfirm(false);
      setFlowStep(3);
      setPhase('compose');
      return;
    }
    setError(
      selectBlockedReason ||
        'Devam edilemiyor: en az bir hazır bilgi kaynağı seçin veya kapak görseli ekleyin.',
    );
  }

  async function handleCoverUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || uploadBusy || busy || aiBusy || hydrateBusy || editLocked || phase === 'busy') return;
    if (!isLibraryImageFile(file)) {
      setError('Yalnızca PNG, JPEG veya WebP görseller yüklenebilir.');
      return;
    }
    if (file.size > BRAND_LIBRARY_IMAGE_MAX_BYTES) {
      setError('Görsel dosyası çok büyük (en fazla 15 MB).');
      return;
    }
    setUploadBusy(true);
    setError(null);
    try {
      const saved = await uploadBrandImage(businessId, file, {
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Kapak',
        publicAllowed: true,
      });
      await onAssetsChanged?.();
      persist({ ...draft, coverAssetId: saved.id });
    } catch (err) {
      setError(mapErrSafe(err));
    } finally {
      setUploadBusy(false);
    }
  }

  function requestClose() {
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler silinsin mi?')) return;
    setOpen(false);
    resetAll(false);
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
    return mapErrSafe(err);
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

  function isCurrentDraftImmutable(): boolean {
    if (editLocked) return true;
    return isConversationDraftLocked(
      server?.status ?? draft.status,
      server?.publishedNodeId ?? null,
    );
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
        // Published drafts are immutable — apply into a NEW draft (omit draftId).
        const immutable = isCurrentDraftImmutable();
        const applied = await applyYansiV2ConversationProposal(
          businessId,
          proposalJob.generationId,
          !immutable && draft.draftId && draft.revision != null
            ? { draftId: draft.draftId, expectedRevision: draft.revision }
            : {},
        );
        const merged = applyServerDraft(
          { ...draft, slug: immutable ? '' : draft.slug },
          applied.draft,
        );
        persist(merged);
        setServer(applied.draft);
        setEditLocked(false);
        setSawApproved(false);
        rememberDraft(applied.draft);
        setDirty(false);
        setPublishKind('conversation');
        setFlowStep(3);
        setPhase('compose');
        setResult(null);
        setImageResult(null);
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
      const immutable = isCurrentDraftImmutable();
      const canRevise = !immutable && draft.draftId && draft.revision != null;
      if (canRevise) {
        saved = await reviseYansiV2ConversationDraft(businessId, draft.draftId!, {
          ...input,
          expectedRevision: draft.revision!,
        });
      } else {
        // New draft or fork away from a published/locked draft.
        saved = await createYansiV2ConversationDraft(businessId, input);
      }
      const merged = applyServerDraft(
        { ...draft, slug: immutable ? '' : draft.slug },
        saved,
      );
      if (!immutable && draft.slug) merged.slug = draft.slug;
      persist(merged);
      setServer(saved);
      setEditLocked(false);
      if (immutable) setSawApproved(false);
      rememberDraft(saved);
      setDirty(false);
      setPublishKind('conversation');
      setFlowStep(3);
      setPhase('preview');
      return saved;
    } catch (err) {
      setError(mapErr(err));
      setPhase('compose');
      return null;
    }
  }

  async function publishImageOnly() {
    if (!isOwner) {
      setError('Yayın yalnızca owner tarafından yapılır.');
      return;
    }
    if (!imageConfirm) {
      setError('Yayınlamak için onayı işaretleyin.');
      return;
    }
    if (!selectedCover) {
      setError('Yayımlanabilir bir kapak görseli seçin.');
      return;
    }
    const normalized = normalizePhotoDraft(photoDraft);
    if (!normalized.title) {
      setError('Başlık gerekli.');
      return;
    }
    if (!buildPhotoPreviewManifest(businessId, selectedCover, normalized, knowledge)) {
      setError('Önizleme oluşturulamadı.');
      return;
    }
    await withLock(async () => {
      setPhase('busy');
      setError(null);
      try {
        const pins = buildKnowledgeSourcePins(normalized, knowledge);
        const published = await publishYansiV2Image(businessId, {
          assetId: selectedCover.id,
          expectedAssetRevision: selectedCover.revision,
          title: normalized.title,
          description: normalized.description || null,
          knowledgeNotes: normalized.knowledgeNotes,
          ...(pins.length ? { knowledgeSources: pins } : {}),
          slug: normalized.slug || null,
          expectedCurrentVersion: null,
          idempotencyKey: idempotencyRef.current,
        });
        setImageResult(published);
        setResult(null);
        setPhase('done');
        clearConversationDraftStorage(businessId);
        setDirty(false);
        onImagePublished?.(published);
      } catch (err) {
        setError(mapErr(err));
        setPhase('compose');
      }
    });
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
        rememberDraft(next);
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
        setSawApproved(true);
        rememberDraft(next);
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
        // Authoritative status: prefer fresh draft GET; fall back to publish result fields.
        let nextServer: YansiV2ConversationDraftDto = {
          ...current,
          status: 'published',
          publishedNodeId: published.nodeId,
          publishedVersion: published.publicationVersion,
        };
        try {
          nextServer = await getYansiV2ConversationDraft(businessId, published.draftId);
        } catch {
          /* keep merged publish status */
        }
        if (nextServer.status !== 'published') {
          setError('Yayın tamamlanamadı. Durum güncellenemedi.');
          setPhase('preview');
          return;
        }
        setServer(nextServer);
        setEditLocked(true);
        rememberDraft(nextServer);
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
    sawApproved && status === 'draft' && !server?.publishedNodeId;
  const locked = phase === 'busy' || busy || aiBusy || hydrateBusy || editLocked || uploadBusy;
  // AI generate/apply may fork a new draft when the current one is published.
  const aiBusyLocked = phase === 'busy' || busy || aiBusy || hydrateBusy || uploadBusy;
  const draftImmutable = isCurrentDraftImmutable();
  const publishedHref = result
    ? yansiV2PublicHref(result.slug, result.publicationVersion, 'conversation')
    : imageResult
      ? yansiV2PublicHref(imageResult.slug, imageResult.publicationVersion, 'image')
      : null;
  const publishedHasCover = Boolean(
    (result?.public?.cover && result.public.cover.assetId) ||
      (imageResult && imageResult.slug),
  );

  async function copyPublishedLink() {
    if (!publishedHref) return;
    const absolute =
      typeof window !== 'undefined'
        ? `${window.location.origin}${publishedHref}`
        : publishedHref;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopyFeedback('Bağlantı kopyalandı');
    } catch {
      setCopyFeedback('Kopyalanamadı — bağlantıyı elle seçin');
    }
  }
  const liveTitle = displayPlainText(draft.title);
  const liveCuriosity = displayPlainText(draft.turns[0]?.question || '');
  const hasLiveCopy = Boolean(liveTitle || liveCuriosity);
  const showLiveCard = Boolean(coverPreviewUrl || hasLiveCopy);

  return (
    <div className="biz-yansi-workspace-block biz-conv-create" data-testid="biz-conv-create">
      <div className="biz-studio-hero">
        <h2 className="biz-section-title">Yansı Oluştur</h2>
        <p className="biz-section-lead">
          Bilgilerini ve görsellerini seç. Yapay zekâ Yansı&apos;nı hazırlasın. Sen incele ve yayınla.
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
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="biz-studio-panel" data-testid="biz-conv-create-panel">
          <div className="biz-conv-panel-head">
            <p className="biz-studio-eyebrow">İçerik stüdyosu</p>
            {phase !== 'done' ? (
              <button
                type="button"
                className="biz-conv-exit"
                data-testid="biz-conv-exit"
                onClick={requestClose}
              >
                Çık
              </button>
            ) : null}
          </div>
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
                  // Published drafts: allow steps 1–2 to fork a new draft via AI/apply.
                  if (editLocked && step === 3) return;
                  if (step === 2 && isImageOnly && !readySourceIds.length) {
                    setError('AI için önce bilgi kaynağı seçin. Yalnızca görsel için 3. adıma geçin.');
                    return;
                  }
                  setFlowStep(step);
                  if (step < 3) setPhase('compose');
                  if (step === 3 && isImageOnly) setPublishKind('image');
                  if (step === 3 && readySourceIds.length) setPublishKind('conversation');
                }}
              >
                <span className="biz-conv-flow-index">{step}</span>
                {label}
              </button>
            ))}
          </nav>

          {hydrateBusy ? (
            <p className="biz-notice" role="status" data-testid="biz-conv-hydrate">
              Taslak yükleniyor…
            </p>
          ) : null}

          {!isOwner ? (
            <p className="biz-notice" role="status">
              Editör taslak hazırlayabilir; onay ve yayın owner yetkisidir.
            </p>
          ) : null}

          {editLocked ? (
            <p className="biz-notice" role="status" data-testid="biz-conv-locked">
              Bu taslak kilitli veya yayında; yalnızca görüntülenebilir.
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
            <div className="biz-conv-step-panel biz-conv-step-select" data-testid="biz-conv-step-select">
              <div className="biz-conv-create-layout">
                <div className="biz-conv-create-main">
                  <section className="biz-conv-pick-card" data-testid="biz-conv-section-knowledge">
                    <h3>Bilgilerini Seç</h3>
                    <p className="biz-card-meta">
                      Yapay zekânın kullanacağı kayıtları kompakt seçicide toplayın.
                    </p>
                    <button
                      type="button"
                      className={`biz-conv-source-summary${sourcesOpen ? ' is-open' : ''}`}
                      data-testid="biz-conv-bind"
                      aria-expanded={sourcesOpen}
                      onClick={() => setSourcesOpen((v) => !v)}
                    >
                      <span className="biz-conv-source-summary__count">
                        Seçili kaynak ({draft.linkedKnowledgeIds.length})
                      </span>
                      <span className="biz-conv-source-summary__action">
                        {sourcesOpen ? 'Kapat' : 'Kaynak seç'}
                      </span>
                    </button>
                    {selectedKnowledge.length ? (
                      <ul className="biz-conv-source-chips" data-testid="biz-conv-source-chips">
                        {selectedKnowledge.map((row) => (
                          <li key={row.id}>{displayPlainText(row.title)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="biz-card-meta">Henüz kaynak seçilmedi.</p>
                    )}
                    {sourcesOpen ? (
                      <div className="biz-photo-create-bind biz-conv-source-picker" data-testid="biz-conv-bind-panel">
                        <div className="biz-actions">
                          <input
                            data-testid="biz-conv-bind-search"
                            placeholder="Kaynak ara…"
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
                              <label key={row.id} className={checked ? 'is-selected' : undefined}>
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
                            <p className="biz-empty">Uygun kayıt yok. Bilgi Havuzu’na kayıt ekleyin.</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="biz-actions">
                      <button
                        type="button"
                        className="biz-btn-ghost"
                        data-testid="biz-conv-add-knowledge"
                        onClick={() => {
                          setAddOpen((v) => !v);
                          setSourcesOpen(true);
                          writeConversationDraftStorage(businessId, draft);
                        }}
                      >
                        Yeni kayıt ekle
                      </button>
                      {onOpenKnowledgePool ? (
                        <button type="button" className="biz-btn-ghost" onClick={onOpenKnowledgePool}>
                          Bilgi Havuzu
                        </button>
                      ) : null}
                    </div>
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

                  <section className="biz-conv-pick-card" data-testid="biz-conv-section-media">
                    <h3>Kapak</h3>
                    <p className="biz-card-meta">
                      Üç yol: görsel yükle, kütüphaneden seç veya (içerik oluşunca) AI ile oluştur.
                    </p>
                    <div className="biz-conv-media-actions">
                      <label className="biz-btn-ghost biz-conv-upload-label" htmlFor={uploadInputId}>
                        {uploadBusy ? 'Yükleniyor…' : 'Görsel yükle'}
                      </label>
                      <input
                        id={uploadInputId}
                        data-testid="biz-conv-cover-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        disabled={locked}
                        className="biz-conv-upload-input"
                        onChange={(e) => {
                          void handleCoverUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="biz-btn-ghost"
                        data-testid="biz-conv-cover-library"
                        disabled={locked}
                        onClick={() => setCoverPickerOpen(true)}
                      >
                        Kütüphane
                      </button>
                    </div>
                    {!images.length && !draft.coverAssetId && !uploadBusy ? (
                      <p className="biz-empty" data-testid="biz-conv-media-empty">
                        Henüz yayınlanabilir görsel yok. Yukarıdan yükleyin veya kütüphaneden uygun bir
                        görsel seçin; kapak için herkese açık yayımlanmış görsel gerekir.
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
                        {draft.coverAssetId &&
                        !images.some((asset) => asset.id === draft.coverAssetId) ? (
                          <CoverThumb
                            key={draft.coverAssetId}
                            businessId={businessId}
                            assetId={draft.coverAssetId}
                            title="Yüklenen görsel"
                            selected
                            onSelect={() => persist({ ...draft, coverAssetId: draft.coverAssetId })}
                          />
                        ) : null}
                      </div>
                    )}
                    {coverAiEnabled ? (
                      <p className="biz-notice" role="status" data-testid="biz-conv-cover-ai-later">
                        AI kapak üretimi için önce sohbet içeriğini oluşturun. İncele ve Yayınla
                        aşamasında yapay zekâ ile kapak oluşturabilirsiniz.
                      </p>
                    ) : null}
                    {!draft.coverAssetId ? (
                      <p className="biz-card-meta" data-testid="biz-conv-coverless-discover-note">
                        Kapaksız yayın public bağlantıyla açılır; Keşfet’te görünmez.
                      </p>
                    ) : null}
                  </section>

                  <section className="biz-conv-pick-card" data-testid="biz-conv-section-intent">
                    <h3>Yansı&apos;nı Nasıl Hayal Ediyorsun?</h3>
                    <p className="biz-card-meta">
                      İsteğe bağlı. Yazılan yön, AI öneri isteğine gerçekten aktarılır.
                    </p>
                    <label>
                      Yönlendirme
                      <textarea
                        data-testid="biz-conv-topic-hint"
                        value={topicHint}
                        maxLength={500}
                        rows={3}
                        placeholder="Örn. kültür ve bilim arasında bir keşif anlat"
                        onChange={(e) => setTopicHint(e.target.value)}
                      />
                    </label>
                    <div className="biz-conv-direction-examples" data-testid="biz-conv-direction-examples">
                      {DIRECTION_EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          className="biz-conv-direction-chip"
                          onClick={() => setTopicHint(example)}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </section>

                  {error ? (
                    <p className="biz-error" role="alert" data-testid="biz-conv-error">
                      {error}
                    </p>
                  ) : null}

                  <div className="biz-conv-footer-actions">
                    <button
                      type="button"
                      className="biz-btn-primary"
                      data-testid="biz-conv-to-ai"
                      disabled={!canContinueSelect}
                      onClick={continueFromSelect}
                    >
                      {readySourceIds.length
                        ? 'Devam · AI ile oluştur'
                        : draft.coverAssetId
                          ? 'Devam · İncele ve yayınla'
                          : 'Devam'}
                    </button>
                    <button
                      type="button"
                      className="biz-btn-ghost biz-conv-secondary-action"
                      data-testid="biz-conv-goto-manual"
                      onClick={goToManualEdit}
                    >
                      Elle yaz
                    </button>
                  </div>
                  {selectBlockedReason ? (
                    <p className="biz-notice" role="status" data-testid="biz-conv-blocked-reason">
                      {selectBlockedReason}
                    </p>
                  ) : null}
                  {isImageOnly ? (
                    <p className="biz-card-meta" data-testid="biz-conv-photo-hint">
                      Yalnızca görsel seçildi. Yapay zekâ adımı atlanır; inceleme ve yayın onayı gerekir.
                    </p>
                  ) : null}
                </div>

                <aside className="biz-conv-create-aside" data-testid="biz-conv-live-preview">
                  <h3 className="biz-studio-panel-title">Canlı Keşfet Önizlemesi</h3>
                  <p className="biz-card-meta">
                    Seçiminiz anında yansır. Boşken örnek içerik gösterilmez.
                  </p>
                  {showLiveCard ? (
                    <div className="biz-conv-live-device">
                      <YansiProductCard
                        title={liveTitle || 'Başlık henüz yok'}
                        summary={liveCuriosity || 'Merak sorusu henüz yok'}
                        sceneImageUrl={coverPreviewUrl}
                        className="saina-discover-card--editorial"
                        testIdPrefix="biz-conv-live-card"
                        kicker={
                          brandName ? (
                            <p className="saina-discover-card__identity">{brandName}</p>
                          ) : null
                        }
                        footer={
                          <div className="saina-discover-card__actions">
                            <button type="button" className="saina-discover-card__cta" disabled>
                              <span className="saina-discover-card__cta-label">{SAINA_DISCOVER_OPEN_CTA}</span>
                              <span className="saina-discover-card__cta-short" aria-hidden>
                                {SAINA_DISCOVER_OPEN_CTA_SHORT}
                              </span>
                            </button>
                          </div>
                        }
                      />
                    </div>
                  ) : (
                    <div className="biz-conv-live-empty" data-testid="biz-conv-live-empty">
                      <div className="biz-conv-live-empty-frame" aria-hidden />
                      <p className="biz-empty">Kapak, başlık veya merak sorusu eklenince önizleme burada belirir.</p>
                    </div>
                  )}
                  <div className="biz-conv-live-meta" data-testid="biz-conv-live-meta">
                    <p className="biz-card-meta">
                      Kaynak: {selectedKnowledge.length}
                      {selectedKnowledge.length
                        ? ` · ${selectedKnowledge
                            .slice(0, 3)
                            .map((row) => displayPlainText(row.title))
                            .join(', ')}${selectedKnowledge.length > 3 ? '…' : ''}`
                        : ''}
                    </p>
                    <p className="biz-card-meta">
                      Kapak: {selectedCover ? displayPlainText(selectedCover.title) : 'seçilmedi'}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {flowStep === 2 ? (
            <div className="biz-conv-step-panel" data-testid="biz-conv-step-ai">
              <h3>AI ile Yansı Oluştur</h3>
              {!readySourceIds.length ? (
                <p className="biz-notice" role="status" data-testid="biz-conv-ai-need-sources">
                  Yapay zekâ için bilgi kaynağı gerekli. Yalnızca görselle ilerlemek için 1. adıma
                  dönüp kapak seçin ve incelemeye geçin.
                </p>
              ) : null}
              <p className="biz-card-meta">
                Öneri ayrı tutulur; “Taslağa uygula” demeden taslağa yazılmaz. 1–8 soru-cevap
                içeriğe göre seçilir.
              </p>
              <label>
                Yansı&apos;nı nasıl hayal ediyorsun? (isteğe bağlı)
                <textarea
                  data-testid="biz-conv-topic-hint"
                  value={topicHint}
                  maxLength={500}
                  rows={2}
                  placeholder="Örn. kültür ve bilim arasında bir keşif anlat"
                  onChange={(e) => setTopicHint(e.target.value)}
                />
              </label>
              <p className="biz-card-meta">
                Seçili kaynak: {readySourceIds.length || 'yok'}
                {draft.coverAssetId ? ' · kapak seçili' : ''}
              </p>
              {draftImmutable ? (
                <p className="biz-notice" role="status" data-testid="biz-conv-ai-fork-hint">
                  Bu taslak yayında. “Taslağa uygula” yeni bir taslak oluşturur; yayımlanmış
                  kayıt değişmez.
                </p>
              ) : null}
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
                  disabled={aiBusyLocked || !readySourceIds.length}
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
                  <h4>{displayPlainText(proposalResult.title)}</h4>
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
                  {showCoverNoneYet ? (
                    <p className="biz-notice" role="status" data-testid="biz-conv-cover-none-yet">
                      {COVER_NONE_YET_MESSAGE}
                    </p>
                  ) : null}
                  {proposalWarningViews.length ? (
                    <ul data-testid="biz-conv-proposal-warnings">
                      {proposalWarningViews.map((w, i) => (
                        <li
                          key={`${w.code}-${i}`}
                          className={w.soft ? 'biz-notice' : undefined}
                          data-soft={w.soft ? 'true' : 'false'}
                        >
                          {w.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="biz-actions">
                    <button
                      type="button"
                      className="biz-btn-primary"
                      data-testid="biz-conv-ai-apply"
                      disabled={aiBusyLocked}
                      onClick={() => void acceptProposal()}
                    >
                      {draftImmutable ? 'Yeni taslağa uygula' : 'Taslağa uygula'}
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

          {flowStep === 3 && phase !== 'done' && publishKind === 'image' ? (
            <div className="biz-conv-step-panel biz-conv-review-workspace" data-testid="biz-conv-step-review-image">
              <div className="biz-conv-create-layout">
                <div className="biz-conv-create-main">
                  <h3>İncele ve Yayınla</h3>
                  <p className="biz-card-meta">
                    Görsel Yansı. Yapay zekâ önerisi gerekmez. Yayın owner onayı ister.
                  </p>
                  <form
                    id={`${formId}-image`}
                    className="biz-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void publishImageOnly();
                    }}
                  >
                    <label>
                      Başlık
                      <input
                        data-testid="biz-conv-image-title"
                        value={draft.title}
                        maxLength={YANSI_V2_PHOTO_MAX_TITLE}
                        required
                        disabled={editLocked}
                        onChange={(e) => persist({ ...draft, title: e.target.value })}
                      />
                    </label>
                    <label>
                      Açıklama (isteğe bağlı)
                      <textarea
                        data-testid="biz-conv-image-description"
                        value={draft.summary}
                        maxLength={8000}
                        rows={3}
                        disabled={editLocked}
                        onChange={(e) => persist({ ...draft, summary: e.target.value })}
                      />
                    </label>
                    <label>
                      Yayın adresi (isteğe bağlı)
                      <input
                        data-testid="biz-conv-image-slug"
                        value={draft.slug}
                        maxLength={80}
                        disabled={editLocked}
                        onChange={(e) => persist({ ...draft, slug: e.target.value })}
                      />
                    </label>
                    <p className="biz-card-meta">
                      Kapak: {selectedCover ? displayPlainText(selectedCover.title) : 'seçilmedi'}
                    </p>
                    {error ? (
                      <p className="biz-error" role="alert" data-testid="biz-conv-error">
                        {error}
                      </p>
                    ) : null}
                    {isOwner && !editLocked ? (
                      <label className="biz-conv-image-confirm">
                        <input
                          type="checkbox"
                          data-testid="biz-conv-image-confirm"
                          checked={imageConfirm}
                          onChange={(e) => setImageConfirm(e.target.checked)}
                        />{' '}
                        Bu görsel Yansı&apos;yı yayınlamayı onaylıyorum.
                      </label>
                    ) : null}
                    <div className="biz-actions">
                      <button
                        type="button"
                        className="biz-btn-ghost"
                        data-testid="biz-conv-image-back"
                        onClick={() => setFlowStep(1)}
                      >
                        İçeriğe dön
                      </button>
                      {isOwner && !editLocked ? (
                        <button
                          type="submit"
                          className="biz-btn-primary"
                          data-testid="biz-conv-image-publish"
                          disabled={locked || !imageConfirm || !selectedCover}
                        >
                          {phase === 'busy' ? 'Yayımlanıyor…' : 'Yayınla'}
                        </button>
                      ) : (
                        <p className="biz-card-meta">Yayın yalnızca owner tarafından yapılır.</p>
                      )}
                    </div>
                  </form>
                </div>
                <aside className="biz-conv-create-aside">
                  <h3 className="biz-studio-panel-title">Keşfet önizlemesi</h3>
                  {photoPreview && hasLiveCopy ? (
                    <YansiStudioDraftPreview
                      mode="discover"
                      businessId={businessId}
                      brandName={brandName}
                      preview={{
                        title: photoPreview.title,
                        summary: photoPreview.description,
                        curiosityQuestion: photoPreview.description || photoPreview.title,
                        turnCount: 0,
                        turns: [],
                        coverTitle: selectedCover?.title || null,
                        linkedKnowledge: photoPreview.linkedKnowledge,
                        knowledgeNotes: photoPreview.knowledgeNotes,
                        mediaOptional: true,
                      }}
                      coverAssetId={draft.coverAssetId || null}
                    />
                  ) : (
                    <div className="biz-conv-live-empty" data-testid="biz-conv-image-preview-empty">
                      {coverPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverPreviewUrl} alt="" className="biz-conv-live-empty-cover" />
                      ) : null}
                      <p className="biz-card-meta">Başlık girince kart önizlemesi oluşur.</p>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          ) : null}

          {flowStep === 3 && phase !== 'done' && publishKind === 'conversation' ? (
            <div className="biz-conv-step-panel biz-conv-review-workspace" data-testid="biz-conv-step-review">
              {phase === 'compose' && !editLocked ? (
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
                    <h3>İncele ve düzenle</h3>
                    <div data-testid="biz-conv-review-cover">
                      <p className="biz-card-meta">
                        Kapak — yükle, kütüphaneden seç veya AI ile oluştur
                      </p>
                      <div className="biz-conv-media-actions">
                        <label className="biz-btn-ghost biz-conv-upload-label" htmlFor={`${uploadInputId}-review`}>
                          {uploadBusy ? 'Yükleniyor…' : 'Görsel yükle'}
                        </label>
                        <input
                          id={`${uploadInputId}-review`}
                          data-testid="biz-conv-review-cover-upload"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          disabled={locked}
                          className="biz-conv-upload-input"
                          onChange={(e) => {
                            void handleCoverUpload(e.target.files);
                            e.target.value = '';
                          }}
                        />
                        <button
                          type="button"
                          className="biz-btn-ghost"
                          data-testid="biz-conv-review-cover-library"
                          disabled={locked}
                          onClick={() => setCoverPickerOpen(true)}
                        >
                          Kütüphane
                        </button>
                      </div>
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
                        {draft.coverAssetId &&
                        !images.some((asset) => asset.id === draft.coverAssetId) ? (
                          <CoverThumb
                            key={`review-orphan-${draft.coverAssetId}`}
                            businessId={businessId}
                            assetId={draft.coverAssetId}
                            title="Seçili kapak"
                            selected
                            onSelect={() => persist({ ...draft, coverAssetId: draft.coverAssetId })}
                          />
                        ) : null}
                      </div>
                      {!draft.coverAssetId ? (
                        <p className="biz-card-meta" data-testid="biz-conv-review-coverless-note">
                          Kapaksız yayın public bağlantıyla açılır; Keşfet’te görünmez.
                        </p>
                      ) : null}
                      {draft.draftId && draft.revision != null ? (
                        <ConversationCoverAiPanel
                          businessId={businessId}
                          draftId={draft.draftId}
                          draftRevision={draft.revision}
                          knowledgeVersionIds={readySourceIds}
                          enabled={coverAiEnabled}
                          locked={locked}
                          onBound={(dto) => {
                            const merged = applyServerDraft(draft, dto);
                            persist(merged);
                            setServer(dto);
                            rememberDraft(dto);
                            setDirty(false);
                            if (dto.status === 'draft' && sawApproved) {
                              /* approval invalidation surfaced by existing banner */
                            }
                          }}
                          onAssetsChanged={onAssetsChanged}
                        />
                      ) : (
                        <p className="biz-notice" data-testid="biz-conv-cover-ai-need-save">
                          AI kapak için önce taslağı kaydedin (önizleme kaydı).
                        </p>
                      )}
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

          {phase === 'done' && (result || imageResult) && publishedHref ? (
            <div className="biz-conv-done" data-testid="biz-conv-done">
              <h3>Yayınlandı</h3>
              <p className="biz-card-meta" data-testid="biz-conv-status-published">
                Durum: {statusLabel('published')}
              </p>
              <p className="biz-copy">
                Yansı yayımlandı. Public bağlantıyı paylaşabilir veya doğrudan açabilirsiniz.
                {publishedHasCover
                  ? ' Kapaklı yayınlar Keşfet uygunluk kurallarına göre listelenebilir.'
                  : ' Kapak seçilmediği için Keşfet’te görünmeyebilir; public bağlantı yine de çalışır.'}
              </p>
              {result ? (
                <ul data-testid="biz-conv-publish-meta">
                  <li>Adres: {result.slug}</li>
                  <li data-testid="biz-conv-publish-turn-count">
                    Soru-cevap: {result.turnCount}
                  </li>
                  <li>
                    Public URL:{' '}
                    <a
                      href={publishedHref}
                      data-testid="biz-conv-public-url"
                    >
                      {publishedHref}
                    </a>
                  </li>
                </ul>
              ) : null}
              {imageResult ? (
                <ul data-testid="biz-conv-image-publish-meta">
                  <li>Adres: {imageResult.slug}</li>
                  <li>
                    Public URL:{' '}
                    <a
                      href={publishedHref}
                      data-testid="biz-conv-image-public-url"
                    >
                      {publishedHref}
                    </a>
                  </li>
                </ul>
              ) : null}
              {copyFeedback ? (
                <p className="biz-notice" role="status" data-testid="biz-conv-copy-feedback">
                  {copyFeedback}
                </p>
              ) : null}
              <div className="biz-actions">
                <a
                  className="biz-btn-primary"
                  href={publishedHref}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="biz-conv-open-public"
                >
                  Yansı&apos;yı aç
                </a>
                <button
                  type="button"
                  className="biz-btn-secondary"
                  data-testid="biz-conv-copy-link"
                  onClick={() => {
                    void copyPublishedLink();
                  }}
                >
                  Bağlantıyı kopyala
                </button>
                <button
                  type="button"
                  className="biz-btn-secondary"
                  data-testid="biz-conv-go-mine"
                  onClick={() => {
                    onOpenMine?.();
                    setOpen(false);
                  }}
                >
                  Yansılarım&apos;a dön
                </button>
                <button
                  type="button"
                  className="biz-btn-secondary"
                  data-testid="biz-conv-new-after-publish"
                  onClick={() => {
                    setOpen(true);
                    resetAll(false);
                  }}
                >
                  Yeni Yansı
                </button>
              </div>
            </div>
          ) : null}

        </div>
      ) : null}

      <StudioBrandImagePicker
        open={coverPickerOpen}
        businessId={businessId}
        assets={assets}
        selectedAssetId={draft.coverAssetId || null}
        onClose={() => setCoverPickerOpen(false)}
        onConfirm={(assetId) => {
          persist({ ...draft, coverAssetId: assetId });
        }}
        onManageLibrary={onOpenLibrary}
      />
    </div>
  );
}
