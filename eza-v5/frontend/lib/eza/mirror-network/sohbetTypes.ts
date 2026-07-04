/**
 * Stage 2B — sohbet session types (internal API: seed session; UI: Sohbet).
 */

export type MirrorThoughtCard = {
  id: string;
  label: string;
};

export type MirrorSohbetSession = {
  sessionId: string;
  guestToken: string;
  mirrorSlug: string;
  cardTitle: string;
  openingMessage: string;
  thoughtCards: MirrorThoughtCard[];
  expiresAt: string;
  parentMirrorId: string;
  rootMirrorId: string;
  seedTopic: string;
  seedCategory: string;
  seedMood: string;
  lineageProofToken?: string | null;
  sceneImageUrl?: string | null;
};

export const MIRROR_SOHBET_SESSION_STORAGE_PREFIX = 'saina_mirror_sohbet_session:';
export const MIRROR_GUEST_TOKEN_KEY = 'saina_mirror_guest_token';
