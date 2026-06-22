/**
 * V5 provider prompt contract — mirrors backend openai_prompt_builder.py.
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import {
  MIRROR_V5_MAX_RENDER_PROMPT_CHARS,
  MIRROR_V5_PROMPT_CONTRACT,
  MIRROR_V5_RENDER_CONTRACT_MARKER,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';

export { MIRROR_V5_PROMPT_CONTRACT, MIRROR_V5_RENDER_CONTRACT_MARKER };

const LEGACY_MAX_COMBINED_LEN = 8000;
const MAX_NEGATIVE_APPEND = 600;
const MAX_HINTS_APPEND = 400;

export type MirrorProviderPromptAudit = {
  frontendMinimalPrompt: string;
  backendProviderPrompt: string;
  promptSameAsFrontend: boolean;
  providerPromptLength: number;
  backendAppendedSections: string[];
  backendAppendApplied: boolean;
  containsLegacyAvoid: boolean;
  containsQualityBlock: boolean;
  containsStyleBlock: boolean;
  withinV5Limit: boolean;
};

export function isV5MinimalVisual(visual: Pick<MirrorVisualPromptPayload, 'promptContract'>): boolean {
  return visual.promptContract === MIRROR_V5_PROMPT_CONTRACT;
}

function normalizeV5Prompt(text: string): string {
  const lines = text.split('\n').map((line) => line.replace(/\s+$/, ''));
  return lines.join('\n').trim();
}

function stripV5Marker(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() !== MIRROR_V5_RENDER_CONTRACT_MARKER)
    .join('\n')
    .trim();
}

/** Mirrors backend build_openai_mirror_prompt for dev QA / runtime reports. */
export function buildMirrorProviderPrompt(visual: MirrorVisualPromptPayload): string {
  if (isV5MinimalVisual(visual)) {
    let prompt = normalizeV5Prompt(stripV5Marker(visual.prompt.trim()));
    if (prompt.length > MIRROR_V5_MAX_RENDER_PROMPT_CHARS) {
      prompt = prompt.slice(0, MIRROR_V5_MAX_RENDER_PROMPT_CHARS).trimEnd();
    }
    return prompt;
  }

  const core = visual.prompt.trim();
  const parts: string[] = core ? [core] : [];

  const neg = (visual.negativePrompt || '').trim();
  if (neg && !core.includes(neg)) {
    parts.push(`Avoid: ${neg.slice(0, MAX_NEGATIVE_APPEND)}`);
  }

  if (visual.qualityHints?.length) {
    const hints = visual.qualityHints
      .slice(0, 8)
      .map((h) => h.trim())
      .filter(Boolean)
      .join('; ');
    if (hints && !core.includes(hints)) {
      parts.push(`Quality: ${hints.slice(0, MAX_HINTS_APPEND)}`);
    }
  }

  const preset = (visual.stylePreset || '').trim();
  if (preset && !core.includes(preset)) {
    parts.push(`Style: ${preset}`);
  }

  let combined = parts.join(' ');
  if (combined.length > LEGACY_MAX_COMBINED_LEN) {
    combined = combined.slice(0, LEGACY_MAX_COMBINED_LEN).trimEnd();
  }
  return combined;
}

export function auditMirrorProviderPrompt(
  visual: MirrorVisualPromptPayload
): MirrorProviderPromptAudit {
  const frontendMinimalPrompt = visual.prompt.trim();
  const backendProviderPrompt = buildMirrorProviderPrompt(visual);

  const backendAppendedSections: string[] = [];
  if (backendProviderPrompt.includes('Avoid:') && !frontendMinimalPrompt.includes('Avoid:')) {
    backendAppendedSections.push('Avoid');
  }
  if (backendProviderPrompt.includes('Quality:') && !frontendMinimalPrompt.includes('Quality:')) {
    backendAppendedSections.push('Quality');
  }
  if (
    visual.stylePreset &&
    backendProviderPrompt.includes(`Style: ${visual.stylePreset}`) &&
    !frontendMinimalPrompt.includes(visual.stylePreset)
  ) {
    backendAppendedSections.push('Style');
  }

  return {
    frontendMinimalPrompt,
    backendProviderPrompt,
    promptSameAsFrontend: frontendMinimalPrompt === backendProviderPrompt,
    providerPromptLength: backendProviderPrompt.length,
    backendAppendedSections,
    backendAppendApplied: backendAppendedSections.length > 0,
    containsLegacyAvoid: backendProviderPrompt.includes('Avoid:'),
    containsQualityBlock: backendProviderPrompt.includes('Quality:'),
    containsStyleBlock: backendProviderPrompt.includes('Style:'),
    withinV5Limit: backendProviderPrompt.length <= MIRROR_V5_MAX_RENDER_PROMPT_CHARS,
  };
}
