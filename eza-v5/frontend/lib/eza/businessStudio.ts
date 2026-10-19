/**
 * Business AI Yansı Studio client — Stage 1 admission + Stage 2 execution contracts.
 * Never invents topics/drafts; surfaces blocked/unavailable honestly.
 */
import { businessRequest, BusinessApiError, isBusinessApiError } from '@/lib/eza/businessYansi';

export type StudioStatus =
  | 'blocked'
  | 'pending'
  | 'queued'
  | 'running'
  | 'validated'
  | 'succeeded'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type StudioSourceIdentity = {
  versionId: string;
  version: number;
  contentHash: string;
};

export type StudioEvidence = {
  versionId: string;
  version: number;
  contentHash: string;
  start: number;
  end: number;
  text: string;
  passageHash: string;
  offsetEncoding?: 'unicode-codepoint';
};

export type StudioTopic = {
  id: string;
  title: string;
  description: string;
  titlePassageId?: string;
  descriptionPassageId?: string;
  answerPassageIds?: string[];
  evidence?: StudioEvidence[];
};

export type StudioDraftStep = {
  question: string;
  answer: string;
  evidence: StudioEvidence;
};

export type StudioDraftResult = {
  title: string;
  summary: string;
  metadataEvidence?: StudioEvidence[];
  steps: StudioDraftStep[];
};

export type StudioGeneration = {
  generationId: string;
  businessId: string;
  kind: 'topics' | 'draft';
  status: StudioStatus;
  executionAvailable: boolean;
  result: unknown | null;
  usageEstimated?: boolean;
  snapshotHash: string;
  sources: StudioSourceIdentity[];
  model: string | null;
  promptVersion: string;
  attemptCount: number;
  maxAttempts: number;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: string | number;
  costLimitUsd: string | number;
  currency?: string;
  errorCode: string | null;
  draftId: string | null;
  createdAt: string;
  updatedAt: string;
};

const ERROR_TR: Record<string, string> = {
  studio_admission_disabled: 'AI Yansı Stüdyosu henüz bu ortamda açık değil.',
  studio_execution_not_implemented: 'AI üretim altyapısı henüz etkinleştirilmedi. Manuel taslak akışını kullanabilirsiniz.',
  studio_model_or_pricing_not_configured: 'AI modeli veya fiyatlandırma yapılandırılmamış.',
  studio_idempotency_conflict: 'Aynı işlem anahtarı farklı bir istekle kullanılmış. Yeni bir üretim başlatın.',
  studio_snapshot_stale: 'Kaynaklar değişti veya geri alındı. Lütfen kaynakları yenileyip tekrar deneyin.',
  studio_source_unavailable: 'Seçilen kaynaklardan biri artık yayımlı değil veya erişilemiyor.',
  studio_insufficient_sources: 'Konu önermek için yayımlanmış kaynak yetersiz. Bilgi Havuzu’na onaylı içerik ekleyin.',
  studio_queue_expired: 'Üretim sırası zaman aşımına uğradı. Tekrar deneyebilirsiniz.',
  studio_execution_interrupted: 'Üretim yarıda kesildi. Tekrar deneyebilirsiniz.',
  studio_validation_failed: 'AI çıktısı kaynak doğrulamasından geçemedi. Tekrar deneyin veya manuel düzenleyin.',
  studio_provider_error: 'AI sağlayıcısında geçici bir sorun oluştu. Biraz sonra tekrar deneyin.',
  studio_timeout: 'Üretim zaman aşımına uğradı. Tekrar deneyebilirsiniz.',
};

export function studioErrorMessage(code: string | null | undefined, fallback?: string): string {
  if (code && ERROR_TR[code]) return ERROR_TR[code];
  if (fallback) return fallback;
  if (code) return `Üretim tamamlanamadı (${code}).`;
  return 'Üretim tamamlanamadı.';
}

export function studioStatusLabel(status: StudioStatus): string {
  switch (status) {
    case 'queued':
    case 'pending':
      return 'Sırada';
    case 'running':
      return 'Üretiliyor';
    case 'completed':
    case 'succeeded':
      return 'Tamamlandı';
    case 'failed':
      return 'Başarısız';
    case 'blocked':
      return 'Beklemede';
    case 'expired':
      return 'Süresi doldu';
    case 'cancelled':
      return 'İptal';
    case 'validated':
      return 'Doğrulandı';
    default:
      return status;
  }
}

export function isTerminalStudioStatus(status: StudioStatus): boolean {
  return (
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'expired' ||
    status === 'cancelled'
  );
}

export function isSuccessStudioStatus(status: StudioStatus): boolean {
  return status === 'completed' || status === 'succeeded';
}

export function newStudioIdempotencyKey(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${rand}`.replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 128);
}

export function parseTopicsResult(result: unknown): StudioTopic[] | null {
  if (!result || typeof result !== 'object') return null;
  const topics = (result as { topics?: unknown }).topics;
  if (!Array.isArray(topics) || topics.length === 0) return null;
  const parsed: StudioTopic[] = [];
  for (const row of topics) {
    if (!row || typeof row !== 'object') continue;
    const t = row as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.description !== 'string') {
      continue;
    }
    parsed.push({
      id: t.id,
      title: t.title,
      description: t.description,
      titlePassageId: typeof t.titlePassageId === 'string' ? t.titlePassageId : undefined,
      descriptionPassageId: typeof t.descriptionPassageId === 'string' ? t.descriptionPassageId : undefined,
      answerPassageIds: Array.isArray(t.answerPassageIds)
        ? t.answerPassageIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      evidence: Array.isArray(t.evidence) ? (t.evidence as StudioEvidence[]) : undefined,
    });
  }
  return parsed.length ? parsed : null;
}

export function parseDraftResult(result: unknown): StudioDraftResult | null {
  if (!result || typeof result !== 'object') return null;
  const row = result as Record<string, unknown>;
  if (typeof row.title !== 'string' || typeof row.summary !== 'string' || !Array.isArray(row.steps)) {
    return null;
  }
  if (row.steps.length !== 8) return null;
  const steps: StudioDraftStep[] = [];
  for (const step of row.steps) {
    if (!step || typeof step !== 'object') return null;
    const s = step as Record<string, unknown>;
    if (typeof s.question !== 'string' || typeof s.answer !== 'string' || !s.evidence || typeof s.evidence !== 'object') {
      return null;
    }
    steps.push({
      question: s.question,
      answer: s.answer,
      evidence: s.evidence as StudioEvidence,
    });
  }
  return {
    title: row.title,
    summary: row.summary,
    metadataEvidence: Array.isArray(row.metadataEvidence) ? (row.metadataEvidence as StudioEvidence[]) : undefined,
    steps,
  };
}

function studioPath(businessId: string, suffix = ''): string {
  return `/${businessId}/studio${suffix}`;
}

export async function requestStudioTopics(
  businessId: string,
  body: { idempotencyKey: string; sourceVersionIds: string[]; topicHint?: string }
): Promise<StudioGeneration> {
  return businessRequest<StudioGeneration>(studioPath(businessId, '/topics'), 'POST', {
    idempotencyKey: body.idempotencyKey,
    sourceVersionIds: [...body.sourceVersionIds].sort(),
    topicHint: body.topicHint ?? '',
  });
}

export async function requestStudioDraftGeneration(
  businessId: string,
  body: {
    idempotencyKey: string;
    sourceVersionIds: string[];
    expectedSnapshotHash: string;
    topicsGenerationId: string;
    topicId: string;
    topicHint?: string;
  }
): Promise<StudioGeneration> {
  return businessRequest<StudioGeneration>(studioPath(businessId, '/generations'), 'POST', {
    idempotencyKey: body.idempotencyKey,
    sourceVersionIds: [...body.sourceVersionIds].sort(),
    expectedSnapshotHash: body.expectedSnapshotHash,
    topicsGenerationId: body.topicsGenerationId,
    topicId: body.topicId,
    topicHint: body.topicHint ?? '',
  });
}

export async function fetchStudioGeneration(
  businessId: string,
  generationId: string
): Promise<StudioGeneration> {
  return businessRequest<StudioGeneration>(studioPath(businessId, `/generations/${generationId}`), 'GET');
}

/** Poll until terminal or timeout. Returns last known generation. */
export async function pollStudioGeneration(
  businessId: string,
  generationId: string,
  options?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal }
): Promise<StudioGeneration> {
  const intervalMs = options?.intervalMs ?? 1500;
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const started = Date.now();
  let last = await fetchStudioGeneration(businessId, generationId);
  while (!isTerminalStudioStatus(last.status)) {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (Date.now() - started > timeoutMs) {
      throw new BusinessApiError(408, { code: 'studio_timeout' });
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fetchStudioGeneration(businessId, generationId);
  }
  return last;
}

export function classifyStudioAvailability(error: unknown): {
  available: boolean;
  message: string;
  code: string;
} {
  if (!isBusinessApiError(error)) {
    return { available: false, message: 'Stüdyo servisine bağlanılamadı.', code: 'unknown' };
  }
  if (error.status === 503 || error.code === 'studio_admission_disabled') {
    return {
      available: false,
      message: studioErrorMessage(error.code || 'studio_admission_disabled'),
      code: error.code || 'studio_admission_disabled',
    };
  }
  if (error.status === 404) {
    return {
      available: false,
      message: 'AI Stüdyo uçları bu ortamda yok. Aşama 2 backend entegrasyonu bekleniyor.',
      code: error.code || 'not_found',
    };
  }
  return { available: false, message: error.message, code: error.code };
}

export { isBusinessApiError, BusinessApiError };
