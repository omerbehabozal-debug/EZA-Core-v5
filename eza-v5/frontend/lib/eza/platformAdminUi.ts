/** Shared BiligN Platform Admin presentation helpers (no API logic). */

export const APPLICATION_STATUS_TR: Record<string, string> = {
  received: 'Alındı',
  under_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export const APPLICATION_ACTION_TR: Record<string, string> = {
  submitted: 'Başvuru alındı',
  under_review: 'İncelemeye alındı',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  note: 'Not eklendi',
};

export const SYSTEM_FEATURE_TR: Record<string, string> = {
  brand_applications: 'Başvuru sistemi',
  knowledge_pool: 'Bilgi havuzu',
  yansi_studio: 'Yansı Stüdyosu',
  publications: 'Yayınlar',
  verification: 'Doğrulama',
};

export const BUSINESS_STATUS_TR: Record<string, string> = {
  active: 'Aktif',
  suspended: 'Askıda',
  archived: 'Arşiv',
  draft: 'Taslak',
};

export function formatPlatformDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatPlatformDateShort(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function applicationStatusLabel(status: string): string {
  return APPLICATION_STATUS_TR[status] || status;
}

export function applicationActionLabel(action: string): string {
  return APPLICATION_ACTION_TR[action] || action;
}

export function businessStatusLabel(status: string): string {
  return BUSINESS_STATUS_TR[status] || status;
}

export function systemFeatureLabel(key: string): string {
  return SYSTEM_FEATURE_TR[key] || key.replace(/_/g, ' ');
}
