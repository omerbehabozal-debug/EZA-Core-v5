import { readConversationSnapshot } from '@/lib/eza/mirror/conversationMirrorSnapshot';
import { isMirrorBirthMirrorCreated } from '@/lib/eza/mirror-birth/mirrorBirthSession';

export function hasConversationMirrorArtifact(chatId: string): boolean {
  if (isMirrorBirthMirrorCreated(chatId)) return true;
  return Boolean(readConversationSnapshot(chatId));
}
