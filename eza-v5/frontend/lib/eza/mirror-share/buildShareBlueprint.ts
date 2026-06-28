import type { MirrorCuriosityPipeline } from '@/lib/eza/mirror-network/types';
import type { ShareBlueprint, ShareInvitationStyle, ShareTone, ShareVoicePreset } from '@/lib/eza/mirror-share/types';
import { buildShareVoice } from '@/lib/eza/mirror-share/buildShareVoice';

function resolveTone(preset: ShareVoicePreset): ShareTone {
  return preset === 'clear_confident_direct' ? 'direct' : 'editorial';
}

function resolveInvitationStyle(preset: ShareVoicePreset): ShareInvitationStyle {
  return preset === 'clear_confident_direct' ? 'own_journey' : 'continue_questions';
}

export function buildShareBlueprint(pipeline: MirrorCuriosityPipeline, blob: string): ShareBlueprint {
  const shareVoiceLine = pipeline.shareVoice ?? buildShareVoice(pipeline.seed, blob);
  const preset = shareVoiceLine.preset;

  return {
    shareVoice: preset,
    tone: resolveTone(preset),
    invitationStyle: resolveInvitationStyle(preset),
  };
}
