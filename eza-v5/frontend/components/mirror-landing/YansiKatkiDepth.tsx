'use client';

/**
 * Desktop Katkılar depth for the frozen Yansı already on screen.
 * Read is public. Create uses the existing sign-in path.
 */

import { useEffect, useRef, useState } from 'react';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import { useAuth } from '@/context/AuthContext';
import {
  type KatkiStage,
  type KatkiType,
} from '@/lib/eza/mirror-network/katkiDepth';
import {
  KATKI_GROUP_ORDER,
  createPublicKatki,
  fetchPublicKatki,
  groupVisibleKatki,
  katkiCreateErrorMessage,
  katkiTypeLabel,
  mergeCreatedKatki,
  validateKatkiDraft,
  type PublicKatkiRead,
} from '@/lib/eza/mirror-network/katkiPublic';

const TYPE_PROMPT = "Bu Yansı'ya nasıl katkıda bulunmak istersin?";

export type YansiKatkiDepthProps = {
  slug: string;
  journeyVersion: number;
  stage: Exclude<KatkiStage, 'closed'>;
  selectedType: KatkiType | null;
  body: string;
  sourceNote: string;
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

export default function YansiKatkiDepth({
  slug,
  journeyVersion,
  stage,
  selectedType,
  body,
  sourceNote,
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
  const [read, setRead] = useState<PublicKatkiRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const generationRef = useRef(0);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const targetRef = useRef({ slug, journeyVersion });
  targetRef.current = { slug, journeyVersion };

  useEffect(() => {
    const generation = ++generationRef.current;
    const slugAt = slug;
    const versionAt = journeyVersion;
    setLoading(true);
    setLoadFailed(false);
    setRead(null);
    setNotice(null);
    setSubmitting(false);
    let cancelled = false;
    void fetchPublicKatki(slugAt, versionAt).then((result) => {
      if (cancelled || generation !== generationRef.current) return;
      if (
        targetRef.current.slug !== slugAt ||
        targetRef.current.journeyVersion !== versionAt
      ) {
        return;
      }
      if (!result.ok) {
        setLoading(false);
        setLoadFailed(true);
        return;
      }
      setRead(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
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
      setNotice(draft.message);
      return;
    }
    const generation = generationRef.current;
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
      generation !== generationRef.current ||
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
    setRead((current) => mergeCreatedKatki(current, result.data, slugAt, versionAt));
    onSubmitted();
  };

  const groups = groupVisibleKatki(read?.contributions ?? []);
  const backLabel = stage === 'list' ? 'Yansıya dön' : 'Katkılara dön';

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
      <div className="yansi-katki-depth__lane" data-testid="yansi-katki-lane">
        <div className="yansi-katki-depth__header">
          <button
            ref={backRef}
            type="button"
            className="yansi-katki-depth__back"
            data-testid="yansi-katki-back"
            onClick={onBack}
          >
            {backLabel}
          </button>
          <h2 className="yansi-katki-depth__title">Katkılar</h2>
        </div>

        {notice ? (
          <p className="yansi-katki-depth__notice" role="alert" data-testid="yansi-katki-notice">
            {notice}
          </p>
        ) : null}

        {stage === 'list' ? (
          <div data-testid="yansi-katki-list">
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
                    <h3 className="yansi-katki-depth__group-label">{group.label}</h3>
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
                              </p>
                              <p className="yansi-katki-depth__type">{katkiTypeLabel(row.type)}</p>
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
            <p className="yansi-katki-depth__prompt">{TYPE_PROMPT}</p>
            <div className="yansi-katki-depth__types" role="group" aria-label={TYPE_PROMPT}>
              {KATKI_GROUP_ORDER.map((group) => (
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
            <button
              type="button"
              className="yansi-katki-depth__change-type"
              data-testid="yansi-katki-change-type"
              onClick={onChangeType}
            >
              Türü değiştir
            </button>
            <label className="yansi-katki-depth__field" htmlFor="yansi-katki-body">
              Katkı metni
              <textarea
                id="yansi-katki-body"
                data-testid="yansi-katki-body"
                value={body}
                maxLength={2000}
                rows={5}
                onChange={(event) => onBodyChange(event.target.value)}
              />
            </label>
            {selectedType === 'verify' ? (
              <p className="yansi-katki-depth__hint">
                Metin isteğe bağlı. Yazarsan en az 20 karakter.
              </p>
            ) : (
              <p className="yansi-katki-depth__hint">En az 20 karakter.</p>
            )}
            <label className="yansi-katki-depth__field" htmlFor="yansi-katki-source">
              Kaynak notu
              <textarea
                id="yansi-katki-source"
                data-testid="yansi-katki-source"
                value={sourceNote}
                maxLength={500}
                rows={2}
                onChange={(event) => onSourceChange(event.target.value)}
              />
            </label>
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
      </div>
    </div>
  );
}
