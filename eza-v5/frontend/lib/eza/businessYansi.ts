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
    return { kind: 'server', code: code || `http_${status}`, message: MSG.server };
  }
  if (code) {
    return { kind: 'unknown', code, message: code };
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

export async function uploadBrandImage(
  businessId: string,
  file: File,
  fields: { title: string; caption: string; publicAllowed: boolean },
): Promise<BrandAsset> {
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title);
  body.append('caption', fields.caption);
  body.append('publicAllowed', fields.publicAllowed ? 'true' : 'false');
  return sendBrandForm(`/${businessId}/assets/image`, body);
}

export async function replaceBrandImage(
  businessId: string,
  assetId: string,
  file: File,
  fields: { title: string; caption: string; publicAllowed: boolean; revision: number },
): Promise<BrandAsset> {
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title);
  body.append('caption', fields.caption);
  body.append('publicAllowed', fields.publicAllowed ? 'true' : 'false');
  body.append('revision', String(fields.revision));
  return sendBrandForm(`/${businessId}/assets/${assetId}/image`, body);
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
  fields: { title: string; caption: string; publicAllowed: boolean; coverPreparation?: 'manual' },
  onProgress?: (ratio: number) => void,
): Promise<BrandAsset> {
  const token = getAuthToken();
  if (!token) return Promise.reject(new Error('Business yönetimi için giriş yapmalısın.'));
  const body = new FormData();
  body.append('file', file);
  body.append('title', fields.title);
  body.append('caption', fields.caption);
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

export async function fetchBrandVideoPreview(businessId: string, assetId: string): Promise<string> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  const response = await fetch(
    getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/${assetId}/video`,
    { headers: { Authorization: `Bearer ${token}`, Range: 'bytes=0-' }, cache: 'no-store' },
  );
  if (response.status !== 200 && response.status !== 206) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return URL.createObjectURL(await response.blob());
}

export async function fetchBrandAssetPreview(businessId: string, assetId: string): Promise<string> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  const response = await fetch(
    getApiUrl().replace(/\/$/, '') + `/api/business-yansi/${businessId}/assets/${assetId}/content`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new BusinessApiError(response.status, data?.detail ?? null);
  }
  return URL.createObjectURL(await response.blob());
}
