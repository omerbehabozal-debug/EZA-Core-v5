import { getApiUrl } from '@/lib/apiUrl';
import { getAuthToken } from '@/lib/eza/authTokenStore';

export type Business = { id: string; name: string; slug: string; description: string; logo_url: string | null; verified: boolean; official: boolean; status: string; updated_at?: string | null };
export type BrandAssetLink = {
  id: string;
  item_id: string;
  confirmed_version_id: string;
  status: string;
  knowledge_title: string;
  knowledge_status: string | null;
  current_published_version_id: string | null;
  confirmation_current: boolean;
};

export type BrandAsset = {
  id: string;
  business_id: string;
  asset_type: 'image' | 'video' | 'place' | 'link';
  title: string;
  caption: string;
  locator_kind: 'https' | 'storage' | null;
  locator: string | null;
  latitude: string | null;
  longitude: string | null;
  public_allowed: boolean;
  status: string;
  revision: number;
  links: BrandAssetLink[];
};

export type Knowledge = {
  id: string;
  item_id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  public_allowed: boolean;
  status: string;
  version: number;
  revision: number;
  created_at?: string | null;
  updated_at?: string | null;
};
export type Step = { question: string; answer: string; sources: string[] };
export type DraftMediaBlock = { type: 'image' | 'video' | 'map' | 'link'; assetId: string };
export type Draft = {
  id: string;
  title: string;
  summary: string;
  steps: Step[];
  status: string;
  revision: number;
  conversation_id: string | null;
  media_plan?: {
    coverAssetId: string | null;
    blocks: DraftMediaBlock[][];
    seal: string | null;
    coverMode?: 'automatic' | 'explicit' | null;
    coverKind?: 'video' | 'image' | null;
  } | null;
};

/** Omit the key when a revision did not choose a cover. Null asks for automatic selection. */
export function revisionCoverPayload(
  selection: string,
  specified: boolean,
  coverKind?: 'video' | 'image' | null,
): { coverAssetId?: string | null; coverKind?: 'video' | 'image' } {
  if (!specified) return {};
  const body: { coverAssetId?: string | null; coverKind?: 'video' | 'image' } = {
    coverAssetId: selection ? selection : null,
  };
  if (coverKind && selection) body.coverKind = coverKind;
  return body;
}
export type Publication = { slug: string; journey_version: number; visibility?: string };
export type BrandApplication = {
  id: string;
  brand_name: string;
  contact_name: string;
  corporate_email: string;
  website: string | null;
  company_info: string;
  status: 'received' | 'under_review' | 'approved' | 'rejected' | string;
  reviewer_note: string;
  business_id: string | null;
  created_at?: string;
  applicant_user_id?: string;
};

export type PlatformOverview = {
  business_enabled: boolean;
  totals: {
    businesses: number;
    verified_businesses: number;
    pending_applications: number;
    public_publications: number;
  };
  recent_applications: BrandApplication[];
  recent_events: {
    id: string;
    application_id: string;
    actor_user_id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    created_at?: string;
  }[];
};

export type PlatformBusinessRow = Business & {
  owner_email: string | null;
  owner_id: string;
  publication_count: number;
  member_count: number;
  created_at?: string;
};

export type PlatformUserRow = {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  public_display_name: string | null;
  created_at: string | null;
  memberships: {
    business_id: string;
    business_name: string;
    business_slug: string;
    role: string;
  }[];
};

export type PlatformPublicationRow = {
  slug: string;
  journey_version: number;
  business_id: string;
  business_name: string;
  business_slug: string;
  visibility: string;
  created_at: string | null;
  draft_id: string;
  published_by: string;
};

export type PlatformSystemStatus = {
  business_enabled: boolean;
  pending_applications: number;
  features: Record<string, boolean>;
};

export type BusinessApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'not_found'
  | 'server'
  | 'network'
  | 'unknown';

const MSG = {
  unavailable: 'BiligN Business şu anda kullanıma hazırlanıyor.',
  unauthorized: 'Oturum doğrulanamadı. BiligN hesabınla tekrar giriş yapmayı deneyebilirsin.',
  forbidden: 'Bu işlem için yetkin bulunmuyor.',
  server: 'Business servisinde geçici bir sorun oluştu. Biraz sonra tekrar dene.',
  network: 'Business servisine bağlanılamadı. Bağlantını kontrol edip tekrar dene.',
  not_found: 'İstenen kayıt bulunamadı.',
  unknown: 'İşlem tamamlanamadı.',
  video_quota_unavailable: 'Video yükleme kontrolü şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.',
  video_storage_unconfigured: 'Video depolama servisi şu anda kullanılamıyor.',
  video_probe_unavailable: 'Video işleme servisi şu anda kullanılamıyor.',
  video_storage_failed: 'Video kaydedilemedi. Lütfen biraz sonra tekrar deneyin.',
  place_search_unavailable: 'Adres araması şu anda kullanılamıyor. Haritadan konum seçebilirsiniz.',
  place_search_misconfigured: 'Adres araması yapılandırılmadı. Haritadan konum seçebilirsiniz.',
  place_search_timeout: 'Adres araması zaman aşımına uğradı. Tekrar deneyin veya haritadan seçin.',
  place_search_rate_limited: 'Adres arama limiti doldu. Biraz sonra tekrar deneyin.',
  place_search_query_rejected: 'Arama metni çok kısa veya geçersiz.',
} as const;

function detailCode(detail: unknown): string {
  if (typeof detail === 'string') return detail.trim();
  if (detail && typeof detail === 'object') {
    const row = detail as Record<string, unknown>;
    if (typeof row.code === 'string' && row.code.trim()) return row.code.trim();
    if (typeof row.reason === 'string' && row.reason.trim()) return row.reason.trim();
  }
  return '';
}

function messageForCode(code: string, fallback: string): string {
  if (code && code in MSG) return MSG[code as keyof typeof MSG];
  return fallback;
}

function classify(status: number, detail: unknown): { kind: BusinessApiErrorKind; code: string; message: string } {
  const code = detailCode(detail);
  if (status === 0) {
    return { kind: 'network', code: code || 'network_error', message: MSG.network };
  }
  if (status === 401) {
    return { kind: 'unauthorized', code: code || 'unauthorized', message: MSG.unauthorized };
  }
  if (status === 403) {
    return { kind: 'forbidden', code: code || 'forbidden', message: MSG.forbidden };
  }
  // Feature flag off: HTTPException(404, "not_found") → {"detail":"not_found"}
  // Proxy/empty 404 on the Business surface is also treated as service unavailable.
  if (status === 404 && (code === 'not_found' || code === '')) {
    return { kind: 'unavailable', code: code || 'not_found', message: MSG.unavailable };
  }
  if (status === 404) {
    return { kind: 'not_found', code: code || 'not_found', message: code || MSG.not_found };
  }
  if (status >= 500) {
    const resolved = code || `http_${status}`;
    return { kind: 'server', code: resolved, message: messageForCode(code, MSG.server) };
  }
  if (code) {
    return { kind: 'unknown', code, message: messageForCode(code, code) };
  }
  return { kind: 'unknown', code: `http_${status}`, message: `${MSG.unknown} (${status}).` };
}

export class BusinessApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: BusinessApiErrorKind;

  constructor(status: number, detail: unknown = null) {
    const classified = classify(status, detail);
    super(classified.message);
    this.name = 'BusinessApiError';
    this.status = status;
    this.code = classified.code;
    this.kind = classified.kind;
  }
}

export function isBusinessApiError(error: unknown): error is BusinessApiError {
  return error instanceof BusinessApiError;
}

export type PlaceSearchHit = {
  placeName: string;
  address: string;
  latitude: string;
  longitude: string;
};

export type PlaceSearchResponse = {
  items: PlaceSearchHit[];
  attribution: string;
};

export async function searchBrandPlaces(businessId: string, query: string): Promise<PlaceSearchResponse> {
  const q = query.trim();
  return businessRequest<PlaceSearchResponse>(
    `/${businessId}/place-search?q=${encodeURIComponent(q)}`,
  );
}

export async function businessRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  let response: Response;
  try {
    response = await fetch(getApiUrl().replace(/\/$/, '') + '/api/business-yansi' + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
  } catch {
    throw new BusinessApiError(0, 'network_error');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return response.json();
}

export async function uploadBusinessLogo(businessId: string, file: File): Promise<Business> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  const body = new FormData();
  body.append('file', file);
  let response: Response;
  try {
    response = await fetch(getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
      cache: 'no-store',
    });
  } catch {
    throw new BusinessApiError(0, 'network_error');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return response.json();
}

async function sendBrandForm<T>(path: string, body: FormData): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  let response: Response;
  try {
    response = await fetch(getApiUrl().replace(/\/$/, '') + '/api/business-yansi' + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
      cache: 'no-store',
    });
  } catch {
    throw new BusinessApiError(0, 'network_error');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return response.json();
}

/** Raw upload ceiling before server-side library normalization (must match backend). */
export const BRAND_LIBRARY_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export function uploadBrandImage(
  businessId: string,
  file: File,
  fields: { title?: string; caption?: string; publicAllowed?: boolean } = {},
  onProgress?: (ratio: number) => void,
): Promise<BrandAsset> {
  const token = getAuthToken();
  if (!token) return Promise.reject(new Error('Business yönetimi için giriş yapmalısın.'));
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title ?? '');
  body.append('caption', fields.caption ?? '');
  body.append('publicAllowed', fields.publicAllowed ? 'true' : 'false');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/image`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: { detail?: unknown } | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as BrandAsset);
      else reject(new BusinessApiError(xhr.status, data?.detail ?? null));
    };
    xhr.onerror = () => reject(new BusinessApiError(0, 'network_error'));
    xhr.send(body);
  });
}

export function replaceBrandImage(
  businessId: string,
  assetId: string,
  file: File,
  fields: { title?: string; caption?: string; publicAllowed?: boolean; revision: number },
  onProgress?: (ratio: number) => void,
): Promise<BrandAsset> {
  const token = getAuthToken();
  if (!token) return Promise.reject(new Error('Business yönetimi için giriş yapmalısın.'));
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title ?? '');
  body.append('caption', fields.caption ?? '');
  body.append('publicAllowed', fields.publicAllowed ? 'true' : 'false');
  body.append('revision', String(fields.revision));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/${assetId}/image`,
    );
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: { detail?: unknown } | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as BrandAsset);
      else reject(new BusinessApiError(xhr.status, data?.detail ?? null));
    };
    xhr.onerror = () => reject(new BusinessApiError(0, 'network_error'));
    xhr.send(body);
  });
}

export const STORED_VIDEO_MAX_BYTES = 40 * 1024 * 1024;

export type CoverJob = {
  jobId?: string | null;
  status: string;
  resultAssetId: string | null;
  errorCode: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
};

export async function fetchCoverJob(businessId: string, assetId: string): Promise<CoverJob> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-job`);
}

export async function fetchCoverJobById(businessId: string, assetId: string, jobId: string): Promise<CoverJob> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-jobs/${jobId}`);
}

export async function retryCoverJob(businessId: string, assetId: string): Promise<CoverJob> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-retry`, 'POST');
}

export async function retryCoverJobById(businessId: string, assetId: string, jobId: string): Promise<CoverJob> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-jobs/${jobId}/retry`, 'POST');
}

export async function requestCoverSegment(
  businessId: string,
  assetId: string,
  startSeconds: number,
  endSeconds: number,
): Promise<CoverJob> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-segment`, 'POST', { startSeconds, endSeconds });
}

export type CoverInterval = { startSeconds: number; endSeconds: number };

export type CoverSuggestion = {
  proposalId: string;
  status: string;
  assetId: string;
  assetRevision?: number | null;
  sourceCurrent?: boolean;
  intervals: CoverInterval[];
  errorCode: string | null;
  costKnown?: boolean;
  costUsd?: string | null;
};

export type CoverImageSuggestion = {
  proposalId: string;
  status: string;
  draftId: string;
  draftRevision?: number | null;
  sourceCurrent?: boolean;
  previewReady?: boolean;
  confirmedAssetId?: string | null;
  expiresAt?: string | null;
  errorCode: string | null;
  costKnown?: boolean;
  costUsd?: string | null;
};

export async function fetchCoverAiAvailability(businessId: string): Promise<boolean> {
  const body = await businessRequest<{ enabled?: boolean }>(`/${businessId}/cover-ai`);
  return body?.enabled === true;
}

export async function requestCoverSuggestions(
  businessId: string,
  assetId: string,
  idempotencyKey: string,
): Promise<CoverSuggestion> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-suggestions`, 'POST', { idempotencyKey });
}

export async function fetchCoverSuggestion(
  businessId: string,
  assetId: string,
  proposalId: string,
): Promise<CoverSuggestion> {
  return businessRequest(`/${businessId}/assets/${assetId}/cover-suggestions/${proposalId}`);
}

export async function requestCoverImageSuggestions(
  businessId: string,
  draftId: string,
  idempotencyKey: string,
): Promise<CoverImageSuggestion> {
  return businessRequest(`/${businessId}/drafts/${draftId}/cover-image-suggestions`, 'POST', { idempotencyKey });
}

export async function fetchCoverImageSuggestion(
  businessId: string,
  draftId: string,
  proposalId: string,
): Promise<CoverImageSuggestion> {
  return businessRequest(`/${businessId}/drafts/${draftId}/cover-image-suggestions/${proposalId}`);
}

export async function confirmCoverImageSuggestion(
  businessId: string,
  draftId: string,
  proposalId: string,
  knowledgeVersionIds: string[] = [],
): Promise<BrandAsset> {
  return businessRequest(`/${businessId}/drafts/${draftId}/cover-image-suggestions/${proposalId}/confirm`, 'POST', {
    knowledgeVersionIds,
  });
}

export function coverImageSuggestionPreviewUrl(
  businessId: string,
  draftId: string,
  proposalId: string,
): string {
  return getApiUrl().replace(/\/$/, '')
    + `/api/business-yansi/${businessId}/drafts/${draftId}/cover-image-suggestions/${proposalId}/preview`;
}

export function uploadBrandVideo(
  businessId: string,
  file: File,
  fields: { title?: string; caption?: string; publicAllowed?: boolean; coverPreparation?: 'manual' } = {},
  onProgress?: (ratio: number) => void,
): Promise<BrandAsset> {
  const token = getAuthToken();
  if (!token) return Promise.reject(new Error('Business yönetimi için giriş yapmalısın.'));
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title ?? '');
  body.append('caption', fields.caption ?? '');
  body.append('purpose', 'step');
  body.append('publicAllowed', fields.publicAllowed ? 'true' : 'false');
  if (fields.coverPreparation === 'manual') body.append('coverPreparation', 'manual');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: { detail?: unknown } | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as BrandAsset);
      else reject(new BusinessApiError(xhr.status, data?.detail ?? null));
    };
    xhr.onerror = () => reject(new BusinessApiError(0, 'network_error'));
    xhr.send(body);
  });
}

export type BrandVideoStream = {
  streamUrl: string;
  expiresAt: number;
  expiresIn: number;
};

/** Mint a short-lived authenticated stream URL for native <video> Range playback. */
export async function mintBrandVideoStream(businessId: string, assetId: string): Promise<BrandVideoStream> {
  const minted = await businessRequest<{ streamPath: string; expiresAt: number; expiresIn: number }>(
    `/${businessId}/assets/${assetId}/video-stream`,
    'POST',
  );
  const path = minted.streamPath.startsWith('/') ? minted.streamPath : `/${minted.streamPath}`;
  return {
    streamUrl: getApiUrl().replace(/\/$/, '') + path,
    expiresAt: minted.expiresAt,
    expiresIn: minted.expiresIn,
  };
}

/**
 * @deprecated Full-file video blobs are not used by Content Library cards.
 * Prefer mintBrandVideoStream + native Range playback in the lightbox.
 */
export async function fetchBrandVideoPreview(businessId: string, assetId: string): Promise<string> {
  const stream = await mintBrandVideoStream(businessId, assetId);
  return stream.streamUrl;
}

export type BrandImageVariant = 'thumb' | 'original';

export async function fetchBrandAssetPreview(
  businessId: string,
  assetId: string,
  variant: BrandImageVariant = 'original',
): Promise<string> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  const query = variant === 'thumb' ? '?variant=thumb' : '';
  const response = await fetch(
    getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/${assetId}/content${query}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return URL.createObjectURL(await response.blob());
}

/** V2 single-image grounded publish (Stage 3B/3C). Owner-only on the server. */
export type YansiV2KnowledgeSourcePin = {
  knowledgeVersionId: string;
  expectedRevision: number;
};

export type YansiV2ImagePublishInput = {
  assetId: string;
  expectedAssetRevision: number;
  title: string;
  description?: string | null;
  knowledgeNotes?: string[] | null;
  knowledgeSources?: YansiV2KnowledgeSourcePin[] | null;
  slug?: string | null;
  nodeId?: string | null;
  expectedCurrentVersion?: number | null;
  idempotencyKey?: string | null;
};

export type YansiV2ImagePublishResult = {
  status: string;
  idempotent: boolean;
  nodeId: string;
  slug: string;
  publicationVersion: number;
  contractHash: string;
  manifestHash: string;
  bundleVersionId: string;
  bundleHash: string;
  assetId: string;
  assetRevision: number;
  public: {
    slug: string;
    contract: Record<string, unknown>;
    bundle: Record<string, unknown>;
    media: {
      assetId: string;
      contentPath: string;
      title?: string | null;
    };
  };
};

export function buildYansiV2ImagePublishBody(input: YansiV2ImagePublishInput): Record<string, unknown> {
  /** Only fields accepted by ImagePublishV2Body (extra=forbid). */
  const body: Record<string, unknown> = {
    assetId: input.assetId,
    expectedAssetRevision: input.expectedAssetRevision,
    title: input.title.trim(),
  };
  const description = (input.description ?? '').trim();
  if (description) body.description = description;
  const notes = (input.knowledgeNotes ?? [])
    .map((note) => note.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (notes.length) body.knowledgeNotes = notes;
  const sources = (input.knowledgeSources ?? [])
    .filter((pin) => pin?.knowledgeVersionId && Number.isFinite(pin.expectedRevision))
    .slice(0, 32)
    .map((pin) => ({
      knowledgeVersionId: pin.knowledgeVersionId,
      expectedRevision: pin.expectedRevision,
    }));
  if (sources.length) body.knowledgeSources = sources;
  const slug = (input.slug ?? '').trim();
  if (slug) body.slug = slug;
  if (input.nodeId) body.nodeId = input.nodeId;
  if (input.expectedCurrentVersion !== undefined) {
    body.expectedCurrentVersion = input.expectedCurrentVersion;
  }
  const key = (input.idempotencyKey ?? '').trim();
  if (key) body.idempotencyKey = key;
  return body;
}

export async function publishYansiV2Image(
  businessId: string,
  input: YansiV2ImagePublishInput,
): Promise<YansiV2ImagePublishResult> {
  return businessRequest<YansiV2ImagePublishResult>(
    `/${businessId}/v2/publications/image`,
    'POST',
    buildYansiV2ImagePublishBody(input),
  );
}

export function yansiV2PublicMediaPath(businessId: string, assetId: string): string {
  return `/api/business-yansi/public-media/${businessId.toLowerCase()}/${assetId.toLowerCase()}`;
}

export function yansiV2PublicHref(
  slug: string,
  publicationVersion: number,
  contentKind?: 'conversation' | 'image' | 'mixed' | null,
): string {
  const params = new URLSearchParams();
  params.set('journeyVersion', String(publicationVersion));
  if (
    contentKind === 'conversation' ||
    contentKind === 'image' ||
    contentKind === 'mixed'
  ) {
    params.set('contentKind', contentKind);
  }
  return `/m/${encodeURIComponent(slug)}?${params.toString()}`;
}

/** V2 frozen conversation draft lifecycle (Stage 02A/02B). */
export type YansiV2ConversationTurnMedia = {
  type: 'image' | 'video';
  assetId: string;
  assetRevision: number;
  title: string;
};

export type YansiV2ConversationTurn = {
  stepIndex: number;
  question: string;
  answer: string;
  media?: YansiV2ConversationTurnMedia[];
};

export type YansiV2ConversationDraftDto = {
  id: string;
  businessId: string;
  title: string;
  summary: string;
  turns: YansiV2ConversationTurn[];
  turnCount: number;
  curiosityQuestion: string | null;
  knowledgeSourcePins: YansiV2KnowledgeSourcePin[];
  knowledgeNotes: string[];
  coverAssetId: string | null;
  coverAssetRevision: number | null;
  contentDigest: string;
  status: string;
  revision: number;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedRevision: number | null;
  approvedContentDigest: string | null;
  approvalNote: string | null;
  publishedNodeId: string | null;
  publishedVersion: number | null;
  createdBy: string;
};

export type YansiV2ConversationDraftInput = {
  title: string;
  summary?: string | null;
  turns: YansiV2ConversationTurn[];
  knowledgeNotes?: string[] | null;
  knowledgeSources?: YansiV2KnowledgeSourcePin[] | null;
  coverAssetId?: string | null;
  coverAssetRevision?: number | null;
};

export type YansiV2ConversationPublishResult = {
  status: string;
  idempotent: boolean;
  nodeId: string;
  slug: string;
  draftId: string;
  publicationVersion: number;
  contractHash: string;
  manifestHash: string;
  bundleVersionId: string;
  bundleHash: string;
  curiosityQuestion: string;
  turnCount: number;
  public: {
    slug: string;
    contract: Record<string, unknown>;
    bundle: Record<string, unknown>;
    conversation: {
      turnCount: number;
      curiosityQuestion: string;
      turns: YansiV2ConversationTurn[];
    };
    cover?: { assetId: string; title?: string; contentPath: string } | null;
  };
};

function buildConversationDraftBody(input: YansiV2ConversationDraftInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    turns: input.turns.map((turn) => {
      const item: Record<string, unknown> = {
        stepIndex: turn.stepIndex,
        question: turn.question.trim(),
        answer: turn.answer.trim(),
      };
      const media = (turn.media || [])
        .filter((m) => m.type === 'image' && m.assetId)
        .map((m) => ({
          type: 'image' as const,
          assetId: m.assetId,
          assetRevision: m.assetRevision,
          title: (m.title || 'Görsel').trim().slice(0, 200),
        }));
      if (media.length) item.media = media;
      return item;
    }),
  };
  const summary = (input.summary ?? '').trim();
  if (summary) body.summary = summary;
  const notes = (input.knowledgeNotes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 8);
  if (notes.length) body.knowledgeNotes = notes;
  const sources = (input.knowledgeSources ?? [])
    .filter((pin) => pin?.knowledgeVersionId && Number.isFinite(pin.expectedRevision))
    .slice(0, 32)
    .map((pin) => ({
      knowledgeVersionId: pin.knowledgeVersionId,
      expectedRevision: pin.expectedRevision,
    }));
  if (sources.length) body.knowledgeSources = sources;
  if (input.coverAssetId) {
    body.coverAssetId = input.coverAssetId;
    body.coverAssetRevision = input.coverAssetRevision ?? 0;
  }
  return body;
}

export async function createYansiV2ConversationDraft(
  businessId: string,
  input: YansiV2ConversationDraftInput,
): Promise<YansiV2ConversationDraftDto> {
  return businessRequest<YansiV2ConversationDraftDto>(
    `/${businessId}/v2/conversation-drafts`,
    'POST',
    buildConversationDraftBody(input),
  );
}

export type YansiV2ConversationDraftSummary = {
  id: string;
  businessId: string;
  title: string;
  status: string;
  revision: number;
  turnCount: number;
  coverAssetId: string | null;
  publishedNodeId: string | null;
  publishedVersion: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type YansiV2ConversationDraftList = {
  items: YansiV2ConversationDraftSummary[];
  total: number;
  limit: number;
  offset: number;
};

export async function listYansiV2ConversationDrafts(
  businessId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<YansiV2ConversationDraftList> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return businessRequest<YansiV2ConversationDraftList>(
    `/${businessId}/v2/conversation-drafts${qs ? `?${qs}` : ''}`,
  );
}

export async function getYansiV2ConversationDraft(
  businessId: string,
  draftId: string,
): Promise<YansiV2ConversationDraftDto> {
  return businessRequest<YansiV2ConversationDraftDto>(
    `/${businessId}/v2/conversation-drafts/${draftId}`,
  );
}

export async function reviseYansiV2ConversationDraft(
  businessId: string,
  draftId: string,
  input: YansiV2ConversationDraftInput & { expectedRevision: number },
): Promise<YansiV2ConversationDraftDto> {
  return businessRequest<YansiV2ConversationDraftDto>(
    `/${businessId}/v2/conversation-drafts/${draftId}`,
    'PATCH',
    {
      ...buildConversationDraftBody(input),
      expectedRevision: input.expectedRevision,
    },
  );
}

export async function transitionYansiV2ConversationDraft(
  businessId: string,
  draftId: string,
  input: {
    target: 'draft' | 'review' | 'approved';
    expectedRevision: number;
    approvalNote?: string | null;
  },
): Promise<YansiV2ConversationDraftDto> {
  const body: Record<string, unknown> = {
    target: input.target,
    expectedRevision: input.expectedRevision,
  };
  const note = (input.approvalNote ?? '').trim();
  if (note) body.approvalNote = note;
  return businessRequest<YansiV2ConversationDraftDto>(
    `/${businessId}/v2/conversation-drafts/${draftId}/transition`,
    'POST',
    body,
  );
}

export async function publishYansiV2ConversationDraft(
  businessId: string,
  draftId: string,
  input: {
    expectedDraftRevision: number;
    slug?: string | null;
    nodeId?: string | null;
    expectedCurrentVersion?: number | null;
    idempotencyKey?: string | null;
  },
): Promise<YansiV2ConversationPublishResult> {
  const body: Record<string, unknown> = {
    expectedDraftRevision: input.expectedDraftRevision,
  };
  const slug = (input.slug ?? '').trim();
  if (slug) body.slug = slug;
  if (input.nodeId) body.nodeId = input.nodeId;
  if (input.expectedCurrentVersion !== undefined) {
    body.expectedCurrentVersion = input.expectedCurrentVersion;
  }
  const key = (input.idempotencyKey ?? '').trim();
  if (key) body.idempotencyKey = key;
  return businessRequest<YansiV2ConversationPublishResult>(
    `/${businessId}/v2/conversation-drafts/${draftId}/publish`,
    'POST',
    body,
  );
}

/** Stage 03B — V2 AI conversation proposal (separate from publish; explicit apply). */
export type YansiV2ProposalWarning = {
  code: string;
  message: string;
  turnIndex?: number | null;
};

export type YansiV2ProposalTurn = {
  stepIndex: number;
  question: string;
  answer: string;
  claimSafety?: 'grounded' | 'unsupported' | string;
  evidence?: Array<Record<string, unknown>>;
  mediaSuggestions?: Array<{ assetId: string; type?: string; reason?: string }>;
};

export type YansiV2ProposalResult = {
  title: string;
  summary?: string;
  curiosityQuestion: string;
  turns: YansiV2ProposalTurn[];
  coverSuggestion?: { assetId: string; type?: string; reason?: string } | null;
  knowledgeSourcePins?: Array<{
    knowledgeVersionId: string;
    expectedRevision?: number | null;
    contentDigest?: string;
    version?: number;
  }>;
  rationale?: string;
};

export type YansiV2ConversationProposalDto = {
  generationId: string;
  businessId: string;
  kind: 'v2_prop' | string;
  status: string;
  snapshotHash?: string;
  promptVersion?: string;
  model?: string | null;
  errorCode?: string | null;
  proposal: {
    insufficientSources?: boolean;
    schemaVersion?: string;
    promptVersion?: string;
    warnings?: YansiV2ProposalWarning[];
    result?: YansiV2ProposalResult | null;
  } | null;
  appliedDraftId?: string | null;
  sources?: Array<{ versionId: string; version: number; contentHash: string }>;
};

export type YansiV2ProposalApplyResult = {
  status: string;
  generationId: string;
  draft: YansiV2ConversationDraftDto;
  curiosityQuestion?: string | null;
  warnings?: YansiV2ProposalWarning[];
};

/** Matches backend TopicsRequest / proposal_public_dto statuses. */
export function isTerminalYansiV2ProposalStatus(status: string | null | undefined): boolean {
  return (
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'expired' ||
    status === 'cancelled'
  );
}

export function isSuccessYansiV2ProposalStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'succeeded';
}

export async function requestYansiV2ConversationProposal(
  businessId: string,
  body: { idempotencyKey: string; sourceVersionIds: string[]; topicHint?: string },
): Promise<YansiV2ConversationProposalDto> {
  // TopicsRequest sorts/dedupes sourceVersionIds server-side; send sorted for stable idempotency.
  const sourceVersionIds = [...body.sourceVersionIds].map(String).sort();
  return businessRequest<YansiV2ConversationProposalDto>(
    `/${businessId}/v2/ai/conversation-proposals`,
    'POST',
    {
      idempotencyKey: body.idempotencyKey,
      sourceVersionIds,
      topicHint: (body.topicHint || '').slice(0, 500),
    },
  );
}

export async function getYansiV2ConversationProposal(
  businessId: string,
  generationId: string,
): Promise<YansiV2ConversationProposalDto> {
  return businessRequest<YansiV2ConversationProposalDto>(
    `/${businessId}/v2/ai/conversation-proposals/${generationId}`,
  );
}

/** Poll GET until terminal (same pattern as pollStudioGeneration). */
export async function pollYansiV2ConversationProposal(
  businessId: string,
  generationId: string,
  options?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal },
): Promise<YansiV2ConversationProposalDto> {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const started = Date.now();
  let last = await getYansiV2ConversationProposal(businessId, generationId);
  while (!isTerminalYansiV2ProposalStatus(last.status)) {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (Date.now() - started > timeoutMs) {
      throw new BusinessApiError(408, { code: 'studio_timeout' });
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await getYansiV2ConversationProposal(businessId, generationId);
  }
  return last;
}

export async function applyYansiV2ConversationProposal(
  businessId: string,
  generationId: string,
  input: { draftId?: string | null; expectedRevision?: number | null } = {},
): Promise<YansiV2ProposalApplyResult> {
  // ConversationProposalApplyBody: draftId?, expectedRevision? (ge=1)
  const body: Record<string, unknown> = {};
  if (input.draftId) body.draftId = input.draftId;
  if (input.expectedRevision != null) body.expectedRevision = input.expectedRevision;
  return businessRequest<YansiV2ProposalApplyResult>(
    `/${businessId}/v2/ai/conversation-proposals/${generationId}/apply`,
    'POST',
    body,
  );
}
