/**
 * Chat send failure display — keep transport/API failures out of assistant history.
 */

import {
  extractQuotaDetail,
  isQuotaLimitReason,
  resolveChatLimitMessage,
} from '@/lib/eza/plan/sainaQuotaMessages';
import type { AccountTier } from '@/lib/eza/plan/tierEntitlements';

/** User-facing copy for transport / infrastructure failures (never persist as chat). */
export const CHAT_TRANSPORT_ERROR_COPY =
  'Yanıt oluşturulamadı. Lütfen tekrar deneyin.';

const DEMO_TOKEN_LIMIT_COPY =
  "Günlük Demo Limiti Doldu\n\nBu sayfa, EZA'nın herkese açık demo ortamıdır. Sistem stabilitesi ve adil kullanım için günlük bir kapasite ile çalışır.\n\nLütfen daha sonra tekrar deneyin.";

const DEMO_TEXT_LIMIT_COPY =
  'Demo ortamında uzun metin analizi sınırlıdır. Daha kapsamlı analizler kurumsal kullanım için sunulmaktadır.';

const INFRA_ERROR_CODES = new Set([
  'INVALID_RESPONSE',
  'NETWORK_ERROR',
  'REQUEST_TIMEOUT',
  'HTTP_500',
  'HTTP_502',
  'HTTP_503',
  'HTTP_504',
  'HTTP_520',
  'HTTP_521',
  'HTTP_522',
  'HTTP_523',
  'HTTP_524',
]);

const INFRA_MESSAGE_MARKERS = [
  'server returned non-json response',
  'network request failed',
  'streaming failed',
  'empty_stream',
  'no data received from server',
  'failed to fetch',
  'backend bağlantı hatası',
  'backend endpoint bulunamadı',
  'yanıt zaman aşımına uğradı',
  'istek zaman aşımına uğradı',
  'response body is not readable',
];

export type ChatSendFailureDisplay =
  | { mode: 'transient'; text: string }
  | { mode: 'domain_message'; text: string };

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as {
    code?: unknown;
    error_code?: unknown;
    response?: { data?: { error?: unknown } };
  };
  if (typeof e.code === 'string' && e.code.trim()) return e.code.trim();
  if (typeof e.error_code === 'string' && e.error_code.trim()) return e.error_code.trim();
  const nested = e.response?.data?.error;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  return undefined;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

/** True when the failure is infrastructure/transport — never render as assistant chat. */
export function isInfrastructureChatSendError(error: unknown): boolean {
  const code = readErrorCode(error);
  if (code && (INFRA_ERROR_CODES.has(code) || /^HTTP_\d{3}$/.test(code))) {
    return true;
  }
  const msg = readErrorMessage(error).toLowerCase();
  if (!msg) return true; // unknown → treat as transport, never leak empty/raw
  return INFRA_MESSAGE_MARKERS.some((marker) => msg.includes(marker));
}

/**
 * Resolve how a chat send failure should be shown.
 * Domain/product limits may still become a non-archivable system message;
 * all other failures are transient UI only.
 */
export function resolveChatSendFailureDisplay(
  error: unknown,
  tier: AccountTier | string
): ChatSendFailureDisplay {
  const quotaDetail = extractQuotaDetail(error);
  if (quotaDetail?.reason && isQuotaLimitReason(quotaDetail.reason)) {
    return {
      mode: 'domain_message',
      text: resolveChatLimitMessage(quotaDetail.currentTier ?? tier),
    };
  }

  const code = readErrorCode(error);
  if (code === 'DEMO_TOKEN_LIMIT_REACHED') {
    return { mode: 'domain_message', text: DEMO_TOKEN_LIMIT_COPY };
  }
  if (code === 'DEMO_TEXT_LIMIT_EXCEEDED') {
    return { mode: 'domain_message', text: DEMO_TEXT_LIMIT_COPY };
  }

  // Never surface raw apiClient / fetch / status strings as chat content.
  return { mode: 'transient', text: CHAT_TRANSPORT_ERROR_COPY };
}
