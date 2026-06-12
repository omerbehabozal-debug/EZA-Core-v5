import type { ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { summarizeArchiveTitle } from '@/lib/standaloneChatArchive';

export type SainaConversationItem = {
  id: string;
  title: string;
  preview: string;
  time: string;
  thumbGradient: string;
};

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #173B45, #0F2B25, #041B17)',
  'linear-gradient(135deg, #c47a3a, #8b5a2b, #3d2914)',
  'linear-gradient(135deg, #4a5568, #2d3748, #1a202c)',
  'linear-gradient(135deg, #6B8A7A, #0F3D32, #1a3d34)',
  'linear-gradient(135deg, #a89078, #6b5d4f, #3d342c)',
  'linear-gradient(135deg, #d4a574, #b8895a, #8b6342)',
  'linear-gradient(135deg, #7a8b9a, #4a5568, #2d3748)',
  'linear-gradient(135deg, #5c6b5a, #3d4a3f, #2a332c)',
  'linear-gradient(135deg, #4a7c8c, #2d5a6b, #1a3d4a)',
] as const;

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function thumbGradientForChatId(id: string): string {
  return THUMB_GRADIENTS[hashId(id) % THUMB_GRADIENTS.length]!;
}

export function formatSainaConversationTime(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 60) return 'Az önce';

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const t = date.getTime();

  if (t >= startOfToday) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  if (t >= startOfYesterday) return 'Dün';

  const diffDays = Math.floor((startOfToday - t) / 86_400_000);
  if (diffDays < 7) return `${diffDays} gün önce`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} hafta önce`;

  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function mapArchivesToSainaConversations(
  archives: ArchivedChatSummary[]
): SainaConversationItem[] {
  return archives.map((item) => ({
    id: item.id,
    title: summarizeArchiveTitle(item.title) || 'Yeni sohbet',
    preview: item.preview?.trim() || 'SAINA ile düşün, keşfet…',
    time: formatSainaConversationTime(item.savedAt),
    thumbGradient: thumbGradientForChatId(item.id),
  }));
}
