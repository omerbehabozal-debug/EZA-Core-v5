/**
 * Click Test — would I enter this chat from Keşfet?
 * Fail → Curiosity Builder regenerates once with an alternate variant.
 */

import type { CuriosityBuilderOutput } from '@/lib/eza/mirror/curiosityBuilder/types';

const FORBIDDEN_OPENINGS =
  /^(bu mirror|this mirror|bu sohbet|this conversation|bu içerik|this content|bu özet|this summary|bu makale|this article|bu keşif|this exploration|bu ayna)\b/i;

const FORBIDDEN_PHRASES = [
  'decision making process',
  'journey',
  'explores',
  'insights',
  'analysis',
  'this mirror explores',
  'this conversation discusses',
  'this content',
  'this summary',
  'this article',
  'yapay zeka',
  'ai report',
  'technical analysis',
] as const;

const BLOG_TITLE_PATTERNS = [
  /^choosing the right\b/i,
  /^luxury\s+\w+\s+comparison\b/i,
  /^car review\b/i,
  /\bcomparison\b/i,
  /\breview\b/i,
  /\bguide\b/i,
  /\binsights?\b/i,
  /\banalysis\b/i,
  /^how to\b/i,
  /^the ultimate\b/i,
  /^a complete\b/i,
];

const CATEGORY_TITLES = [
  'travel',
  'architecture',
  'vehicle',
  'family suv',
  'general curiosity',
  'seyahat',
  'mimari',
];

export type ClickTestResult = {
  passed: boolean;
  failures: string[];
};

export function runCuriosityClickTest(card: {
  publicTitle: string;
  publicSummary: string;
  continuationContext?: string;
}): ClickTestResult {
  const failures: string[] = [];
  const title = (card.publicTitle || '').trim();
  const summary = (card.publicSummary || '').trim();

  if (!title) failures.push('empty_title');
  if (!summary) failures.push('empty_summary');

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 0 && (words.length < 3 || words.length > 10)) {
    failures.push('title_word_count');
  }

  if (FORBIDDEN_OPENINGS.test(summary)) {
    failures.push('ai_opening');
  }

  const blob = `${title} ${summary}`.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (blob.includes(phrase)) {
      failures.push(`forbidden:${phrase}`);
      break;
    }
  }

  for (const pat of BLOG_TITLE_PATTERNS) {
    if (pat.test(title)) {
      failures.push('blog_title');
      break;
    }
  }

  if (CATEGORY_TITLES.some((c) => title.toLowerCase() === c)) {
    failures.push('category_title');
  }

  // Summary should be short editorial (≤2 sentences, not a report).
  const sentenceCount = (summary.match(/[.!?…](\s|$)/g) || []).length;
  if (sentenceCount > 3) failures.push('summary_too_many_sentences');
  if (summary.length > 320) failures.push('summary_too_long');
  if (summary.length > 0 && summary.length < 24) failures.push('summary_too_thin');

  // Must imply a reason to enter — question, contrast, or concrete stakes.
  const hasClickHook =
    /[?？]/.test(title) ||
    /\b(mü|mi|mu|mü\?|vs|yoksa|değil|hangisi|neden|why|or|vs\.)\b/i.test(title) ||
    /\b(merak|karar|seç|huzur|sessizlik|yerel|aile|konfor|curiosity|decide|quiet|local)\b/i.test(
      blob
    );
  if (title && summary && !hasClickHook) {
    failures.push('no_click_hook');
  }

  return { passed: failures.length === 0, failures };
}

export function clickTestAccepted(
  output: Pick<CuriosityBuilderOutput, 'publicTitle' | 'publicSummary'>
): boolean {
  return runCuriosityClickTest(output).passed;
}
