/**
 * SAINA Mirror Philosophy
 *
 * A Mirror is not a conversation summary.
 * A Mirror is not an insight report.
 * A Mirror is not an AI answer.
 *
 * A Mirror is a cinematic curiosity artifact.
 *
 * Four surfaces (Stage 4B — do not collapse):
 *   Mirror creates curiosity.
 *   Caption creates intent.
 *   Landing preserves curiosity.
 *   Conversation satisfies curiosity.
 *
 * Four rules:
 *   Mirror never explains.
 *   Caption never explains. It only invites.
 *   Landing never overwhelms.
 *   Conversation never copies.
 *
 * Never move contextual information back onto the card.
 */

export const SAINA_MIRROR_PHILOSOPHY_MANIFESTO = `SAINA Mirror Philosophy

A Mirror is not a conversation summary.
A Mirror is not an insight report.
A Mirror is not an AI answer.

A Mirror is a cinematic curiosity artifact.

Mirror creates curiosity.
Caption creates intent.
Landing preserves curiosity.
Conversation satisfies curiosity.

Mirror never explains.
Caption never explains. It only invites.
Landing never overwhelms.
Conversation never copies.

Never move contextual information back onto the card.`;

export const SAINA_SHARE_ARCHITECTURE_MANIFESTO = `SAINA Share Architecture (Stage 4B)

SAINA is not a sharing app.
SAINA is not a chat app.
SAINA makes the relationship between curiosity and AI visible.

Mirror is the trace of that relationship.
Share is the journey of that trace.
Landing is the invitation.
Conversation is the continuation of curiosity.

Share Experience never celebrates. It simply prepares.
The celebration happens when another curiosity begins.

Caption speaks to the reader — never about the Mirror.
Caption never says: "This Mirror was created from…"
Caption says: "You can live this curiosity too."

Three caption layers:
  1. shareVoice — Mirror's spirit (one sentence, human)
  2. Invitation — conversation is the product
  3. CTA + shareUrl — never URL alone`;

/** @deprecated Use SAINA_MIRROR_PHILOSOPHY_MANIFESTO — kept for transitional imports. */
export const SAINA_MIRROR_PHILOSOPHY_LEGACY_THREE_SURFACE = `The card creates curiosity.
The landing provides context.
The conversation delivers knowledge.`;

/** Curiosity Seed Intelligence — analysis target is curiosity born from chat, not the chat itself. */
export const CURIOSITY_SEED_INTELLIGENCE_LABEL = 'Curiosity Seed Intelligence' as const;

/**
 * Stage 0 image prompt: include MOOD block when true (A/B: title-only vs title+mood).
 * Default false — title alone often carries atmosphere; mood can over-steer.
 */
export const MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT = false;

export type MirrorPhilosophyCheck = {
  /** Good: card surface has no explanatory body/summary. */
  doesNotExplain: boolean;
  /** Good: card title + core curiosity exist (artifact invites wonder). */
  attractsCuriosity: boolean;
  /** Good: image prompt leakage audit passed. */
  doesNotLeakInformation: boolean;
  passed: boolean;
};

export function evaluateMirrorPhilosophyCheck(input: {
  cardTitle: string;
  coreCuriosity: string;
  mirrorBodyOnCard: boolean;
  promptLeakagePassed: boolean;
}): MirrorPhilosophyCheck {
  const doesNotExplain = !input.mirrorBodyOnCard;
  const attractsCuriosity =
    input.cardTitle.trim().length > 0 && input.coreCuriosity.trim().length > 8;
  const doesNotLeakInformation = input.promptLeakagePassed;
  return {
    doesNotExplain,
    attractsCuriosity,
    doesNotLeakInformation,
    passed: doesNotExplain && attractsCuriosity && doesNotLeakInformation,
  };
}

export function formatMirrorPhilosophyCheck(check: MirrorPhilosophyCheck): string {
  const mark = (ok: boolean) => (ok ? '✓' : '✗');
  return [
    'Mirror Philosophy Check',
    `${mark(check.doesNotExplain)} Card does not explain (no summary on surface)`,
    `${mark(check.attractsCuriosity)} Card attracts curiosity (title + core curiosity)`,
    `${mark(check.doesNotLeakInformation)} Card/prompt does not leak private context`,
    `overall: ${check.passed ? 'PASS' : 'REVIEW'}`,
  ].join('\n');
}
