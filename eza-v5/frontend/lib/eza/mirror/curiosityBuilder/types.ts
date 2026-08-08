/**
 * Mirror V6 — Curiosity Builder output.
 * Answers: "Why should I enter this conversation?"
 */

export const MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION =
  'mirror-curiosity-builder-v1' as const;

export type CuriosityBuilderOutput = {
  contractVersion: typeof MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION;
  publicTitle: string;
  publicSummary: string;
  continuationContext: string;
  /** Which editorial variant was accepted (0 = primary, 1 = click-test retry). */
  variant: 0 | 1;
  clickTestPassed: boolean;
  clickTestFailures: string[];
};

export type CuriosityBuilderLocale = 'tr' | 'en' | 'ar';
