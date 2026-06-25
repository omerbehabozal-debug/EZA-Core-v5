/**
 * SAINA Mirror Philosophy — see ./philosophy.ts
 *
 * Leakage audit: catches regressions when new fields are added to image prompts.
 */

import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { MirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import type {
  MirrorCuriosityBundle,
  MirrorImagePromptLeakageAudit,
} from '@/lib/eza/mirror-network/types';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/;
const ISO_DATE_PATTERN = /\b20\d{2}-\d{2}-\d{2}\b/;
const CONVERSATION_SUMMARY_PHRASES = [
  'conversation summary',
  'sohbet özeti',
  'bugün şunu konuştun',
  'you discussed',
  'the user said',
  'assistant said',
  'kullanıcı dedi',
  'asistan yanıt',
];

/** Strict address-like tokens — avoid false positives on poetic titles (e.g. "Sokak Lambaları"). */
const ADDRESS_PATTERN = /\b(mahalle\s*no|postal\s*code|zip\s*code|cad\.\s*\d|apt\.\s*\d)\b/i;

function containsFragment(haystack: string, needle: string | undefined): boolean {
  const n = (needle ?? '').trim();
  if (!n || n.length < 8) return false;
  return haystack.toLowerCase().includes(n.toLowerCase());
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => containsFragment(haystack, n));
}

function containsPhrase(haystack: string, phrases: string[]): boolean {
  const lower = haystack.toLowerCase();
  return phrases.some((p) => lower.includes(p.toLowerCase()));
}

export type MirrorLeakageAuditOptions = {
  /** Extra strings from live entries (names, quotes) — dev / strict mode. */
  additionalForbiddenFragments?: string[];
};

function containsForbiddenPrivateText(
  prompt: string,
  text: string,
  brief: MirrorRenderBrief,
  bundle: MirrorCuriosityBundle
): boolean {
  const t = text.trim();
  if (t.length < 24) return false;
  if (isAllowedOnPosterSurface(t, brief, bundle)) return false;
  return containsFragment(prompt, t);
}

function isAllowedOnPosterSurface(
  fragment: string,
  brief: MirrorRenderBrief,
  bundle: MirrorCuriosityBundle
): boolean {
  const allowed = [
    brief.title,
    bundle.cardTitle,
    brief.topicCategory.replace(/_/g, ' '),
    brief.topicCategory,
  ]
    .join(' ')
    .toLowerCase();
  const f = fragment.trim().toLowerCase();
  if (!f) return true;
  return allowed.includes(f) || allowed.split(/\s+/).some((w) => w.length > 3 && f.includes(w));
}

export function auditMirrorImagePromptLeakage(
  prompt: string,
  payload: SainaMirrorV3Payload,
  brief: MirrorRenderBrief,
  bundle: MirrorCuriosityBundle,
  options?: MirrorLeakageAuditOptions
): MirrorImagePromptLeakageAudit {
  const evidenceLabels = (payload.conversationEvidence ?? []).map((e) => e.label);
  const privateEvidenceLabels = evidenceLabels.filter(
    (label) => !isAllowedOnPosterSurface(label, brief, bundle)
  );
  const seedInPrompt = bundle.seedQuestions.some((q) => containsFragment(prompt, q));
  const extra = options?.additionalForbiddenFragments ?? [];

  const audit: MirrorImagePromptLeakageAudit = {
    rawConversationInPrompt:
      containsForbiddenPrivateText(prompt, payload.topicSummary, brief, bundle) ||
      containsAny(prompt, extra),
    mirrorBodyInPrompt: containsFragment(prompt, payload.mirrorText),
    curiosityContextInPrompt: containsFragment(prompt, bundle.curiosityContext.text),
    coreCuriosityInPrompt: containsFragment(prompt, bundle.coreCuriosity),
    publicSummaryInPrompt: containsFragment(prompt, bundle.landingContext),
    seedQuestionsInPrompt: seedInPrompt,
    evidenceLabelsInPrompt: containsAny(prompt, privateEvidenceLabels),
    topicHintInPrompt: containsFragment(prompt, brief.publicTopicHint),
    visualDirectionInPrompt: containsFragment(prompt, brief.visualDirection),
    conversationSummaryInPrompt: containsPhrase(prompt, CONVERSATION_SUMMARY_PHRASES),
    userNameInPrompt: containsPhrase(prompt, ['ömer', 'omer', 'user name', 'kullanıcı adı']),
    assistantResponseInPrompt: containsPhrase(prompt, [
      'assistant response',
      'asistan yanıtı',
      'ai response',
    ]),
    emailInPrompt: EMAIL_PATTERN.test(prompt),
    phoneInPrompt: PHONE_PATTERN.test(prompt),
    dateInPrompt:
      ISO_DATE_PATTERN.test(prompt) ||
      (payload.date.length > 8 && containsFragment(prompt, payload.date)) ||
      /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/.test(prompt),
    locationInPrompt: ADDRESS_PATTERN.test(prompt) || containsPhrase(prompt, ['adres:', 'address:']),
    personalEntityInPrompt: containsAny(
      prompt,
      extra.concat(
        [payload.selectedTopic, payload.topic].filter(
          (t) =>
            t.length > 12 &&
            !isAllowedOnPosterSurface(t, brief, bundle) &&
            t !== brief.title &&
            t !== bundle.cardTitle
        )
      )
    ),
    passed: false,
  };

  audit.passed =
    !audit.rawConversationInPrompt &&
    !audit.mirrorBodyInPrompt &&
    !audit.curiosityContextInPrompt &&
    !audit.coreCuriosityInPrompt &&
    !audit.seedQuestionsInPrompt &&
    !audit.evidenceLabelsInPrompt &&
    !audit.topicHintInPrompt &&
    !audit.visualDirectionInPrompt &&
    !audit.conversationSummaryInPrompt &&
    !audit.userNameInPrompt &&
    !audit.assistantResponseInPrompt &&
    !audit.emailInPrompt &&
    !audit.phoneInPrompt &&
    !audit.dateInPrompt &&
    !audit.locationInPrompt &&
    !audit.personalEntityInPrompt;

  return audit;
}
