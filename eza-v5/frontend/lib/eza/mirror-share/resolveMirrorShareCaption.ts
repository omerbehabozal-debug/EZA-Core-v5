/**
 * Resolve platform share caption from Mirror Share Identity.
 */

import { buildDailyMirrorShareText } from '@/lib/eza/mirror/dailyMirrorShareText';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { buildMirrorCuriosityBundle } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';
import { buildShareVoice } from '@/lib/eza/mirror-share/buildShareVoice';
import { buildInstagramShareCaptionFromBlueprint } from '@/lib/eza/mirror-share/builders/instagram';
import type { MirrorShareIdentity } from '@/lib/eza/mirror-share/types';

function evidenceBlobFromPayload(
  payload: NonNullable<DailyMirrorCardModel['mirrorV3Payload']>
): string {
  return (payload.conversationEvidence ?? [])
    .map((item) => `${item.label} ${item.visualHint ?? ''}`)
    .join(' ')
    .toLowerCase();
}

export function resolveMirrorShareIdentity(card: DailyMirrorCardModel): MirrorShareIdentity | null {
  if (card.mirrorShare) return card.mirrorShare;

  const payload = card.mirrorV3Payload;
  if (!payload) return null;

  const pipeline = payload.curiosityBundle ?? buildMirrorCuriosityBundle(payload);
  const blob = evidenceBlobFromPayload(payload);
  const shareVoice = pipeline.shareVoice ?? buildShareVoice(pipeline.seed, blob);
  const blueprint = buildShareBlueprint(pipeline, blob);

  return {
    blueprint,
    shareVoice,
    shareUrl: null,
  };
}

export function resolveMirrorShareCaption(
  card?: DailyMirrorCardModel | null,
  platform: 'instagram' = 'instagram'
): string {
  if (!card) {
    return buildDailyMirrorShareText({
      date: new Date().toISOString().slice(0, 10),
      dayLabel: '',
      headline: '',
      characterName: '',
      personaFamilyId: 'balanced_calm',
      shortInsight: '',
      userLine: '',
      aiLine: '',
      balanceLine: '',
      signalLevel: '',
      confidence: '',
      energyLabel: '',
      energyScore: null,
      shareEnabled: true,
      privacyText: '',
    } as DailyMirrorCardModel);
  }

  const identity = resolveMirrorShareIdentity(card);
  if (!identity) {
    return buildDailyMirrorShareText(card);
  }

  if (platform === 'instagram') {
    return buildInstagramShareCaptionFromBlueprint(
      identity.blueprint,
      identity.shareVoice.text,
      identity.shareUrl
    );
  }

  return buildInstagramShareCaptionFromBlueprint(
    identity.blueprint,
    identity.shareVoice.text,
    identity.shareUrl
  );
}
