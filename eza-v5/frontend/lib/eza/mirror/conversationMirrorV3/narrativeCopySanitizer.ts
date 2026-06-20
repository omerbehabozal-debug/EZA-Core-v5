/**
 * V3.1 — strip conversation-summary language and direct topic references from mirror copy.
 */

import {
  clampWords,
  countWords,
  MIRROR_TEXT_MAX_WORDS,
  MIRROR_TEXT_MIN_WORDS,
  polishMirrorTitle,
} from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';

/** Conversation-meta phrases — mirror describes meaning, not the chat. */
const CONVERSATION_SUMMARY_PATTERNS: RegExp[] = [
  /\btoday you discussed\b/i,
  /\byou talked about\b/i,
  /\byou explored\b/i,
  /\btoday you\b/i,
  /\bbugün\b[^.]{0,40}\bkonuştun\b/i,
  /\bbugün\b[^.]{0,40}\baraştırdın\b/i,
  /\bbugün\b[^.]{0,40}\bkeşfettin\b/i,
  /\bkonuşman\b/i,
  /\bsohbetin\b/i,
  /\bsohbet\b/i,
  /\bkonuştun\b/i,
  /\baraştırdın\b/i,
  /\bbugün\b/i,
];

const TOPIC_TOKEN_STOPWORDS = new Set([
  've',
  'ile',
  'için',
  'bir',
  'vs',
  'the',
  'and',
  'or',
]);

export function hasConversationSummaryLanguage(text: string): boolean {
  return CONVERSATION_SUMMARY_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeTopicToken(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '')
    .trim()
    .toLowerCase();
}

export function extractTopicTokens(...sources: (string | undefined)[]): string[] {
  const tokens = new Set<string>();
  for (const source of sources) {
    if (!source?.trim()) continue;
    for (const raw of source.split(/[\s,/\-–—]+/)) {
      const token = normalizeTopicToken(raw);
      if (token.length < 3 || TOPIC_TOKEN_STOPWORDS.has(token)) continue;
      tokens.add(token);
    }
  }
  return Array.from(tokens);
}

export function containsDirectTopicReference(
  text: string,
  topicTokens: readonly string[]
): boolean {
  const lower = text.toLowerCase();
  return topicTokens.some((token) => {
    if (token.length < 3) return false;
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    return re.test(lower);
  });
}

export function sanitizeNarrativeMirrorCopy(
  text: string,
  topicTokens: readonly string[] = []
): string {
  if (!text.trim()) return text;
  if (hasConversationSummaryLanguage(text)) return '';
  if (topicTokens.length > 0 && containsDirectTopicReference(text, topicTokens)) {
    return '';
  }
  return text.trim();
}

export function polishNarrativeMirrorText(text: string): string {
  const clamped = clampWords(text.trim(), MIRROR_TEXT_MAX_WORDS);
  if (countWords(clamped) < MIRROR_TEXT_MIN_WORDS && countWords(text) > MIRROR_TEXT_MAX_WORDS) {
    return clamped;
  }
  return clamped;
}

export function polishNarrativeMirrorPayloadCopy(input: {
  mirrorTitle: string;
  mirrorText: string;
  selectedTopic: string;
  topic: string;
}): { mirrorTitle: string; mirrorText: string } {
  const topicTokens = extractTopicTokens(input.selectedTopic, input.topic);
  const sanitized = sanitizeNarrativeMirrorCopy(input.mirrorText, topicTokens);
  return {
    mirrorTitle: polishMirrorTitle(input.mirrorTitle),
    mirrorText: polishNarrativeMirrorText(sanitized || input.mirrorText),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
