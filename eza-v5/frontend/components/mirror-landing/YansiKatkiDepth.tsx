'use client';

/**
 * Desktop Katkılar depth for the frozen Yansı already on screen.
 * Read is public. Create uses the existing sign-in path.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, useIsPresent } from 'framer-motion';
import { Check, ChevronRight, Info, Pencil, FileText, Users, Send } from 'lucide-react';
import { resolvePublicAuthorIdentity } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { useAuth } from '@/context/AuthContext';
import {
  type KatkiChooseFrom,
  type KatkiStage,
  type KatkiType,
} from '@/lib/eza/mirror-network/katkiDepth';
import {
  KATKI_BODY_MAX,
  KATKI_SOURCE_MAX,
  KATKI_COMPOSE_PLACEHOLDERS,
  KATKI_COMPOSE_PROMPTS,
  KATKI_CREATE_ORDER,
  createPublicKatki,
  fetchPublicKatki,
  groupContentKatki,
  katkiBodyProgress,
  katkiCreateErrorMessage,
  katkiTypeLabel,
  validateKatkiDraft,
  type KatkiReadStatus,
  type PublicKatkiContributor,
  type PublicKatkiRead,
} from '@/lib/eza/mirror-network/katkiPublic';

const PANEL_EXPLANATION =
  "Bu Yansı'daki düşünce ve bilgiler, insanların katkılarıyla daha da zenginleşiyor.";

export type YansiKatkiDepthProps = {
  slug: string;
  journeyVersion: number;
  stage: Exclude<KatkiStage, 'closed'>;
  read: PublicKatkiRead | null;
  readStatus: KatkiReadStatus;
  /** Chain request generation captured for this render. Stale creates must not apply. */
  readGeneration: number;
  onReadChange: (read: PublicKatkiRead, readGeneration: number) => void;
  selectedType: KatkiType | null;
  chooseFrom: KatkiChooseFrom;
  body: string;
  sourceNote: string;
  onClose: () => void;
  onBack: () => void;
  onStartCreate: () => void;
  onChooseType: (type: KatkiType) => void;
  onChangeType: () => void;
  onBodyChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSubmitted: () => void;
  onRequireAuth?: () => void;
  yansiIdentity?: YansiSocialIdentity;
  onBeforeLeave?: (guard: KatkiLeaveGuard | null) => void;
};

export type YansiSocialIdentity = { publicTitle: string; sceneImageUrl: string | null };
export type KatkiLeaveGuard = (proceed: () => void) => boolean;

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function YansiSocialPanelPresence({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return reducedMotion ? <>{children}</> : <AnimatePresence mode="wait">{children}</AnimatePresence>;
}

/** Shared presentation only; the chain continues to own panel state. */
function SocialDialog({ children, label, compact = false, creating = false, onClose }: {
  children: ReactNode; label: string; compact?: boolean; creating?: boolean; onClose: () => boolean | void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  useEffect(() => {
    if (!isPresent) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const outside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || panelRef.current?.contains(target)) return;
      // These dedicated controls already own toggle/switch behavior.
      if (target.closest('[data-testid="yansi-katki-reel-signal"], [data-testid="yansi-katki-verifiers"]')) return;
      if (closeRef.current() === false) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // Observe the event before a stage change detaches the clicked button.
    document.addEventListener('click', outside, true);
    return () => {
      document.removeEventListener('click', outside, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isPresent]);
  return (
    <motion.div
      ref={panelRef}
      className={`yansi-katki-depth__panel ${compact ? 'yansi-verifier-panel__panel' : 'yansi-katki-depth__lane'}${creating ? ' yansi-katki-depth__panel--creating' : ''}`}
      data-testid={compact ? undefined : 'yansi-katki-lane'}
      role="dialog" aria-label={label} tabIndex={-1}
      aria-hidden={!isPresent || undefined}
      style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
      transition={{ duration: reducedMotion ? 0 : 0.14 }}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
        ) ?? []);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
    >
      {children}
    </motion.div>
  );
}

const TYPE_DESCRIPTIONS: Record<Exclude<KatkiType, 'verify'>, string> = {
  correction: 'Yanlış veya eksik olduğunu düşündüğün bilgiyi düzelt.',
  additional_information: 'Konunun daha iyi anlaşılmasına yardımcı olabilecek yeni bilgiler ekle.',
  different_perspective: 'Bu konuya farklı bir perspektiften bakmak istediğini paylaş.',
};
const TYPE_ICONS = { correction: Pencil, additional_information: FileText, different_perspective: Users };

function SocialHeader({ identity, title, description, closeId, onClose }: {
  identity?: YansiSocialIdentity; title: string; description: string;
  closeId: string; onClose: () => void;
}) {
  return <header className="yansi-social-header">
    {identity?.sceneImageUrl ? <img className="yansi-social-header__thumbnail" src={identity.sceneImageUrl} alt="" /> : null}
    <div className="yansi-social-header__copy">
      {identity?.publicTitle ? <p className="yansi-social-header__identity">{identity.publicTitle}</p> : null}
      <h2 className="yansi-katki-depth__title">{title}</h2>
      <p className="yansi-katki-depth__explain">{description}</p>
    </div>
    <button type="button" className="yansi-katki-depth__close" data-testid={closeId}
      aria-label="Kapat" onClick={onClose}>×</button>
  </header>;
}

function ContributionCard({ person, type, body, sourceNote, createdAt, testId }: {
  person: PublicKatkiContributor; type: KatkiType; body: string | null; sourceNote: string | null;
  createdAt?: string; testId?: string;
}) {
  return <article className="yansi-katki-depth__row" data-type={type} data-testid={testId}>
    <ProfileUserAvatar displayName={person.displayName} avatarUrl={person.publicAvatarUrl}
      cacheBust={person.publicAvatarRevision || undefined} size="sm" />
    <div className="yansi-katki-depth__row-copy">
      <div className="yansi-katki-depth__row-heading">
        <p className="yansi-katki-depth__name">{person.displayName}</p>
        <span className="yansi-katki-depth__type">{katkiTypeLabel(type)}</span>
        {createdAt && formatCreatedAt(createdAt) ? <time dateTime={createdAt}>{formatCreatedAt(createdAt)}</time> : null}
      </div>
      {body ? <p className="yansi-katki-depth__body">{body}</p> : null}
      {sourceNote ? <p className="yansi-katki-depth__source">{sourceNote}</p> : null}
    </div>
  </article>;
}

export default function YansiKatkiDepth({
  slug, journeyVersion, stage, read, readStatus, readGeneration, onReadChange,
  selectedType, chooseFrom, body, sourceNote, onClose, onBack, onStartCreate,
  onChooseType, onChangeType, onBodyChange, onSourceChange, onSubmitted, onRequireAuth,
  yansiIdentity, onBeforeLeave,
}: YansiKatkiDepthProps) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [sourceOpen, setSourceOpen] = useState(Boolean(sourceNote));
  const [contentFilter, setContentFilter] = useState<'all' | Exclude<KatkiType, 'verify'>>('all');
  const [choice, setChoice] = useState<KatkiType | null>(selectedType);
  const [composeView, setComposeView] = useState<'write' | 'preview' | 'success'>('write');
  const [visibility, setVisibility] = useState<'checking' | 'visible' | 'unconfirmed'>('checking');
  const [previewPerson, setPreviewPerson] = useState<PublicKatkiContributor | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const closeButtonRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelExitRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef({ slug, journeyVersion });
  targetRef.current = { slug, journeyVersion };
  const draftRef = useRef({ stage, body, sourceNote, composeView });
  draftRef.current = { stage, body, sourceNote, composeView };
  const normalizedSlug = slug.trim().toLowerCase();
  const snapshot = read && read.slug === normalizedSlug && read.journeyVersion === journeyVersion ? read : null;
  const loading = readStatus === 'loading' || (readStatus === 'ready' && !snapshot);
  const loadFailed = readStatus === 'error';

  useEffect(() => {
    submittingRef.current = false;
    setSubmitting(false);
    setComposeView('write');
    setVisibility('checking');
    setNotice(null);
    pendingLeave.current = null;
    setConfirmExit(false);
    return () => { generationRef.current += 1; };
  }, [slug, journeyVersion]);
  useEffect(() => {
    if (stage === 'choose') { setChoice(selectedType); setComposeView('write'); }
  }, [stage, selectedType]);
  useEffect(() => {
    if (confirmExit) cancelExitRef.current?.focus({ preventScroll: true });
    else if (stage === 'list') closeButtonRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    else headingRef.current?.focus({ preventScroll: true });
  }, [stage, composeView, confirmExit]);

  // Preview uses only public identity fields, never email or private full_name.
  useEffect(() => {
    let cancelled = false;
    setPreviewPerson(null);
    if (!isAuthenticated || !user?.user_id) return;
    if (user.public_display_name?.trim()) {
      setPreviewPerson({ displayName: user.public_display_name.trim(), publicAvatarUrl: user.public_avatar_url ?? null,
        publicAvatarRevision: user.public_avatar_revision ?? 0, publicHonorific: '' });
      return;
    }
    void resolvePublicAuthorIdentity(user.user_id).then((identity) => {
      if (!cancelled) setPreviewPerson({ displayName: identity.displayName, publicAvatarUrl: identity.publicAvatarUrl ?? null,
        publicAvatarRevision: identity.publicAvatarRevision ?? 0, publicHonorific: '' });
    }).catch(() => { if (!cancelled) setNotice('Public profil bilgilerin şu an yüklenemedi.'); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.user_id, user?.public_display_name, user?.public_avatar_url, user?.public_avatar_revision]);

  const guardLeave = useCallback<KatkiLeaveGuard>((proceed) => {
    if (submittingRef.current) { setNotice('Gönderim tamamlanırken lütfen bekle.'); return false; }
    if (pendingLeave.current) { pendingLeave.current = null; setConfirmExit(false); return false; }
    const draft = draftRef.current;
    if (draft.composeView !== 'success' && (draft.body.trim() || draft.sourceNote.trim())) {
      pendingLeave.current = proceed;
      setConfirmExit(true);
      return false;
    }
    proceed();
    return true;
  }, []);
  useEffect(() => {
    onBeforeLeave?.(guardLeave);
    return () => onBeforeLeave?.(null);
  }, [guardLeave, onBeforeLeave]);
  const requestClose = () => guardLeave(onClose);
  const requestAuth = () => {
    setNotice('Katkı bırakmak için giriş yapmalısın.');
    onRequireAuth?.();
  };
  const startCreate = () => {
    if (!isAuthReady) { setNotice('Oturumun hazırlanıyor.'); return; }
    if (!isAuthenticated) { requestAuth(); return; }
    setNotice(null);
    onStartCreate();
  };

  const validation = selectedType ? validateKatkiDraft(selectedType, body, sourceNote) : null;
  const valid = selectedType !== 'verify' && validation?.ok === true;
  const submit = async () => {
    if (!selectedType || selectedType === 'verify' || submittingRef.current || composeView === 'success') return;
    if (!isAuthReady) return;
    if (!isAuthenticated) { requestAuth(); return; }
    const draft = validateKatkiDraft(selectedType, body, sourceNote);
    if (!draft.ok) { setNotice(draft.message); return; }
    const generation = generationRef.current;
    const chainGeneration = readGeneration;
    const slugAt = slug;
    const versionAt = journeyVersion;
    const stillCurrent = () => generation === generationRef.current &&
      targetRef.current.slug === slugAt && targetRef.current.journeyVersion === versionAt;
    submittingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await createPublicKatki({ slug: slugAt, journeyVersion: versionAt,
        type: selectedType, body: draft.body, sourceNote: draft.sourceNote });
      if (!stillCurrent()) return;
      if (!result.ok) {
        const mapped = katkiCreateErrorMessage(result.code);
        if (mapped === 'auth') requestAuth();
        else setNotice(mapped);
        return;
      }
      // A successful POST proves receipt; public GET proves visibility and counts.
      setComposeView('success');
      setVisibility('checking');
      try {
        const reconciled = await fetchPublicKatki(slugAt, versionAt);
        if (!stillCurrent()) return;
        if (reconciled.ok && reconciled.data.slug === normalizedSlug && reconciled.data.journeyVersion === versionAt) {
          onReadChange(reconciled.data, chainGeneration);
          setVisibility(reconciled.data.contributions.some((row) => row.contributionId === result.data.contributionId)
            ? 'visible' : 'unconfirmed');
        } else setVisibility('unconfirmed');
      } catch {
        if (stillCurrent()) setVisibility('unconfirmed');
      }
    } catch {
      if (stillCurrent()) setNotice('Gönderim sonucu doğrulanamadı. Taslağın korundu; yeniden göndermeden önce katkı listesini kontrol et.');
    } finally {
      if (stillCurrent()) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const groups = groupContentKatki(snapshot?.contributions ?? []).filter((group) => contentFilter === 'all' || group.type === contentFilter);
  const contentCount = snapshot?.contentVisibleCount ?? 0;
  const filteredCount = snapshot ? (contentFilter === 'all' ? contentCount : snapshot.countsByType[contentFilter]) : null;
  const creating = stage !== 'list';
  const success = creating && composeView === 'success';
  const activeStep = stage === 'choose' ? 1 : composeView === 'write' ? 2 : 3;
  const composePlaceholder = selectedType && selectedType !== 'verify' ? KATKI_COMPOSE_PLACEHOLDERS[selectedType] : '';
  const composePrompt = selectedType && selectedType !== 'verify' ? KATKI_COMPOSE_PROMPTS[selectedType] : "Bu Yansı'ya ne eklemek istersin?";
  const returnToList = onBack;

  return <div className="yansi-katki-depth" data-testid="yansi-katki-depth"
    data-yansi-katki-stage={stage} data-yansi-katki-target={`${slug}:${journeyVersion}`}
    onWheel={(event) => event.stopPropagation()}>
    <SocialDialog label={creating ? 'Katkı yap' : 'Topluluk Katkıları'} creating={creating && !success} onClose={requestClose}>
      <div ref={closeButtonRef}>
        <SocialHeader identity={yansiIdentity} title={success ? 'Katkın gönderildi' : creating ? 'Katkı yap' : `Topluluk Katkıları ${contentCount}`}
          description={creating ? "Bu Yansı'ya kendi düşünceni, bilgisini veya farklı bakışını ekleyebilirsin." : PANEL_EXPLANATION}
          closeId="yansi-katki-close" onClose={requestClose} />
      </div>
      {notice ? <p className="yansi-katki-depth__notice" role="alert" data-testid="yansi-katki-notice">{notice}</p> : null}
      {confirmExit ? <div className="yansi-katki-exit" data-testid="yansi-katki-exit-confirm">
        <h3 ref={headingRef} tabIndex={-1}>Katkından çıkmak istiyor musun?</h3>
        <p>Çıkarsan bu katkı taslağı silinecek.</p>
        <div className="yansi-katki-flow__actions">
          <button ref={cancelExitRef} type="button" className="yansi-katki-depth__back" data-testid="yansi-katki-keep-draft"
            onClick={() => { pendingLeave.current = null; setConfirmExit(false); }}>Yazmaya devam et</button>
          <button type="button" className="yansi-katki-depth__submit" data-testid="yansi-katki-discard"
            onClick={() => { const proceed = pendingLeave.current; pendingLeave.current = null; setConfirmExit(false); proceed?.(); }}>Taslağı sil ve çık</button>
        </div>
      </div> : stage === 'list' ? <div data-testid="yansi-katki-list">
        {snapshot ? <div className="yansi-katki-depth__filters" role="group" aria-label="Katkı türleri">
          <button type="button" className="yansi-katki-depth__filter" data-active={contentFilter === 'all'}
            aria-pressed={contentFilter === 'all'} onClick={() => setContentFilter('all')}>Tümü {contentCount}</button>
          {KATKI_CREATE_ORDER.map((group) => <button key={group.type} type="button" className="yansi-katki-depth__filter"
            data-testid={`yansi-katki-filter-${group.type}`} data-active={contentFilter === group.type} aria-pressed={contentFilter === group.type}
            onClick={() => setContentFilter(group.type)}>{group.label} {snapshot.countsByType[group.type]}</button>)}
        </div> : null}
        {loading ? <p className="yansi-katki-depth__status" data-testid="yansi-katki-loading">Katkılar hazırlanıyor</p> : null}
        {loadFailed ? <p className="yansi-katki-depth__status" role="alert">Katkılar şu an açılamadı.</p> : null}
        {!loading && !loadFailed && filteredCount === 0 ? <p className="yansi-katki-depth__status" data-testid="yansi-katki-empty">Bu görünümde katkı bulunmuyor.</p> : null}
        {!loading && !loadFailed ? groups.map((group) => <section key={group.type} className="yansi-katki-depth__group" data-testid={`yansi-katki-group-${group.type}`}>
          <ul className="yansi-katki-depth__rows">{group.rows.map((row) => <li key={row.contributionId}>
            <ContributionCard person={row.contributor} type={row.type} body={row.body} sourceNote={row.sourceNote}
              createdAt={row.createdAt} testId={`yansi-katki-row-${row.contributionId}`} />
          </li>)}</ul>
        </section>) : null}
        <button type="button" className="yansi-katki-depth__create" data-testid="yansi-katki-create" onClick={startCreate} disabled={!isAuthReady}>
          <span className="yansi-katki-depth__create-plus" aria-hidden="true">+</span><strong>Katkı yap</strong>
          <span className="yansi-katki-depth__create-copy">Bu Yansı’ya sen de katkında bulun.<br />Düşünceni, bilgisini veya farklı bir bakışını paylaş.</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div> : success ? <div className="yansi-katki-success" data-testid="yansi-katki-success" role="status">
        <div className="yansi-katki-success__mark" aria-hidden="true"><Check size={32} /></div>
        <h3 ref={headingRef} tabIndex={-1}>Teşekkür ederiz.</h3>
        <p>{visibility === 'checking' ? 'Katkın alındı. Görünürlüğü kontrol ediliyor.' : visibility === 'visible'
          ? 'Katkın bu Yansı’da görünür hale geldi.' : 'Katkın alındı. Görünür listede yer aldığı henüz doğrulanamadı.'}</p>
        <button type="button" className="yansi-katki-depth__submit" disabled={submitting} data-testid="yansi-katki-done"
          onClick={onSubmitted}>Tamam</button>
      </div> : <div className="yansi-katki-flow">
        <ol className="yansi-katki-flow__steps" aria-label="Katkı oluşturma adımları">
          {['Katkı türü', 'İçeriğini yaz', 'Önizle ve gönder'].map((label, index) => <li key={label} data-active={activeStep === index + 1}
            data-complete={activeStep > index + 1} aria-current={activeStep === index + 1 ? 'step' : undefined}>
            <span aria-hidden="true">{index + 1}</span><div>{label}{index === 0 && selectedType && selectedType !== 'verify' ? <small>{katkiTypeLabel(selectedType)}</small> : null}</div>
          </li>)}
        </ol>
        <div className="yansi-katki-flow__content">
          {stage === 'choose' ? <div data-testid="yansi-katki-type-choice">
            <h3 ref={headingRef} tabIndex={-1}>Katkı türünü seç</h3>
            <p className="yansi-katki-depth__prompt">Bu katkının en iyi hangi kategoriye uyduğunu seç.</p>
            <div className="yansi-katki-depth__types" role="group" aria-label="Katkı türü">
              {KATKI_CREATE_ORDER.map((group) => { const Icon = TYPE_ICONS[group.type]; return <button key={group.type} type="button"
                className="yansi-katki-depth__type-choice" data-testid={`yansi-katki-type-${group.type}`} data-active={choice === group.type}
                aria-pressed={choice === group.type} onClick={() => setChoice(group.type)}>
                <Icon size={22} aria-hidden="true" /><span><strong>{group.label}</strong><small>{TYPE_DESCRIPTIONS[group.type]}</small></span>
                {choice === group.type ? <Check className="yansi-katki-flow__selected" size={16} aria-hidden="true" /> : null}
              </button>; })}
            </div>
            <div className="yansi-katki-flow__actions">
              {chooseFrom === 'list' ? <button type="button" className="yansi-katki-depth__back" data-testid="yansi-katki-back" onClick={returnToList}>← Listeye dön</button> : null}
              <button type="button" className="yansi-katki-depth__submit" data-testid="yansi-katki-continue-type" disabled={!choice || choice === 'verify'}
                onClick={() => { if (choice && choice !== 'verify') { setNotice(null); onChooseType(choice); } }}>Devam et <ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </div> : composeView === 'write' ? <form className="yansi-katki-depth__composer" data-testid="yansi-katki-composer"
            onSubmit={(event) => { event.preventDefault(); if (valid && previewPerson) { setNotice(null); setComposeView('preview'); } }}>
            <h3 ref={headingRef} tabIndex={-1}>İçeriğini yaz</h3>
            <p className="yansi-katki-depth__selected" data-testid="yansi-katki-selected-type">{selectedType ? katkiTypeLabel(selectedType) : ''}</p>
            <label className="yansi-katki-depth__field" htmlFor="yansi-katki-body">{composePrompt}
              <textarea id="yansi-katki-body" data-testid="yansi-katki-body" value={body} maxLength={KATKI_BODY_MAX} rows={5}
                placeholder={composePlaceholder} onChange={(event) => onBodyChange(event.target.value)} aria-describedby="yansi-katki-character-count" />
            </label>
            <p id="yansi-katki-character-count" className="yansi-katki-depth__counter">{body.length} / {KATKI_BODY_MAX}</p>
            {katkiBodyProgress(body) ? <p className="yansi-katki-depth__hint" data-testid="yansi-katki-body-progress">{katkiBodyProgress(body)}</p> : null}
            {sourceOpen || sourceNote ? <label className="yansi-katki-depth__field yansi-katki-depth__field--optional" htmlFor="yansi-katki-source">Kaynak (isteğe bağlı)
              <textarea id="yansi-katki-source" data-testid="yansi-katki-source" value={sourceNote} maxLength={KATKI_SOURCE_MAX} rows={2}
                onChange={(event) => onSourceChange(event.target.value)} />
            </label> : <button type="button" className="yansi-katki-depth__source-toggle" data-testid="yansi-katki-source-toggle" onClick={() => setSourceOpen(true)}>+ Kaynak ekle</button>}
            {!previewPerson ? <p className="yansi-katki-depth__status">Public profil bilgilerin hazırlanıyor.</p> : null}
            <div className="yansi-katki-flow__actions">
              <button type="button" className="yansi-katki-depth__back" data-testid="yansi-katki-change-type" onClick={() => { setNotice(null); onChangeType(); }}>← Geri</button>
              <button type="submit" className="yansi-katki-depth__submit" data-testid="yansi-katki-continue-body" disabled={!valid || !previewPerson}>Devam et <ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </form> : <div data-testid="yansi-katki-preview">
            <h3 ref={headingRef} tabIndex={-1}>Önizle</h3><p className="yansi-katki-depth__prompt">Göndermeden önce katkını kontrol et.</p>
            {previewPerson && selectedType ? <ContributionCard person={previewPerson} type={selectedType} body={body.trim()} sourceNote={sourceNote.trim()} testId="yansi-katki-preview-card" /> : null}
            <div className="yansi-katki-flow__actions">
              <button type="button" className="yansi-katki-depth__back" data-testid="yansi-katki-preview-back" disabled={submitting} onClick={() => { setNotice(null); setComposeView('write'); }}>← Geri</button>
              <button type="button" className="yansi-katki-depth__submit" data-testid="yansi-katki-submit" disabled={submitting || !valid || !previewPerson}
                aria-busy={submitting} onClick={() => void submit()}><Send size={16} aria-hidden="true" />{submitting ? 'Gönderiliyor…' : 'Gönder'}</button>
            </div>
          </div>}
        </div>
      </div>}
    </SocialDialog>
  </div>;
}

export function YansiVerifierPanel({ count, people, onClose, yansiIdentity }: {
  count: number; people: PublicKatkiContributor[]; onClose: () => void; yansiIdentity?: YansiSocialIdentity;
}) {
  return <div className="yansi-katki-depth yansi-verifier-panel" data-testid="yansi-verifier-panel" onWheel={(event) => event.stopPropagation()}>
    <SocialDialog label="Doğrulayanlar" compact onClose={onClose}>
      <SocialHeader identity={yansiIdentity} title={`Doğrulayanlar ${count}`} description="Bu Yansı'yı doğrulayan kişiler."
        closeId="yansi-verifier-close" onClose={onClose} />
      <ul className="yansi-katki-depth__rows">{people.map((person, index) => <li key={`${person.displayName}-${index}`}>
        <article className="yansi-katki-depth__row" data-testid="yansi-verifier-person">
          <ProfileUserAvatar displayName={person.displayName} avatarUrl={person.publicAvatarUrl} cacheBust={person.publicAvatarRevision || undefined} size="sm" />
          <div className="yansi-katki-depth__row-heading"><p className="yansi-katki-depth__name">{person.displayName}</p>
            {person.publicHonorific ? <span className="yansi-katki-depth__honorific">{person.publicHonorific}</span> : null}
          </div>
        </article>
      </li>)}</ul>
      <aside className="yansi-verifier-panel__meaning"><Info size={22} strokeWidth={1.4} aria-hidden="true" />
        <div><h3>Doğrulama ne demek?</h3><p>Doğrulama, kullanıcıların bu Yansı'yı desteklediğini gösteren sosyal bir işarettir. İçeriğin kesin olarak doğru olduğunu veya uzmanlarca onaylandığını göstermez.</p></div>
      </aside>
    </SocialDialog>
  </div>;
}
