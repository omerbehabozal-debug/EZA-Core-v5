/**
 * Mirror API response contract validation — fail closed on malformed payloads.
 */

export const API_CONTRACT_INVALID = 'api_contract_invalid' as const;

export class MirrorApiContractError extends Error {
  readonly code: typeof API_CONTRACT_INVALID;
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'MirrorApiContractError';
    this.code = API_CONTRACT_INVALID;
    this.field = field;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Prefer nested `data` when it looks like the payload; else use root. */
export function unwrapApiPayload(value: unknown): unknown {
  const root = asRecord(value);
  if (!root) return value;
  const nested = root.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const nestedRec = nested as Record<string, unknown>;
    // Double-wrap: data.data
    if (nestedRec.data && typeof nestedRec.data === 'object' && !Array.isArray(nestedRec.data)) {
      const inner = nestedRec.data as Record<string, unknown>;
      if (
        typeof inner.usedDirector === 'boolean' ||
        typeof inner.sceneImageUrl === 'string' ||
        typeof inner.slug === 'string' ||
        Array.isArray(inner.items)
      ) {
        return inner;
      }
    }
    if (
      typeof nestedRec.usedDirector === 'boolean' ||
      typeof nestedRec.directorMode === 'string' ||
      typeof nestedRec.sceneImageUrl === 'string' ||
      typeof nestedRec.slug === 'string' ||
      Array.isArray(nestedRec.items) ||
      typeof nestedRec.directorEnabled === 'boolean'
    ) {
      return nested;
    }
  }
  return value;
}

export type ValidatedPrepareDirectorResponse = {
  usedDirector: boolean;
  directorMode: string;
  directorEnabled?: boolean;
  mappedPrompt?: { prompt?: string } | null;
  finalInterpretation?: unknown;
  [key: string]: unknown;
};

export function validatePrepareDirectorResponse(
  raw: unknown
): ValidatedPrepareDirectorResponse {
  const payload = asRecord(unwrapApiPayload(raw));
  if (!payload) {
    throw new MirrorApiContractError('prepare-director response is not an object');
  }
  if (typeof payload.usedDirector !== 'boolean') {
    throw new MirrorApiContractError(
      'prepare-director requires usedDirector:boolean',
      'usedDirector'
    );
  }
  if (typeof payload.directorMode !== 'string' || !payload.directorMode.trim()) {
    throw new MirrorApiContractError(
      'prepare-director requires directorMode:string',
      'directorMode'
    );
  }

  const mode = payload.directorMode.trim().toUpperCase();
  if (payload.usedDirector === true && (mode === 'SOFT' || mode === 'FULL')) {
    const mapped = asRecord(payload.mappedPrompt);
    const mappedPrompt =
      mapped && typeof mapped.prompt === 'string' ? mapped.prompt.trim() : '';
    const hasInterp =
      payload.finalInterpretation != null &&
      typeof payload.finalInterpretation === 'object';
    if (!mappedPrompt && !hasInterp) {
      throw new MirrorApiContractError(
        'D2 prepare with usedDirector requires mappedPrompt or finalInterpretation',
        'mappedPrompt'
      );
    }
  }

  return payload as ValidatedPrepareDirectorResponse;
}

export type ValidatedGenerateSceneResponse = {
  sceneImageUrl: string;
  provider?: string;
  cached?: boolean;
  generatedAt?: string;
  generationRequestId?: string | null;
  [key: string]: unknown;
};

export function validateGenerateSceneResponse(
  raw: unknown
): ValidatedGenerateSceneResponse {
  const payload = asRecord(unwrapApiPayload(raw));
  if (!payload) {
    throw new MirrorApiContractError('generate-scene response is not an object');
  }
  if (typeof payload.sceneImageUrl !== 'string' || !payload.sceneImageUrl.trim()) {
    throw new MirrorApiContractError(
      'generate-scene requires sceneImageUrl:string',
      'sceneImageUrl'
    );
  }
  return {
    ...payload,
    sceneImageUrl: payload.sceneImageUrl.trim(),
  } as ValidatedGenerateSceneResponse;
}

export type ValidatedPublishResponse = {
  slug: string;
  shareUrl: string;
  publicTitle?: string | null;
  publicSummary?: string | null;
  [key: string]: unknown;
};

export function validatePublishResponse(raw: unknown): ValidatedPublishResponse {
  const payload = asRecord(unwrapApiPayload(raw));
  if (!payload) {
    throw new MirrorApiContractError('publish response is not an object');
  }
  if (typeof payload.slug !== 'string' || !payload.slug.trim()) {
    throw new MirrorApiContractError('publish requires slug:string', 'slug');
  }
  if (typeof payload.shareUrl !== 'string' || !payload.shareUrl.trim()) {
    throw new MirrorApiContractError('publish requires shareUrl:string', 'shareUrl');
  }
  return {
    ...payload,
    slug: payload.slug.trim(),
    shareUrl: payload.shareUrl.trim(),
  } as ValidatedPublishResponse;
}

export type ValidatedPublicMirrorBySlug = {
  slug: string;
  cardTitle?: string;
  publicTitle?: string | null;
  [key: string]: unknown;
};

export function validatePublicMirrorBySlug(raw: unknown): ValidatedPublicMirrorBySlug {
  const payload = asRecord(unwrapApiPayload(raw));
  if (!payload) {
    throw new MirrorApiContractError('public mirror response is not an object');
  }
  if (typeof payload.slug !== 'string' || !payload.slug.trim()) {
    throw new MirrorApiContractError('public mirror requires slug:string', 'slug');
  }
  const title =
    (typeof payload.publicTitle === 'string' && payload.publicTitle.trim()) ||
    (typeof payload.cardTitle === 'string' && payload.cardTitle.trim()) ||
    '';
  if (!title) {
    throw new MirrorApiContractError(
      'public mirror requires cardTitle or publicTitle',
      'cardTitle'
    );
  }
  return {
    ...payload,
    slug: payload.slug.trim(),
  } as ValidatedPublicMirrorBySlug;
}

export type ValidatedDiscoverList = {
  items: unknown[];
  total?: number;
  [key: string]: unknown;
};

export function validateDiscoverList(raw: unknown): ValidatedDiscoverList {
  const payload = asRecord(unwrapApiPayload(raw));
  if (!payload) {
    throw new MirrorApiContractError('discover response is not an object');
  }
  if (!Array.isArray(payload.items)) {
    throw new MirrorApiContractError('discover requires items:array', 'items');
  }
  return payload as ValidatedDiscoverList;
}
