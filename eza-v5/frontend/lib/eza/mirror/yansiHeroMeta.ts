import {
  formatSainaConversationTime,
  getConversationTimeBucketLabel,
} from '@/lib/eza/sainaConversationList';
import { SAINA_NEW_CHAT } from '@/lib/eza/sainaCopy';
import type { ConversationYansiVisualStatus } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';

export const YANSI_HERO_META_TYPE_YANSI = 'Yansı';

export type YansiHeroMeta = {
  timeLabel: string;
  typeLabel: string;
};

/** Compact hero metadata time — reuses sidebar bucket + time formatting. */
export function formatYansiHeroMetaTime(
  savedAt: string,
  referenceDate: Date = new Date()
): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = referenceDate.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return 'Az önce';

  const timePart = date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const bucket = getConversationTimeBucketLabel(savedAt, referenceDate);

  if (bucket === 'Bugün') return timePart;
  if (bucket === 'Dün') return `Dün ${timePart}`;

  return formatSainaConversationTime(savedAt);
}

/** Authoritative content-type label for hero metadata — no inferred sponsor state. */
export function resolveYansiHeroContentTypeLabel(
  yansiStatus: ConversationYansiVisualStatus | undefined
): string {
  if (yansiStatus === 'published') return YANSI_HERO_META_TYPE_YANSI;
  return SAINA_NEW_CHAT;
}

export function resolveYansiHeroMeta(input: {
  savedAt: string;
  yansiStatus?: ConversationYansiVisualStatus;
  referenceDate?: Date;
}): YansiHeroMeta | null {
  const timeLabel = formatYansiHeroMetaTime(
    input.savedAt,
    input.referenceDate ?? new Date()
  );
  if (!timeLabel) return null;

  return {
    timeLabel,
    typeLabel: resolveYansiHeroContentTypeLabel(input.yansiStatus),
  };
}
