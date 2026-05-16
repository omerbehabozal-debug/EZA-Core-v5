/**
 * Safe display helpers — never surface raw user content in governance UI.
 */

const FORBIDDEN_KEYS = new Set([
  'message',
  'content',
  'text',
  'raw_output',
  'query',
  'user_input',
  'assistant_answer',
  'body',
  'prompt',
  'transcript',
  'case_snapshot',
]);

export function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  if (FORBIDDEN_KEYS.has(k)) return true;
  return Array.from(FORBIDDEN_KEYS).some(
    (f) => k === f || k.startsWith(`${f}_`) || k.endsWith(`_${f}`)
  );
}

export function sanitizeRecord(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isForbiddenKey(k)) continue;
    if (typeof v === 'string' && v.length > 200) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function formatGovernanceError(error: unknown): {
  title: string;
  description: string;
} {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.toLowerCase().includes('cross-org')) {
      return {
        title: 'Organizasyon erişimi reddedildi',
        description:
          'Bu organizasyon için yetkiniz yok. Üst menüden doğru organizasyonu seçin veya yöneticinize başvurun.',
      };
    }
    if (msg.toLowerCase().includes('x-org-id')) {
      return {
        title: 'Organizasyon seçilmedi',
        description: 'Devam etmek için bir organizasyon seçin.',
      };
    }
    return { title: 'Veri yüklenemedi', description: msg };
  }
  return {
    title: 'Veri yüklenemedi',
    description: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  };
}
