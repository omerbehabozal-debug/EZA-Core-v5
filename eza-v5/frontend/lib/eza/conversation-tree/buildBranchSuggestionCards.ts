/**
 * Build branch suggestion cards from public-safe mirror sources (max 3).
 */

export type BranchSuggestionSources = {
  thoughtCards?: string[];
  seedQuestions?: string[];
  discoverySignals?: string[];
  collectionTags?: string[];
};

const FALLBACK_LABEL = 'Bu konuyu farklı açıdan keşfet';

function editorialLabel(raw: string): string {
  const text = (raw || '').trim().replace(/\?+$/g, '');
  if (!text) return '';
  if (text.length > 48) return `${text.slice(0, 45).trim()}…`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildBranchSuggestionCards(sources: BranchSuggestionSources): string[] {
  const ordered = [
    ...(sources.thoughtCards ?? []),
    ...(sources.seedQuestions ?? []),
    ...(sources.discoverySignals ?? []),
    ...(sources.collectionTags ?? []),
  ];

  const cards: string[] = [];
  const seen = new Set<string>();

  for (const item of ordered) {
    const label = editorialLabel(item);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(label);
    if (cards.length >= 3) break;
  }

  if (cards.length === 0) return [FALLBACK_LABEL];
  return cards;
}
