import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';

const CATEGORY_LABELS: Record<string, string> = {
  travel: 'Seyahat',
  architecture: 'Mimarlık',
  automotive: 'Otomobiller',
  food: 'Yemek',
  culture: 'Kültür',
  history: 'Tarih',
};

/**
 * Infer a human group title from public mirror session fields only.
 */
export function inferMirrorGroupTitle(session: Pick<
  MirrorSohbetSession,
  'cardTitle' | 'seedTopic' | 'seedCategory' | 'seedMood'
>): string {
  const blob = `${session.cardTitle} ${session.seedTopic} ${session.seedCategory} ${session.seedMood}`.toLowerCase();

  if (
    blob.includes('kyoto') ||
    blob.includes('japonya') ||
    blob.includes('japan') ||
    (session.seedCategory === 'travel' && (blob.includes('sokak') || blob.includes('akşam')))
  ) {
    return 'Japonya';
  }

  if (blob.includes('mercedes') || blob.includes('bmw') || blob.includes('otomobil')) {
    return 'Otomobiller';
  }

  if (blob.includes('osmanlı') || blob.includes('mimari') || blob.includes('pencere')) {
    return 'Mimarlık';
  }

  const fromCategory = CATEGORY_LABELS[session.seedCategory];
  if (fromCategory) return fromCategory;

  const topic = session.seedTopic?.trim();
  if (topic && topic.length <= 24) return topic;

  return 'Keşiflerim';
}
