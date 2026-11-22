/**
 * Stage 04C — public read client for sealed Yansı V2 publications.
 * Uses existing GET /api/business-yansi/v2/public/{slug}[+ /versions/{n}].
 */

import { buildApiUrl } from '@/lib/apiUrl';
import {
  parseBusinessPublisher,
  type BusinessPublisher,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';

export type YansiV2PublicContentKind = 'conversation' | 'image' | 'mixed';

export type YansiV2PublicTurnMedia = {
  type: 'image' | 'video';
  assetId: string;
  title: string;
  contentPath?: string;
  href?: string;
  assetRevision?: number;
};

export type YansiV2PublicTurn = {
  stepIndex: number;
  question: string;
  answer: string;
  media: YansiV2PublicTurnMedia[];
};

export type YansiV2PublicConversationPayload = {
  turnCount: number;
  curiosityQuestion: string;
  turns: YansiV2PublicTurn[];
};

export type YansiV2PublicCover = {
  assetId: string;
  title: string;
  contentPath: string;
};

export type YansiV2PublicImageMedia = {
  assetId: string;
  contentPath: string;
  title: string | null;
};

export type YansiV2PublicConversationDto = {
  slug: string;
  conversation: YansiV2PublicConversationPayload;
  cover: YansiV2PublicCover | null;
};

export type YansiV2PublicImageDto = {
  slug: string;
  media: YansiV2PublicImageMedia;
};

export type YansiV2PublicPublication = {
  slug: string;
  publicationVersion: number;
  contentKind: YansiV2PublicContentKind;
  isCurrent: boolean;
  businessPublisher?: BusinessPublisher;
  public: YansiV2PublicConversationDto | YansiV2PublicImageDto;
};

const CONTENT_PATH =
  /^\/api\/business-yansi\/public-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseContentKind(raw: unknown): YansiV2PublicContentKind | null {
  if (raw === 'conversation' || raw === 'image' || raw === 'mixed') return raw;
  return null;
}

function parseTurnMedia(raw: unknown): YansiV2PublicTurnMedia | null {
  if (!isRecord(raw)) return null;
  if ('locator' in raw || 'url' in raw || 'path' in raw || 'src' in raw || 'file' in raw) {
    return null;
  }
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!assetId || !title) return null;
  if (raw.type === 'image') {
    const contentPath = typeof raw.contentPath === 'string' ? raw.contentPath : '';
    if (!CONTENT_PATH.test(contentPath)) return null;
    return {
      type: 'image',
      assetId,
      title,
      contentPath,
      assetRevision:
        typeof raw.assetRevision === 'number' ? Math.trunc(raw.assetRevision) : undefined,
    };
  }
  if (raw.type === 'video') {
    const href = typeof raw.href === 'string' ? raw.href : '';
    if (!/^https:\/\/\S+$/i.test(href)) return null;
    return {
      type: 'video',
      assetId,
      title,
      href,
      assetRevision:
        typeof raw.assetRevision === 'number' ? Math.trunc(raw.assetRevision) : undefined,
    };
  }
  return null;
}

function parseTurn(raw: unknown, expectedIndex: number): YansiV2PublicTurn | null {
  if (!isRecord(raw)) return null;
  const stepIndex = Number(raw.stepIndex);
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
  if (!Number.isInteger(stepIndex) || stepIndex !== expectedIndex) return null;
  if (stepIndex < 1 || stepIndex > 8) return null;
  if (!question || !answer) return null;
  const mediaRaw = Array.isArray(raw.media) ? raw.media : [];
  const media = mediaRaw
    .map((item) => parseTurnMedia(item))
    .filter((item): item is YansiV2PublicTurnMedia => item != null);
  return { stepIndex, question, answer, media };
}

function parseCover(raw: unknown): YansiV2PublicCover | null {
  if (raw == null) return null;
  if (!isRecord(raw)) return null;
  if ('locator' in raw) return null;
  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const contentPath = typeof raw.contentPath === 'string' ? raw.contentPath : '';
  if (!assetId || !title || !CONTENT_PATH.test(contentPath)) return null;
  return { assetId, title, contentPath };
}

function parseConversationPublic(
  raw: unknown,
  slug: string
): YansiV2PublicConversationDto | null {
  if (!isRecord(raw)) return null;
  const conversation = raw.conversation;
  if (!isRecord(conversation)) return null;
  const turnsRaw = Array.isArray(conversation.turns) ? conversation.turns : null;
  if (!turnsRaw || turnsRaw.length < 1 || turnsRaw.length > 8) return null;
  const turns: YansiV2PublicTurn[] = [];
  for (let i = 0; i < turnsRaw.length; i += 1) {
    const turn = parseTurn(turnsRaw[i], i + 1);
    if (!turn) return null;
    turns.push(turn);
  }
  const curiosityQuestion =
    typeof conversation.curiosityQuestion === 'string'
      ? conversation.curiosityQuestion.trim()
      : '';
  if (!curiosityQuestion || curiosityQuestion !== turns[0].question) return null;
  const turnCount = Number(conversation.turnCount);
  if (!Number.isInteger(turnCount) || turnCount !== turns.length) return null;
  return {
    slug,
    conversation: { turnCount, curiosityQuestion, turns },
    cover: parseCover(raw.cover),
  };
}

function parseImagePublic(raw: unknown, slug: string): YansiV2PublicImageDto | null {
  if (!isRecord(raw)) return null;
  const media = raw.media;
  if (!isRecord(media)) return null;
  if ('locator' in media) return null;
  const assetId = typeof media.assetId === 'string' ? media.assetId.trim() : '';
  const contentPath = typeof media.contentPath === 'string' ? media.contentPath : '';
  if (!assetId || !CONTENT_PATH.test(contentPath)) return null;
  return {
    slug,
    media: {
      assetId,
      contentPath,
      title: typeof media.title === 'string' ? media.title.trim() || null : null,
    },
  };
}

export function parseYansiV2PublicPublication(
  raw: unknown
): YansiV2PublicPublication | null {
  if (!isRecord(raw)) return null;
  if (raw.status !== 'ok') return null;
  const slug = typeof raw.slug === 'string' ? raw.slug.trim().toLowerCase() : '';
  const publicationVersion = Number(raw.publicationVersion);
  const contentKind = parseContentKind(raw.contentKind);
  if (!slug || !contentKind) return null;
  if (!Number.isInteger(publicationVersion) || publicationVersion < 1) return null;

  let publicDto: YansiV2PublicConversationDto | YansiV2PublicImageDto | null = null;
  if (contentKind === 'image') {
    publicDto = parseImagePublic(raw.public, slug);
  } else {
    publicDto = parseConversationPublic(raw.public, slug);
  }
  if (!publicDto) return null;

  const businessPublisher = parseBusinessPublisher(raw.businessPublisher);
  return {
    slug,
    publicationVersion: Math.trunc(publicationVersion),
    contentKind,
    isCurrent: raw.isCurrent === true,
    ...(businessPublisher ? { businessPublisher } : {}),
    public: publicDto,
  };
}

export async function fetchYansiV2PublicPublication(input: {
  slug: string;
  publicationVersion?: number | null;
}): Promise<YansiV2PublicPublication | null> {
  const slug = (input.slug || '').trim().toLowerCase();
  if (!slug) return null;
  const version =
    input.publicationVersion != null &&
    Number.isInteger(input.publicationVersion) &&
    input.publicationVersion >= 1
      ? input.publicationVersion
      : null;
  const path =
    version != null
      ? `/api/business-yansi/v2/public/${encodeURIComponent(slug)}/versions/${version}`
      : `/api/business-yansi/v2/public/${encodeURIComponent(slug)}`;
  const url = buildApiUrl(path);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return parseYansiV2PublicPublication(await response.json());
  } catch {
    return null;
  }
}
