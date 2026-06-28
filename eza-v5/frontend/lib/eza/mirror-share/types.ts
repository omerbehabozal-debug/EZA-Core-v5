/**
 * SAINA Share Architecture — Stage 4B Foundation.
 * @see @/lib/eza/mirror-network/philosophy (SAINA_SHARE_ARCHITECTURE_MANIFESTO)
 */

/** Mirror Intelligence voice preset — platform-independent identity. */
export type ShareVoicePreset = 'quiet_editorial_minimal' | 'clear_confident_direct';

export type ShareTone = 'editorial' | 'direct';

export type ShareInvitationStyle = 'continue_questions' | 'own_journey';

/** Share Blueprint — how Mirror speaks to the outside world. */
export type ShareBlueprint = {
  shareVoice: ShareVoicePreset;
  tone: ShareTone;
  invitationStyle: ShareInvitationStyle;
};

/** Layer 1 output — speaks to the reader, never about the Mirror. */
export type ShareVoiceLine = {
  text: string;
  preset: ShareVoicePreset;
};

export type SharePlatform = 'instagram';

export type ShareCaptionLayers = {
  captionLine: string;
  invitation: string;
  ctaLabel: string;
  shareUrl: string | null;
};

/** Attached to Mirror at creation — exists even if user never shares. */
export type MirrorShareIdentity = {
  blueprint: ShareBlueprint;
  shareVoice: ShareVoiceLine;
  shareUrl?: string | null;
};
