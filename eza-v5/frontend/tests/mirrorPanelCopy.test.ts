import { describe, expect, it } from 'vitest';
import {
  isContinuationMirrorChat,
  resolveMirrorPanelCopy,
  resolveMirrorPanelCopyForChat,
} from '@/lib/eza/mirror/resolveMirrorPanelCopy';
import { SAINA_CREATE_VISUAL } from '@/lib/eza/sainaCopy';
import type { ArchivedChat } from '@/lib/standaloneChatArchive';

describe('resolveMirrorPanelCopy', () => {
  it('root copy uses Görseli Oluştur and Ayna outcome language', () => {
    const copy = resolveMirrorPanelCopy(false);
    expect(copy.createButton).toBe(SAINA_CREATE_VISUAL);
    expect(copy.emptyTitle).toContain('Aynaya sahip değil');
    expect(copy.generating).toContain('Aynan');
    expect(copy.ready).toContain('Aynan');
    expect(copy.emptyBody).not.toContain('Yansı');
  });

  it('continuation copy teaches Yansı in narrative only', () => {
    const copy = resolveMirrorPanelCopy(true);
    expect(copy.createButton).toBe(SAINA_CREATE_VISUAL);
    expect(copy.emptyBody).toContain('Yansı doğabilir');
    expect(copy.generating).toContain('Yansın');
    expect(copy.ready).toContain('Yansın');
  });

  it('detects continuation from mirrorOrigin', () => {
    const chat = {
      id: 'chat-1',
      title: 'Guest',
      preview: '',
      savedAt: '',
      messageCount: 1,
      messages: [],
      mirrorOrigin: {
        startedFromMirrorId: 'parent-slug',
        parentMirrorId: 'parent-slug',
        rootMirrorId: 'parent-slug',
        seedTopic: 'Kyoto',
        seedCategory: 'travel',
        seedMood: 'discovery',
        isGuestSession: true,
        autoReplyPending: false,
      },
    } as ArchivedChat;

    expect(isContinuationMirrorChat(chat)).toBe(true);
    expect(resolveMirrorPanelCopyForChat(chat).emptyBody).toContain('Yansı');
  });

  it('detects continuation from treeMetadata after mirrorOrigin is cleared', () => {
    const chat = {
      id: 'chat-2',
      title: 'Merged',
      preview: '',
      savedAt: '',
      messageCount: 1,
      messages: [],
      treeMetadata: {
        sourceType: 'mirror',
        startedFromMirrorId: 'parent-slug',
        parentMirrorId: 'parent-slug',
        rootMirrorId: 'parent-slug',
      },
    } as ArchivedChat;

    expect(isContinuationMirrorChat(chat)).toBe(true);
    expect(resolveMirrorPanelCopyForChat(chat).generating).toContain('Yansın');
    expect(resolveMirrorPanelCopyForChat(chat).ready).toContain('Yansın');
  });
});
