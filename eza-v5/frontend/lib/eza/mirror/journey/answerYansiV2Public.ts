/**
 * Stage 04D — public V2 grounded continuation client.
 * POST /api/business-yansi/v2/public/{slug}/answer
 */

import { buildApiUrl } from '@/lib/apiUrl';

export type YansiV2AnswerHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

/** Statuses that may enter the live thread / next-request history. */
export const YANSI_V2_LIVE_HISTORY_STATUSES = new Set([
  'answered',
  'no_information',
]);

export type YansiV2AnswerOk = {
  ok: true;
  slug: string;
  publicationVersion: number;
  assistantAnswer: string;
  sources: unknown[];
  reason?: string | null;
  status: string;
  /** False for soft gates (quota/budget/flag_off) — do not append to live history. */
  appendToLiveHistory: boolean;
};

export type YansiV2AnswerErr = {
  ok: false;
  code: string;
  status: number;
  message: string;
};

export type YansiV2AnswerResult = YansiV2AnswerOk | YansiV2AnswerErr;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function errorCode(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  const detail = data.detail;
  if (isRecord(detail) && typeof detail.code === 'string') return detail.code;
  if (typeof detail === 'string') return detail;
  if (typeof data.code === 'string') return data.code;
  return fallback;
}

export function parseYansiV2AnswerResponse(
  raw: unknown,
  expectedPublicationVersion: number
): YansiV2AnswerResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      code: 'invalid_response',
      status: 0,
      message: 'Yanıt okunamadı.',
    };
  }
  const publicationVersion = Number(raw.publicationVersion);
  const assistantAnswer =
    typeof raw.assistant_answer === 'string' ? raw.assistant_answer.trim() : '';
  const slug = typeof raw.slug === 'string' ? raw.slug.trim().toLowerCase() : '';
  if (
    !Number.isInteger(publicationVersion) ||
    publicationVersion < 1 ||
    publicationVersion !== expectedPublicationVersion
  ) {
    return {
      ok: false,
      code: 'publication_version_mismatch',
      status: 0,
      message: 'Yayın sürümü eşleşmedi. Deneyim korunuyor.',
    };
  }
  if (!assistantAnswer) {
    return {
      ok: false,
      code: 'empty_answer',
      status: 0,
      message: 'Yanıt alınamadı. Yeniden deneyebilirsin.',
    };
  }
  const status =
    typeof raw.status === 'string' && raw.status.trim()
      ? raw.status.trim()
      : 'answered';
  const appendToLiveHistory = YANSI_V2_LIVE_HISTORY_STATUSES.has(status);
  return {
    ok: true,
    slug,
    publicationVersion,
    assistantAnswer,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    reason: typeof raw.reason === 'string' ? raw.reason : null,
    status,
    appendToLiveHistory,
  };
}

export async function answerYansiV2Public(input: {
  slug: string;
  publicationVersion: number;
  question: string;
  history?: YansiV2AnswerHistoryTurn[];
}): Promise<YansiV2AnswerResult> {
  const slug = (input.slug || '').trim().toLowerCase();
  const question = (input.question || '').trim();
  const publicationVersion = input.publicationVersion;
  if (!slug || !question) {
    return {
      ok: false,
      code: 'invalid_request',
      status: 0,
      message: 'Soru gerekli.',
    };
  }
  if (!Number.isInteger(publicationVersion) || publicationVersion < 1) {
    return {
      ok: false,
      code: 'invalid_publication_version',
      status: 0,
      message: 'Yayın sürümü geçersiz.',
    };
  }

  const url = buildApiUrl(
    `/api/business-yansi/v2/public/${encodeURIComponent(slug)}/answer`
  );
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        question,
        publicationVersion,
        history: (input.history || []).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      }),
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const code = errorCode(data, `http_${response.status}`);
      return {
        ok: false,
        code,
        status: response.status,
        message:
          response.status === 429
            ? 'Şimdilik çok fazla soru sordun. Biraz sonra yeniden dene.'
            : 'Yanıt alınamadı. Yeniden deneyebilirsin.',
      };
    }
    return parseYansiV2AnswerResponse(data, publicationVersion);
  } catch {
    return {
      ok: false,
      code: 'network_error',
      status: 0,
      message: 'Bağlantı kurulamadı. Yeniden deneyebilirsin.',
    };
  }
}
