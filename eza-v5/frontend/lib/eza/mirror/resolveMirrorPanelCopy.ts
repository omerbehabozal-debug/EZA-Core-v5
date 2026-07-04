/**
 * SAINA mirror panel — contextual copy (root vs continuation).
 * User action is always "Görseli Oluştur"; system names the outcome Ayna or Yansı.
 */

import type { ArchivedChat } from '@/lib/standaloneChatArchive';
import { SAINA_CREATE_VISUAL } from '@/lib/eza/sainaCopy';

export type MirrorPanelCopy = {
  panelSubtitle: string;
  emptyTitle: string;
  emptyBody: string;
  createButton: string;
  generating: string;
  ready: string;
};

export function isContinuationMirrorChat(chat: ArchivedChat | null | undefined): boolean {
  if (!chat) return false;
  if (chat.mirrorOrigin?.startedFromMirrorId) return true;
  const tree = chat.treeMetadata;
  if (tree?.startedFromMirrorId || tree?.parentMirrorId) return true;
  if (tree?.sourceType === 'mirror' || tree?.sourceType === 'mirror_branch') return true;
  return false;
}

export function resolveMirrorPanelCopy(isContinuation: boolean): MirrorPanelCopy {
  if (isContinuation) {
    return {
      panelSubtitle: 'Bu sohbet, başka bir merak yolculuğunun devamında doğdu.',
      emptyTitle: 'Bu sohbet, başka bir merak yolculuğunun devamında doğdu.',
      emptyBody:
        'Sen de bu yolculuğa kendi bakışını kattın. Bu sohbetten sana ait yeni bir Yansı doğabilir.',
      createButton: SAINA_CREATE_VISUAL,
      generating: 'Yansın hazırlanıyor…',
      ready: 'Yansın hazır.',
    };
  }

  return {
    panelSubtitle: 'Bu sohbet henüz bir Aynaya sahip değil.',
    emptyTitle: 'Bu sohbet henüz bir Aynaya sahip değil.',
    emptyBody: 'Bu sohbeti temsil edecek görsel kimliği oluştur.',
    createButton: SAINA_CREATE_VISUAL,
    generating: 'Aynan hazırlanıyor…',
    ready: 'Aynan hazır.',
  };
}

export function resolveMirrorPanelCopyForChat(
  chat: ArchivedChat | null | undefined
): MirrorPanelCopy {
  return resolveMirrorPanelCopy(isContinuationMirrorChat(chat));
}
