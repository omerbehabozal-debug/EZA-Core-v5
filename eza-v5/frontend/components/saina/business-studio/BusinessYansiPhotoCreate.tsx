'use client';

/**
 * Stage 3C-1 / 3C-1B — single-photo Kaynaklı Yansı create + Bilgi Deposu bind/add.
 * Parallel to V1 AI/8-turn studio; Bilgi Deposu optional.
 */

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  type BrandAsset,
  type Knowledge,
  fetchBrandAssetPreview,
  isBusinessApiError,
  publishYansiV2Image,
  yansiV2PublicHref,
  type YansiV2ImagePublishResult,
} from '@/lib/eza/businessYansi';
import {
  assetAiAvailability,
  buildKnowledgeSourcePins,
  buildPhotoPreviewManifest,
  clearPhotoDraftStorage,
  knowledgeAiAvailability,
  linkableKnowledgeRows,
  normalizePhotoDraft,
  previewMatchesPublishedContract,
  publishableImageAssets,
  readPhotoDraftStorage,
  sealedBundleIncludesKnowledge,
  writePhotoDraftStorage,
  YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE,
  YANSI_V2_PHOTO_MAX_NOTE_CHARS,
  YANSI_V2_PHOTO_MAX_NOTES,
  YANSI_V2_PHOTO_MAX_TITLE,
  type YansiV2PhotoDraft,
  type YansiV2PhotoPreview,
} from '@/lib/eza/yansiV2PhotoCreate';
import { parseYansiV2PublicationContract } from '@/lib/eza/mirror/journey/yansiV2Publication';

type Phase = 'compose' | 'preview' | 'publishing' | 'done';
type SourceFilter = 'all' | 'ready' | 'private_view' | 'unavailable';

type Props = {
  businessId: string;
  assets: BrandAsset[];
  knowledge: Knowledge[];
  role: string;
  canEdit: boolean;
  busy?: boolean;
  onPublished?: (result: YansiV2ImagePublishResult) => void;
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

const emptyDraft = (): YansiV2PhotoDraft => ({
  assetId: '',
  title: '',
  description: '',
  knowledgeNotes: [''],
  linkedKnowledgeIds: [],
  slug: '',
});

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function revokeObjectUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    /* jsdom may lack blob URL APIs */
  }
}

function publishErrorMessage(error: unknown): string {
  if (isBusinessApiError(error)) {
    const map: Record<string, string> = {
      owner_required: 'Yalnızca Business owner Kaynaklı Yansı yayımlayabilir.',
      asset_not_found: 'Seçilen görsel bulunamadı.',
      asset_not_image: 'Yalnızca görsel varlıklar yayımlanabilir.',
      asset_not_published: 'Görsel yayımlanmış ve kamuya açık olmalıdır.',
      asset_not_public: 'Görsel kamuya açık (public) olmalıdır.',
      asset_not_approved: 'Görsel onaylı olmalıdır.',
      revision_conflict:
        'Varlık, bilgi kaydı veya yayın sürümü değişmiş. Listeyi yenileyip güncel sürümlerle yeniden deneyin.',
      slug_taken: 'Bu slug kullanımda. Farklı bir slug deneyin.',
      description_too_long: 'Açıklama çok uzun.',
      knowledge_note_too_long: 'Bir bilgi notu çok uzun.',
      too_many_knowledge_notes: 'En fazla 8 bilgi notu ekleyebilirsiniz.',
      too_many_knowledge_sources: 'En fazla 32 Bilgi Deposu kaynağı bağlanabilir.',
      knowledge_source_not_found: 'Bağlanan bilgi kaydı bulunamadı.',
      foreign_tenant_knowledge: 'Başka Business kaydı bağlanamaz.',
      knowledge_source_not_ready: 'Bağlanan kayıt yayımlanmış olmalıdır.',
      knowledge_source_empty: 'Boş bilgi kaydı bağlanamaz.',
      invalid_title: 'Başlık gerekli (en fazla 200 karakter).',
      invalid_idempotency_key: 'Tekrar deneme anahtarı geçersiz.',
      inactive_account: 'Hesap aktif değil.',
      business_not_found: 'Business bulunamadı.',
    };
    return map[error.code] || error.message || 'Yayın başarısız oldu.';
  }
  if (error instanceof Error) return error.message;
  return 'Yayın başarısız oldu.';
}

function PhotoThumb({
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
      data-testid={`biz-photo-create-asset-${assetId}`}
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

function PreviewCard({
  preview,
  businessId,
  imageSrc,
}: {
  preview: YansiV2PhotoPreview;
  businessId: string;
  imageSrc: string | null;
}) {
  return (
    <article className="biz-photo-create-preview" data-testid="biz-photo-create-preview">
      <div className="biz-photo-create-preview-media">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" />
        ) : (
          <p className="biz-empty">Görsel yükleniyor…</p>
        )}
      </div>
      <div className="biz-photo-create-preview-body">
        <p className="biz-studio-eyebrow">Görsel yayın</p>
        <h3>{preview.title}</h3>
        {preview.description ? <p className="biz-copy">{preview.description}</p> : null}
        <p className="biz-card-meta" data-testid="biz-photo-create-preview-manifest">
          contentKind: {preview.contentKind} · blok: {preview.contentManifest.blocks[0]?.type} · path:{' '}
          {preview.image.contentPath}
        </p>
        {preview.knowledgeNotes.length > 0 ? (
          <div data-testid="biz-photo-create-preview-notes">
            <h4>Bilgi notları</h4>
            <ul>
              {preview.knowledgeNotes.map((note, index) => (
                <li key={`${index}-${note.slice(0, 12)}`}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div data-testid="biz-photo-create-preview-sources">
          <h4>AI bilgi kapsamı</h4>
          {!preview.linkedKnowledge.length ? (
            <p className="biz-card-meta">Bağlı Bilgi Deposu kaydı yok — yalnızca görsel + notlar.</p>
          ) : (
            <ul>
              {preview.linkedKnowledge.map((row) => (
                <li key={row.id}>
                  {row.title}
                  {row.publicAllowed ? '' : ' · görüntüleme kapalı'} · rev {row.revision} ·{' '}
                  {row.aiStatusLabel}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="biz-card-meta">Yayın owner onayı ister; otomatik yayınlanmaz.</p>
      </div>
    </article>
  );
}

export default function BusinessYansiPhotoCreate({
  businessId,
  assets,
  knowledge,
  role,
  canEdit,
  busy = false,
  onPublished,
  onOpenLibrary,
  onOpenKnowledgePool,
  onSaveKnowledge,
  onKnowledgeChanged,
}: Props) {
  const formId = useId();
  const isOwner = role === 'owner';
  const images = useMemo(() => publishableImageAssets(assets), [assets]);
  const poolRows = useMemo(() => linkableKnowledgeRows(knowledge), [knowledge]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('compose');
  const [draft, setDraft] = useState<YansiV2PhotoDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [result, setResult] = useState<YansiV2ImagePublishResult | null>(null);
  const [manifestAligned, setManifestAligned] = useState<boolean | null>(null);
  const [bundleAligned, setBundleAligned] = useState<boolean | null>(null);
  const [bindOpen, setBindOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sourceQuery, setSourceQuery] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const idempotencyRef = useRef<string>(newIdempotencyKey());
  const selected = images.find((asset) => asset.id === draft.assetId) || null;
  const preview = selected
    ? buildPhotoPreviewManifest(businessId, selected, draft, knowledge)
    : null;

  useEffect(() => {
    const stored = readPhotoDraftStorage(businessId);
    if (stored && (stored.title || stored.assetId || stored.linkedKnowledgeIds.length)) {
      setDraft(stored);
      setOpen(true);
    }
  }, [businessId]);

  useEffect(() => {
    if (!selected || phase === 'compose') {
      setPreviewSrc((prev) => {
        revokeObjectUrl(prev);
        return null;
      });
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBrandAssetPreview(businessId, selected.id, 'original')
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        revoked = url;
        setPreviewSrc(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewSrc(null);
      });
    return () => {
      cancelled = true;
      revokeObjectUrl(revoked);
    };
  }, [businessId, selected, phase]);

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

  const mediaHonesty = useMemo(
    () => assets.filter((a) => a.status !== 'archived').slice(0, 8).map(assetAiAvailability),
    [assets],
  );

  function resetCompose(keepInputs: boolean) {
    setPhase('compose');
    setError(null);
    setResult(null);
    setManifestAligned(null);
    setBundleAligned(null);
    setBindOpen(false);
    setAddOpen(false);
    idempotencyRef.current = newIdempotencyKey();
    if (!keepInputs) {
      setDraft(emptyDraft());
      clearPhotoDraftStorage(businessId);
    }
  }

  function persistDraft(next: YansiV2PhotoDraft) {
    setDraft(next);
    writePhotoDraftStorage(businessId, next);
  }

  function toggleKnowledge(id: string) {
    const avail = knowledge.find((row) => row.id === id);
    if (!avail || !knowledgeAiAvailability(avail).aiReady) return;
    persistDraft(
      normalizePhotoDraft({
        ...draft,
        linkedKnowledgeIds: draft.linkedKnowledgeIds.includes(id)
          ? draft.linkedKnowledgeIds.filter((x) => x !== id)
          : draft.linkedKnowledgeIds.length >= YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE
            ? draft.linkedKnowledgeIds
            : [...draft.linkedKnowledgeIds, id],
      }),
    );
  }

  function goPreview() {
    setError(null);
    const normalized = normalizePhotoDraft(draft);
    if (!normalized.assetId) {
      setError('Kütüphaneden bir fotoğraf seçin.');
      return;
    }
    if (!normalized.title) {
      setError('Başlık gerekli.');
      return;
    }
    if (!selected) {
      setError('Seçilen görsel yayımlanabilir değil. Kamuya açık, onaylı bir görsel seçin.');
      return;
    }
    const stale = normalized.linkedKnowledgeIds.filter((id) => {
      const row = knowledge.find((k) => k.id === id);
      return !row || !knowledgeAiAvailability(row).aiReady;
    });
    if (stale.length) {
      setError('Bağlı kayıtlardan bazıları artık kullanılamıyor. Bağlantıları güncelleyin.');
      return;
    }
    if (!buildPhotoPreviewManifest(businessId, selected, normalized, knowledge)) {
      setError('Önizleme oluşturulamadı.');
      return;
    }
    persistDraft(normalized);
    setPhase('preview');
  }

  async function publish() {
    if (!isOwner) {
      setError('Yalnızca owner yayımlayabilir.');
      return;
    }
    if (!selected || !preview) {
      setError('Önizleme hazır değil.');
      return;
    }
    setError(null);
    setPhase('publishing');
    const normalized = normalizePhotoDraft(draft);
    const pins = buildKnowledgeSourcePins(normalized, knowledge);
    if (pins.length !== normalized.linkedKnowledgeIds.length) {
      setError('Bağlı kaynaklar değişmiş. Önizlemeyi yenileyin.');
      setPhase('preview');
      return;
    }
    try {
      const published = await publishYansiV2Image(businessId, {
        assetId: selected.id,
        expectedAssetRevision: selected.revision,
        title: normalized.title,
        description: normalized.description || null,
        knowledgeNotes: normalized.knowledgeNotes,
        ...(pins.length ? { knowledgeSources: pins } : {}),
        slug: normalized.slug || null,
        expectedCurrentVersion: null,
        idempotencyKey: idempotencyRef.current,
      });
      const aligned = previewMatchesPublishedContract(preview, published.public?.contract);
      const sealedOk = sealedBundleIncludesKnowledge(
        published.public?.bundle,
        normalized.linkedKnowledgeIds,
      );
      setManifestAligned(aligned);
      setBundleAligned(sealedOk);
      setResult(published);
      setPhase('done');
      clearPhotoDraftStorage(businessId);
      onPublished?.(published);
    } catch (err) {
      setError(publishErrorMessage(err));
      setPhase('preview');
    }
  }

  async function submitAddKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSaveKnowledge) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setAddBusy(true);
    setError(null);
    try {
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
      writePhotoDraftStorage(businessId, draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilgi kaydı eklenemedi.');
    } finally {
      setAddBusy(false);
    }
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="biz-yansi-workspace-block biz-photo-create" data-testid="biz-photo-create">
      <div className="biz-studio-hero">
        <h2 className="biz-section-title">Sadece görselle yayınla</h2>
        <p className="biz-section-lead">
          Kapak görseli seçin. Bilgi kaynakları isteğe bağlıdır. Yayın owner onayı gerektirir.
        </p>
        {!open ? (
          <div className="biz-actions">
            <button
              type="button"
              className="biz-btn-primary"
              data-testid="biz-photo-create-open"
              onClick={() => {
                setOpen(true);
                resetCompose(false);
              }}
            >
              Görsel seç
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
        <div className="biz-studio-panel" data-testid="biz-photo-create-panel">
          {!isOwner ? (
            <p className="biz-notice" role="status">
              Hazırlığı editor tamamlayabilir; yayınlama yalnızca owner tarafından yapılır.
            </p>
          ) : null}

          {phase === 'compose' ? (
            <form
              id={formId}
              className="biz-form"
              onSubmit={(event) => {
                event.preventDefault();
                goPreview();
              }}
            >
              <h3>1. Fotoğraf</h3>
              {!images.length ? (
                <p className="biz-empty" data-testid="biz-photo-create-empty-library">
                  Yayımlanabilir kamuya açık görsel yok. Önce İçerik Kütüphanesi’ne fotoğraf ekleyin.
                </p>
              ) : (
                <div className="biz-photo-create-grid" role="listbox" aria-label="Görsel seçimi">
                  {images.map((asset) => (
                    <PhotoThumb
                      key={asset.id}
                      businessId={businessId}
                      assetId={asset.id}
                      title={asset.title}
                      selected={draft.assetId === asset.id}
                      onSelect={() => persistDraft({ ...draft, assetId: asset.id })}
                    />
                  ))}
                </div>
              )}

              <h3>2. Metin</h3>
              <label htmlFor={`${formId}-title`}>
                Başlık
                <input
                  id={`${formId}-title`}
                  data-testid="biz-photo-create-title"
                  value={draft.title}
                  maxLength={YANSI_V2_PHOTO_MAX_TITLE}
                  onChange={(event) => persistDraft({ ...draft, title: event.target.value })}
                  required
                />
              </label>
              <label htmlFor={`${formId}-description`}>
                Açıklama (isteğe bağlı)
                <textarea
                  id={`${formId}-description`}
                  data-testid="biz-photo-create-description"
                  value={draft.description}
                  maxLength={YANSI_V2_PHOTO_MAX_NOTE_CHARS}
                  rows={3}
                  onChange={(event) => persistDraft({ ...draft, description: event.target.value })}
                />
              </label>

              <fieldset className="biz-photo-create-notes" data-testid="biz-photo-create-ai-sources">
                <legend>AI bilgi kaynakları (isteğe bağlı)</legend>
                <p className="biz-card-meta">
                  Otomatik medya analizi çalışmaz. Bağlanan Bilgi Havuzu kayıtları mühürlü pakete
                  knowledge_version olarak yazılır.
                </p>
                <div className="biz-actions">
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid="biz-photo-create-bind"
                    onClick={() => {
                      setBindOpen((v) => !v);
                      setAddOpen(false);
                    }}
                  >
                    Bilgi Deposuna Bağla
                    {draft.linkedKnowledgeIds.length
                      ? ` (${draft.linkedKnowledgeIds.length})`
                      : ''}
                  </button>
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid="biz-photo-create-add"
                    onClick={() => {
                      setAddOpen((v) => !v);
                      setBindOpen(false);
                      writePhotoDraftStorage(businessId, draft);
                    }}
                  >
                    Bilgi Deposuna Ekle
                  </button>
                  {onOpenKnowledgePool ? (
                    <button
                      type="button"
                      className="biz-btn-ghost"
                      data-testid="biz-photo-create-open-pool"
                      onClick={() => {
                        writePhotoDraftStorage(businessId, draft);
                        onOpenKnowledgePool();
                      }}
                    >
                      Bilgi Havuzu sekmesi
                    </button>
                  ) : null}
                </div>

                {draft.linkedKnowledgeIds.length ? (
                  <ul data-testid="biz-photo-create-linked-list">
                    {draft.linkedKnowledgeIds.map((id) => {
                      const row = knowledge.find((k) => k.id === id);
                      const meta = row ? knowledgeAiAvailability(row) : null;
                      return (
                        <li key={id}>
                          {meta?.title || id}
                          {meta ? ` · ${meta.aiStatusLabel}` : ' · eksik kayıt'}
                          <button
                            type="button"
                            className="biz-btn-ghost"
                            onClick={() => toggleKnowledge(id)}
                          >
                            Kaldır
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="biz-card-meta">Henüz bağlı kaynak yok — tek fotoğrafla yayınlanabilir.</p>
                )}

                {bindOpen ? (
                  <div className="biz-photo-create-bind" data-testid="biz-photo-create-bind-panel">
                    <div className="biz-actions">
                      <input
                        data-testid="biz-photo-create-bind-search"
                        placeholder="Kaynak ara"
                        value={sourceQuery}
                        onChange={(event) => setSourceQuery(event.target.value)}
                      />
                      <select
                        data-testid="biz-photo-create-bind-filter"
                        value={sourceFilter}
                        onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                      >
                        <option value="all">Tümü</option>
                        <option value="ready">AI + görüntüleme açık</option>
                        <option value="private_view">AI kullanır, görüntüleme kapalı</option>
                        <option value="unavailable">Bağlanamaz</option>
                      </select>
                    </div>
                    <p className="biz-card-meta" data-testid="biz-photo-create-bind-count">
                      Seçili: {draft.linkedKnowledgeIds.length} / {YANSI_V2_PHOTO_MAX_LINKED_KNOWLEDGE}
                      {poolRows.length ? ` · havuzda ${poolRows.length} yayımlı kayıt` : ''}
                    </p>
                    {!bindCandidates.length ? (
                      <p className="biz-empty">Bu filtrede kayıt yok.</p>
                    ) : (
                      <ul className="biz-photo-create-bind-list">
                        {bindCandidates.map((row) => {
                          const checked = draft.linkedKnowledgeIds.includes(row.id);
                          return (
                            <li key={row.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  data-testid={`biz-photo-create-bind-item-${row.id}`}
                                  checked={checked}
                                  disabled={!row.aiReady && !checked}
                                  onChange={() => toggleKnowledge(row.id)}
                                />
                                <span>
                                  <strong>{row.title}</strong>
                                  {row.category ? ` · ${row.category}` : ''}
                                  <br />
                                  <span className="biz-card-meta">
                                    {row.aiStatusLabel}
                                    {row.publicAllowed
                                      ? ' · usage+view'
                                      : row.aiReady
                                        ? ' · usage only'
                                        : ''}
                                    {' · '}rev {row.revision}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {mediaHonesty.length ? (
                      <details className="biz-photo-create-media-honesty">
                        <summary>Kütüphane medya / konum / URL AI durumu</summary>
                        <ul>
                          {mediaHonesty.map((row) => (
                            <li key={row.assetId}>
                              {row.title || row.assetType}: {row.label}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                {addOpen ? (
                  <div className="biz-photo-create-add" data-testid="biz-photo-create-add-panel">
                    {onSaveKnowledge ? (
                      <form className="biz-form" onSubmit={(event) => void submitAddKnowledge(event)}>
                        <p className="biz-card-meta">
                          Mevcut Bilgi Havuzu kaydetme API’si kullanılır. Yansı taslağınız korunur.
                        </p>
                        <label>
                          Başlık
                          <input name="title" required maxLength={200} disabled={addBusy || busy} />
                        </label>
                        <label>
                          Kategori
                          <input name="category" required maxLength={80} disabled={addBusy || busy} />
                        </label>
                        <label>
                          İçerik
                          <textarea name="content" required rows={4} disabled={addBusy || busy} />
                        </label>
                        <label>
                          Kaynak
                          <input name="source" required maxLength={500} disabled={addBusy || busy} />
                        </label>
                        <label>
                          <input name="publicAllowed" type="checkbox" defaultChecked disabled={addBusy || busy} />{' '}
                          Kullanıcılara açıklanmasına izin ver
                        </label>
                        <div className="biz-actions">
                          <button
                            type="submit"
                            className="biz-btn-primary"
                            data-testid="biz-photo-create-add-submit"
                            disabled={addBusy || busy}
                          >
                            {addBusy ? 'Kaydediliyor…' : 'Depoya ekle'}
                          </button>
                          <button
                            type="button"
                            className="biz-btn-ghost"
                            onClick={() => setAddOpen(false)}
                            disabled={addBusy}
                          >
                            Kapat
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="biz-empty">Kayıt ekleme bu oturumda kullanılamıyor.</p>
                    )}
                  </div>
                ) : null}

                {draft.knowledgeNotes.map((note, index) => (
                  <label key={`note-${index}`} htmlFor={`${formId}-note-${index}`}>
                    Serbest bilgi notu {index + 1}
                    <textarea
                      id={`${formId}-note-${index}`}
                      data-testid={`biz-photo-create-note-${index}`}
                      value={note}
                      maxLength={YANSI_V2_PHOTO_MAX_NOTE_CHARS}
                      rows={2}
                      onChange={(event) => {
                        const value = event.target.value;
                        const next = [...draft.knowledgeNotes];
                        next[index] = value;
                        persistDraft({ ...draft, knowledgeNotes: next });
                      }}
                    />
                  </label>
                ))}
                {draft.knowledgeNotes.length < YANSI_V2_PHOTO_MAX_NOTES ? (
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid="biz-photo-create-add-note"
                    onClick={() =>
                      persistDraft({
                        ...draft,
                        knowledgeNotes: [...draft.knowledgeNotes, ''],
                      })
                    }
                  >
                    Not ekle
                  </button>
                ) : null}
              </fieldset>

              <label htmlFor={`${formId}-slug`}>
                Slug (isteğe bağlı)
                <input
                  id={`${formId}-slug`}
                  data-testid="biz-photo-create-slug"
                  value={draft.slug}
                  maxLength={80}
                  onChange={(event) => persistDraft({ ...draft, slug: event.target.value })}
                />
              </label>
              <p className="biz-card-meta">Yanıt politikası: Kaynaklı (grounded) — sabit.</p>
              {error ? (
                <p className="biz-form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="biz-actions">
                <button type="submit" className="biz-btn-primary" data-testid="biz-photo-create-to-preview">
                  Önizleme
                </button>
                <button
                  type="button"
                  className="biz-btn-ghost"
                  onClick={() => {
                    setOpen(false);
                    resetCompose(false);
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          ) : null}

          {(phase === 'preview' || phase === 'publishing') && preview ? (
            <div>
              <PreviewCard preview={preview} businessId={businessId} imageSrc={previewSrc} />
              {error ? (
                <p className="biz-form-error" role="alert" data-testid="biz-photo-create-error">
                  {error}
                </p>
              ) : null}
              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  data-testid="biz-photo-create-publish"
                  disabled={!isOwner || phase === 'publishing'}
                  onClick={() => void publish()}
                >
                  {phase === 'publishing' ? 'Yayımlanıyor…' : 'Kaynaklı Yansı yayımla'}
                </button>
                <button
                  type="button"
                  className="biz-btn-ghost"
                  disabled={phase === 'publishing'}
                  onClick={() => {
                    setError(null);
                    setPhase('compose');
                  }}
                >
                  Düzenle
                </button>
              </div>
            </div>
          ) : null}

          {phase === 'done' && result ? (
            <div className="biz-notice" data-testid="biz-photo-create-success" role="status">
              <h3>Yayınlandı</h3>
              <p>
                {result.idempotent ? 'Önceki yayın (idempotent yeniden deneme).' : 'Yeni Kaynaklı Yansı mühürlendi.'}
              </p>
              <p className="biz-card-meta">
                slug: {result.slug} · sürüm {result.publicationVersion}
                {manifestAligned === false ? ' · uyarı: önizleme/manifest doğrulaması zayıf' : ''}
                {bundleAligned === false ? ' · uyarı: bağlı kaynaklar bundle’da eksik' : ''}
                {bundleAligned ? ' · bağlı kaynaklar mühürlendi' : ''}
              </p>
              <p>
                <a
                  href={yansiV2PublicHref(result.slug, result.publicationVersion)}
                  data-testid="biz-photo-create-public-link"
                >
                  Public bağlantı
                </a>
              </p>
              {result.public?.contract && parseYansiV2PublicationContract(result.public.contract) ? (
                <p className="biz-card-meta" data-testid="biz-photo-create-published-kind">
                  Tür:{' '}
                  {String(
                    (parseYansiV2PublicationContract(result.public.contract) as { contentKind: string })
                      .contentKind,
                  )}
                </p>
              ) : null}
              <div className="biz-actions">
                <button
                  type="button"
                  className="biz-btn-primary"
                  data-testid="biz-photo-create-another"
                  onClick={() => {
                    setOpen(true);
                    resetCompose(false);
                  }}
                >
                  Yeni bir Yansı daha
                </button>
                <button
                  type="button"
                  className="biz-btn-ghost"
                  onClick={() => {
                    setOpen(false);
                    resetCompose(false);
                  }}
                >
                  Kapat
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
