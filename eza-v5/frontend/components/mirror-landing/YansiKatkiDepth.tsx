'use client';

/**
 * Desktop Katkılar depth for the frozen Yansı already on screen.
 * Read is public. Create uses the existing sign-in path.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, useIsPresent } from 'framer-motion';
import { Users, ShieldCheck } from 'lucide-react';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { useAuth } from '@/context/AuthContext';
import {
  type KatkiChooseFrom,
  type KatkiStage,
  type KatkiType,
} from '@/lib/eza/mirror-network/katkiDepth';
import {
  KATKI_COMPOSE_PLACEHOLDERS,
  KATKI_COMPOSE_PROMPTS,
  KATKI_CREATE_ORDER,
  createPublicKatki,
  fetchPublicKatki,
  groupContentKatki,
  katkiBodyProgress,
  katkiCreateErrorMessage,
  katkiTypeLabel,
  mergeCreatedKatki,
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
};

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
function SocialDialog({ children, label, compact = false, onClose }: {
  children: ReactNode; label: string; compact?: boolean; onClose: () => void;
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
      closeRef.current();
    };
    document.addEventListener('click', outside);
    return () => {
      document.removeEventListener('click', outside);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [isPresent]);
  return (
    <motion.div
      ref={panelRef}
      className={`yansi-katki-depth__panel ${compact ? 'yansi-verifier-panel__panel' : 'yansi-katki-depth__lane'}`}
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
      <div className="yansi-social-emblem" aria-hidden="true">
        {compact ? <ShieldCheck size={26} strokeWidth={1.4} /> : <Users size={26} strokeWidth={1.4} />}
      </div>
      {children}
    </motion.div>
  );
}

export default function YansiKatkiDepth({
  slug,
  journeyVersion,
  stage,
  read,
  readStatus,
  readGeneration,
  onReadChange,
  selectedType,
  chooseFrom,
  body,
  sourceNote,
  onClose,
  onBack,
  onStartCreate,
  onChooseType,
  onChangeType,
  onBodyChange,
  onSourceChange,
  onSubmitted,
  onRequireAuth,
}: YansiKatkiDepthProps) {
  const { isAuthenticated, isAuthReady } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [contentFilter, setContentFilter] = useState<'all' | Exclude<KatkiType, 'verify'>>('all');
  const generationRef = useRef(0);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const targetRef = useRef({ slug, journeyVersion });
  targetRef.current = { slug, journeyVersion };
  const normalizedSlug = slug.trim().toLowerCase();
  const snapshot =
    read && read.slug === normalizedSlug && read.journeyVersion === journeyVersion ? read : null;
  const loading = readStatus === 'loading' || (readStatus === 'ready' && !snapshot);
  const loadFailed = readStatus === 'error';

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, [slug, journeyVersion]);

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const requestAuth = () => {
    onRequireAuth?.();
  };

  const startCreate = () => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      requestAuth();
      return;
    }
    setNotice(null);
    onStartCreate();
  };

  const submit = async () => {
    if (!selectedType || submitting) return;
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      requestAuth();
      return;
    }
    const draft = validateKatkiDraft(selectedType, body, sourceNote);
    if (!draft.ok) {
      if (
        draft.message === 'Metin en az 20 karakter olmalı.' ||
        draft.message === 'Bu katkı için bir metin yazmalısın.'
      ) {
        setNotice(null);
        return;
      }
      setNotice(draft.message);
      return;
    }
    const depthGeneration = generationRef.current;
    const chainGeneration = readGeneration;
    const slugAt = slug;
    const versionAt = journeyVersion;
    setSubmitting(true);
    setNotice(null);
    const result = await createPublicKatki({
      slug: slugAt,
      journeyVersion: versionAt,
      type: selectedType,
      body: draft.body,
      sourceNote: draft.sourceNote,
    });
    if (
      depthGeneration !== generationRef.current ||
      targetRef.current.slug !== slugAt ||
      targetRef.current.journeyVersion !== versionAt
    ) {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    if (!result.ok) {
      const mapped = katkiCreateErrorMessage(result.code);
      if (mapped === 'auth') {
        requestAuth();
        return;
      }
      setNotice(mapped);
      return;
    }
    onReadChange(mergeCreatedKatki(snapshot, result.data, slugAt, versionAt), chainGeneration);
    onSubmitted();
    const reconciled = await fetchPublicKatki(slugAt, versionAt);
    if (
      depthGeneration !== generationRef.current ||
      targetRef.current.slug !== slugAt ||
      targetRef.current.journeyVersion !== versionAt
    ) {
      return;
    }
    if (
      !reconciled.ok ||
      reconciled.data.slug !== slugAt.trim().toLowerCase() ||
      reconciled.data.journeyVersion !== versionAt
    ) {
      return;
    }
    onReadChange(reconciled.data, chainGeneration);
  };

  const groups = groupContentKatki(snapshot?.contributions ?? []).filter(
    (group) => contentFilter === 'all' || group.type === contentFilter
  );
  const contentCount = snapshot?.contentVisibleCount ?? 0;
  const showBack = stage === 'compose' || (stage === 'choose' && chooseFrom === 'list');
  const composePrompt =
    selectedType && selectedType !== 'verify'
      ? KATKI_COMPOSE_PROMPTS[selectedType]
      : "Bu Yansı'ya ne eklemek istersin?";
  const composePlaceholder =
    selectedType && selectedType !== 'verify' ? KATKI_COMPOSE_PLACEHOLDERS[selectedType] : '';
  const bodyProgress = katkiBodyProgress(body);

  return (
    <div
      className="yansi-katki-depth"
      data-testid="yansi-katki-depth"
      data-yansi-katki-stage={stage}
      data-yansi-katki-target={`${slug}:${journeyVersion}`}
      onWheel={(event) => {
        event.stopPropagation();
      }}
    >
      <SocialDialog label="Topluluk Katkıları" onClose={onClose}>
        <div className="yansi-katki-depth__header">
          {showBack ? (
            <button
              ref={backRef}
              type="button"
              className="yansi-katki-depth__back"
              data-testid={stage === 'compose' ? 'yansi-katki-change-type' : 'yansi-katki-back'}
              onClick={() => {
                if (stage === 'compose') onChangeType();
                else onBack();
              }}
            >
              {stage === 'compose' && selectedType && selectedType !== 'verify'
                ? `← ${katkiTypeLabel(selectedType)}`
                : 'Geri'}
            </button>
          ) : (
            <span />
          )}
          <h2 className="yansi-katki-depth__title">
            {stage === 'list'
              ? `Topluluk Katkıları ${contentCount}`
              : stage === 'choose'
                ? 'Topluluk Katkıları'
                : ''}
          </h2>
          <button
            ref={showBack ? undefined : backRef}
            type="button"
            className="yansi-katki-depth__close"
            data-testid="yansi-katki-close"
            aria-label="Kapat"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {notice ? (
          <p className="yansi-katki-depth__notice" role="alert" data-testid="yansi-katki-notice">
            {notice}
          </p>
        ) : null}

        {stage === 'list' ? (
          <div data-testid="yansi-katki-list">
            <p className="yansi-katki-depth__explain">{PANEL_EXPLANATION}</p>
            {snapshot ? (
              <div className="yansi-katki-depth__filters" role="group" aria-label="Katkı türleri">
                <button
                  type="button"
                  className="yansi-katki-depth__filter"
                  data-active={contentFilter === 'all' ? 'true' : 'false'}
                  aria-pressed={contentFilter === 'all'}
                  onClick={() => setContentFilter('all')}
                >
                  Tümü {contentCount}
                </button>
                {KATKI_CREATE_ORDER.map((group) => (
                  <button
                    key={group.type}
                    type="button"
                    className="yansi-katki-depth__filter"
                    data-testid={`yansi-katki-filter-${group.type}`}
                    data-active={contentFilter === group.type ? 'true' : 'false'}
                    aria-pressed={contentFilter === group.type}
                    onClick={() => setContentFilter(group.type)}
                  >
                    {group.label} {snapshot.countsByType[group.type]}
                  </button>
                ))}
              </div>
            ) : null}
            {loading ? (
              <p className="yansi-katki-depth__status" data-testid="yansi-katki-loading">
                Katkılar hazırlanıyor
              </p>
            ) : null}
            {loadFailed ? (
              <p className="yansi-katki-depth__status" role="alert">
                Katkılar şu an açılamadı.
              </p>
            ) : null}
            {!loading && !loadFailed
              ? groups.map((group) => (
                  <section
                    key={group.type}
                    className="yansi-katki-depth__group"
                    data-testid={`yansi-katki-group-${group.type}`}
                  >
                    <ul className="yansi-katki-depth__rows">
                      {group.rows.map((row) => (
                        <li key={row.contributionId}>
                          <article
                            className="yansi-katki-depth__row"
                            data-testid={`yansi-katki-row-${row.contributionId}`}
                          >
                            <ProfileUserAvatar
                              displayName={row.contributor.displayName}
                              avatarUrl={row.contributor.publicAvatarUrl}
                              cacheBust={row.contributor.publicAvatarRevision || undefined}
                              size="sm"
                            />
                            <div className="yansi-katki-depth__row-copy">
                              <p className="yansi-katki-depth__name">
                                {row.contributor.displayName}
                                <span className="yansi-katki-depth__type">
                                  {katkiTypeLabel(row.type)}
                                </span>
                              </p>
                              {row.contributor.publicHonorific ? (
                                <p className="yansi-katki-depth__honorific">
                                  {row.contributor.publicHonorific}
                                </p>
                              ) : null}
                              {row.body ? (
                                <p className="yansi-katki-depth__body">{row.body}</p>
                              ) : null}
                              {row.sourceNote ? (
                                <p className="yansi-katki-depth__source">{row.sourceNote}</p>
                              ) : null}
                              {formatCreatedAt(row.createdAt) ? (
                                <time dateTime={row.createdAt}>
                                  {formatCreatedAt(row.createdAt)}
                                </time>
                              ) : null}
                            </div>
                          </article>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              : null}
            <button
              type="button"
              className="yansi-katki-depth__create"
              data-testid="yansi-katki-create"
              onClick={startCreate}
            >
              + Katkı yap
            </button>
          </div>
        ) : null}

        {stage === 'choose' ? (
          <div data-testid="yansi-katki-type-choice">
            <p className="yansi-katki-depth__prompt">Ne tür bir katkı bırakmak istersin?</p>
            <div className="yansi-katki-depth__types" role="group" aria-label="Ne tür bir katkı bırakmak istersin?">
              {KATKI_CREATE_ORDER.map((group) => (
                <button
                  key={group.type}
                  type="button"
                  className="yansi-katki-depth__type-choice"
                  data-testid={`yansi-katki-type-${group.type}`}
                  onClick={() => onChooseType(group.type)}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {stage === 'compose' && selectedType ? (
          <form
            className="yansi-katki-depth__composer"
            data-testid="yansi-katki-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="yansi-katki-depth__selected" data-testid="yansi-katki-selected-type">
              {katkiTypeLabel(selectedType)}
            </p>
            <label className="yansi-katki-depth__field" htmlFor="yansi-katki-body">
              {composePrompt}
              <textarea
                id="yansi-katki-body"
                data-testid="yansi-katki-body"
                value={body}
                maxLength={2000}
                rows={6}
                placeholder={composePlaceholder}
                onChange={(event) => onBodyChange(event.target.value)}
              />
            </label>
            {bodyProgress ? (
              <p className="yansi-katki-depth__hint" data-testid="yansi-katki-body-progress">
                {bodyProgress}
              </p>
            ) : null}
            {sourceOpen ? (
              <label className="yansi-katki-depth__field yansi-katki-depth__field--optional" htmlFor="yansi-katki-source">
                Kaynak
                <textarea
                  id="yansi-katki-source"
                  data-testid="yansi-katki-source"
                  value={sourceNote}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => onSourceChange(event.target.value)}
                />
              </label>
            ) : (
              <button
                type="button"
                className="yansi-katki-depth__source-toggle"
                data-testid="yansi-katki-source-toggle"
                onClick={() => setSourceOpen(true)}
              >
                + Kaynak ekle
              </button>
            )}
            <button
              type="submit"
              className="yansi-katki-depth__submit"
              data-testid="yansi-katki-submit"
              disabled={submitting}
            >
              Katkıyı bırak
            </button>
          </form>
        ) : null}
      </SocialDialog>
    </div>
  );
}

export function YansiVerifierPanel({
  count,
  people,
  onClose,
}: {
  count: number;
  people: PublicKatkiContributor[];
  onClose: () => void;
}) {
  return (
    <div
      className="yansi-katki-depth yansi-verifier-panel"
      data-testid="yansi-verifier-panel"
      onWheel={(event) => event.stopPropagation()}
    >
      <SocialDialog label="Doğrulayanlar" compact onClose={onClose}>
        <div className="yansi-katki-depth__header">
          <span />
          <h2 className="yansi-katki-depth__title">Doğrulayanlar {count}</h2>
          <button
            type="button"
            className="yansi-katki-depth__close"
            data-testid="yansi-verifier-close"
            aria-label="Kapat"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="yansi-katki-depth__explain">Bu Yansı&apos;yı doğrulayan kişiler</p>
        <ul className="yansi-katki-depth__rows">
          {people.map((person, index) => (
            <li key={`${person.displayName}-${index}`}>
              <article className="yansi-katki-depth__row" data-testid="yansi-verifier-person">
                <ProfileUserAvatar
                  displayName={person.displayName}
                  avatarUrl={person.publicAvatarUrl}
                  cacheBust={person.publicAvatarRevision || undefined}
                  size="sm"
                />
                <div className="yansi-katki-depth__row-copy">
                  <p className="yansi-katki-depth__name">{person.displayName}</p>
                  {person.publicHonorific ? (
                    <p className="yansi-katki-depth__honorific">{person.publicHonorific}</p>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
        <aside className="yansi-verifier-panel__meaning">
          <ShieldCheck size={22} strokeWidth={1.4} aria-hidden="true" />
          <div><h3>Doğrulama ne demek?</h3>
            <p>Bu Yansı’ya verilen bir sosyal destek işaretidir. Kesin doğruluk veya uzmanlık puanı değildir.</p>
          </div>
        </aside>
      </SocialDialog>
    </div>
  );
}
