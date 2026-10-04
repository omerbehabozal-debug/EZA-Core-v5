/**
 * Public Katkı read/create. Exact slug + journeyVersion. No attachment identity.
 */

import { apiClient } from '@/lib/apiClient';
import {
  KATKI_TYPES,
  type KatkiType,
} from '@/lib/eza/mirror-network/katkiDepth';

export type PublicKatkiContributor = {
  displayName: string;
  publicAvatarUrl: string | null;
  publicAvatarRevision: number;
};

export type PublicKatkiContribution = {
  contributionId: string;
  type: KatkiType;
  body: string | null;
  sourceNote: string | null;
  createdAt: string;
  contributor: PublicKatkiContributor;
};

export type PublicKatkiRead = {
  slug: string;
  journeyVersion: number;
  totalVisibleCount: number;
  countsByType: Record<KatkiType, number>;
  contributions: PublicKatkiContribution[];
};

export const KATKI_GROUP_ORDER: { type: KatkiType; label: string }[] = [
  { type: 'verify', label: 'Doğrulama' },
  { type: 'correction', label: 'Düzeltme' },
  { type: 'additional_information', label: 'Ek Bilgi' },
  { type: 'different_perspective', label: 'Farklı Bakış' },
];

const BODY_MIN = 20;
const BODY_MAX = 2000;
const SOURCE_MAX = 500;

export const KATKI_EMPTY_COPY_FORBIDDEN = [
  '0 katkı',
  'Henüz katkı yok',
  'İlk katkıyı sen yap',
] as const;

export function katkiTypeLabel(type: KatkiType): string {
  return KATKI_GROUP_ORDER.find((group) => group.type === type)?.label ?? type;
}

export function groupVisibleKatki(
  contributions: PublicKatkiContribution[]
): { type: KatkiType; label: string; rows: PublicKatkiContribution[] }[] {
  return KATKI_GROUP_ORDER.map((group) => ({
    ...group,
    rows: contributions.filter((row) => row.type === group.type),
  })).filter((group) => group.rows.length > 0);
}

export function sortKatkiContributions(
  rows: PublicKatkiContribution[]
): PublicKatkiContribution[] {
  return [...rows].sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    if (a.contributionId < b.contributionId) return -1;
    if (a.contributionId > b.contributionId) return 1;
    return 0;
  });
}

function emptyCounts(): Record<KatkiType, number> {
  return {
    verify: 0,
    correction: 0,
    additional_information: 0,
    different_perspective: 0,
  };
}

export function mergeCreatedKatki(
  read: PublicKatkiRead | null,
  item: PublicKatkiContribution,
  slug: string,
  journeyVersion: number
): PublicKatkiRead {
  const base = read ?? {
    slug,
    journeyVersion,
    totalVisibleCount: 0,
    countsByType: emptyCounts(),
    contributions: [],
  };
  if (base.contributions.some((row) => row.contributionId === item.contributionId)) {
    return base;
  }
  const contributions = sortKatkiContributions([...base.contributions, item]);
  const countsByType = { ...base.countsByType };
  countsByType[item.type] = (countsByType[item.type] ?? 0) + 1;
  return {
    slug,
    journeyVersion,
    totalVisibleCount: base.totalVisibleCount + 1,
    countsByType,
    contributions,
  };
}

export type KatkiReadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type KatkiReelSignal = 'hidden' | 'count' | 'create';

/** Reel proof signal. Only a resolved totalVisibleCount may claim zero or a count. */
export function katkiReelSignal(
  status: KatkiReadStatus,
  totalVisibleCount: number | null
): KatkiReelSignal {
  if (status !== 'ready') return 'hidden';
  if (totalVisibleCount == null || !Number.isInteger(totalVisibleCount) || totalVisibleCount < 0) {
    return 'hidden';
  }
  return totalVisibleCount === 0 ? 'create' : 'count';
}

export function formatKatkiReelCount(totalVisibleCount: number): string {
  return `${Math.trunc(totalVisibleCount).toLocaleString('tr-TR')} katkı`;
}

export type KatkiDraftResult =
  | { ok: true; body: string | null; sourceNote: string | null }
  | { ok: false; message: string };

export function validateKatkiDraft(
  type: KatkiType,
  body: string,
  sourceNote: string
): KatkiDraftResult {
  const note = sourceNote.trim();
  if (note.length > SOURCE_MAX) {
    return { ok: false, message: 'Kaynak notu en fazla 500 karakter olabilir.' };
  }
  const trimmedBody = body.trim();
  if (type === 'verify') {
    if (trimmedBody && (trimmedBody.length < BODY_MIN || trimmedBody.length > BODY_MAX)) {
      return {
        ok: false,
        message:
          trimmedBody.length < BODY_MIN
            ? 'Metin en az 20 karakter olmalı.'
            : 'Metin en fazla 2000 karakter olabilir.',
      };
    }
    return { ok: true, body: trimmedBody || null, sourceNote: note || null };
  }
  if (!trimmedBody) {
    return { ok: false, message: 'Bu katkı için bir metin yazmalısın.' };
  }
  if (trimmedBody.length < BODY_MIN) {
    return { ok: false, message: 'Metin en az 20 karakter olmalı.' };
  }
  if (trimmedBody.length > BODY_MAX) {
    return { ok: false, message: 'Metin en fazla 2000 karakter olabilir.' };
  }
  return { ok: true, body: trimmedBody, sourceNote: note || null };
}

export function buildKatkiCreatePayload(input: {
  journeyVersion: number;
  type: KatkiType;
  body: string | null;
  sourceNote: string | null;
}): {
  journeyVersion: number;
  type: KatkiType;
  body: string | null;
  sourceNote: string | null;
} {
  return {
    journeyVersion: input.journeyVersion,
    type: input.type,
    body: input.body,
    sourceNote: input.sourceNote,
  };
}

/** Mapped product copy only. Never the raw backend body. */
export function katkiCreateErrorMessage(code: string | undefined): 'auth' | string {
  if (code === 'auth_required' || code === 'HTTP_401') return 'auth';
  if (code === 'active_contribution_exists') {
    return 'Bu Yansı sürümünde bu türde aktif bir katkın zaten var.';
  }
  if (code === 'katki_create_rate_limited') {
    return 'Katkı oluşturma sınırına ulaştın. Bir süre sonra yeniden deneyebilirsin.';
  }
  if (code === 'frozen_journey_not_found') {
    return 'Bu Yansı şu an katkıya açık değil.';
  }
  if (
    code === 'invalid_body' ||
    code === 'invalid_source_note' ||
    code === 'invalid_type' ||
    code === 'forbidden_attachment'
  ) {
    return 'Katkı bu haliyle gönderilemedi.';
  }
  return 'Katkı gönderilemedi. Biraz sonra tekrar dene.';
}

function isKatkiType(value: unknown): value is KatkiType {
  return typeof value === 'string' && (KATKI_TYPES as readonly string[]).includes(value);
}

function readContributor(value: unknown): PublicKatkiContributor | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const displayName = typeof row.displayName === 'string' ? row.displayName.trim() : '';
  if (!displayName) return null;
  const url = typeof row.publicAvatarUrl === 'string' ? row.publicAvatarUrl : null;
  const revision = Number(row.publicAvatarRevision);
  return {
    displayName,
    publicAvatarUrl: url,
    publicAvatarRevision: Number.isFinite(revision) ? revision : 0,
  };
}

function readContribution(value: unknown): PublicKatkiContribution | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.contributionId !== 'string' || !isKatkiType(row.type)) return null;
  const contributor = readContributor(row.contributor);
  if (!contributor) return null;
  return {
    contributionId: row.contributionId,
    type: row.type,
    body: typeof row.body === 'string' ? row.body : null,
    sourceNote: typeof row.sourceNote === 'string' ? row.sourceNote : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    contributor,
  };
}

export function parsePublicKatkiRead(
  data: unknown,
  slug: string,
  journeyVersion: number
): PublicKatkiRead | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (String(row.slug || '').trim().toLowerCase() !== slug.trim().toLowerCase()) return null;
  if (Number(row.journeyVersion) !== journeyVersion) return null;
  const rawRows = Array.isArray(row.contributions) ? row.contributions : [];
  const contributions = sortKatkiContributions(
    rawRows.map(readContribution).filter((item): item is PublicKatkiContribution => item != null)
  );
  const countsByType = emptyCounts();
  const rawCounts = row.countsByType;
  if (rawCounts && typeof rawCounts === 'object') {
    for (const type of KATKI_TYPES) {
      const count = Number((rawCounts as Record<string, unknown>)[type]);
      countsByType[type] = Number.isFinite(count) ? count : 0;
    }
  }
  const total = Number(row.totalVisibleCount);
  if (!Number.isInteger(total) || total < 0) return null;
  return {
    slug: slug.trim().toLowerCase(),
    journeyVersion,
    totalVisibleCount: total,
    countsByType,
    contributions,
  };
}

export async function fetchPublicKatki(
  slug: string,
  journeyVersion: number
): Promise<{ ok: true; data: PublicKatkiRead } | { ok: false }> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || !Number.isInteger(journeyVersion) || journeyVersion < 1) {
    return { ok: false };
  }
  const response = await apiClient.get<unknown>(
    `/api/mirror-network/${encodeURIComponent(normalized)}/contributions`,
    {
      auth: false,
      timeoutMs: 15_000,
      params: { journeyVersion: String(journeyVersion) },
    }
  );
  if (!response.ok) return { ok: false };
  const data = parsePublicKatkiRead(response.data, normalized, journeyVersion);
  if (!data) return { ok: false };
  return { ok: true, data };
}

export async function createPublicKatki(input: {
  slug: string;
  journeyVersion: number;
  type: KatkiType;
  body: string | null;
  sourceNote: string | null;
}): Promise<
  | { ok: true; data: PublicKatkiContribution }
  | { ok: false; code: string }
> {
  const normalized = input.slug.trim().toLowerCase();
  const draft = validateKatkiDraft(input.type, input.body ?? '', input.sourceNote ?? '');
  if (!draft.ok) return { ok: false, code: 'invalid_body' };
  const payload = buildKatkiCreatePayload({
    journeyVersion: input.journeyVersion,
    type: input.type,
    body: draft.body,
    sourceNote: draft.sourceNote,
  });
  const response = await apiClient.post<unknown>(
    `/api/mirror-network/${encodeURIComponent(normalized)}/contributions`,
    { auth: true, timeoutMs: 15_000, body: payload }
  );
  if (!response.ok) {
    return { ok: false, code: response.error?.error_code || 'create_failed' };
  }
  const data = readContribution(response.data);
  if (!data) return { ok: false, code: 'create_failed' };
  return { ok: true, data };
}
