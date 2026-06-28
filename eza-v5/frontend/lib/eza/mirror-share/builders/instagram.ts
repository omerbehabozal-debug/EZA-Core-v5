/**
 * Share Builder — Instagram (Stage 4B first platform).
 * Platform changes expression; Mirror identity does not.
 */

import {
  SHARE_CTA_CONTINUE_FROM_HERE,
  SHARE_INVITATION_CONTINUE_QUESTIONS,
  SHARE_INVITATION_OWN_JOURNEY,
} from '@/lib/eza/mirror-share/shareExperienceCopy';
import type { ShareBlueprint, ShareCaptionLayers } from '@/lib/eza/mirror-share/types';

const BRIDGE_RULE = '━━━━━━━━━━━━━━';

function resolveInvitation(blueprint: ShareBlueprint): string {
  return blueprint.invitationStyle === 'own_journey'
    ? SHARE_INVITATION_OWN_JOURNEY
    : SHARE_INVITATION_CONTINUE_QUESTIONS;
}

export function buildShareCaptionLayers(
  blueprint: ShareBlueprint,
  shareVoiceLine: string,
  shareUrl?: string | null
): ShareCaptionLayers {
  return {
    captionLine: shareVoiceLine.trim(),
    invitation: resolveInvitation(blueprint),
    ctaLabel: SHARE_CTA_CONTINUE_FROM_HERE,
    shareUrl: shareUrl?.trim() || null,
  };
}

export function formatShareUrlForCaption(shareUrl: string): string {
  return shareUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** Three-layer caption for native share sheet (Instagram-first). */
export function buildInstagramShareCaption(layers: ShareCaptionLayers): string {
  const lines: string[] = [layers.captionLine, '', layers.invitation];

  if (layers.shareUrl) {
    lines.push(
      '',
      BRIDGE_RULE,
      '',
      layers.ctaLabel,
      '',
      formatShareUrlForCaption(layers.shareUrl),
      '',
      BRIDGE_RULE
    );
  }

  return lines.join('\n').trim();
}

export function buildInstagramShareCaptionFromBlueprint(
  blueprint: ShareBlueprint,
  shareVoiceLine: string,
  shareUrl?: string | null
): string {
  return buildInstagramShareCaption(buildShareCaptionLayers(blueprint, shareVoiceLine, shareUrl));
}
