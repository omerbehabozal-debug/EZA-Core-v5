import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChatArchive } from '@/lib/standaloneChatArchive';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(),
}));

describe('resolveMirrorPublishLineage', () => {
  beforeEach(() => {
    vi.mocked(getChatArchive).mockReset();
  });

  it('returns undefined lineage for direct conversations', () => {
    vi.mocked(getChatArchive).mockReturnValue(null);
    expect(resolveMirrorPublishLineage({ conversationId: 'chat-direct' })).toEqual({});
  });

  it('reads parent slug from treeMetadata when mirrorOrigin is absent', () => {
    vi.mocked(getChatArchive).mockReturnValue({
      id: 'chat-2',
      title: 't',
      preview: 'p',
      savedAt: 'now',
      messageCount: 1,
      messages: [],
      treeMetadata: {
        groupId: 'g1',
        sourceType: 'mirror',
        startedFromMirrorId: 'parent-from-tree',
        parentMirrorId: 'parent-from-tree',
        rootMirrorId: 'root-from-tree',
      },
    });

    const lineage = resolveMirrorPublishLineage({ conversationId: 'chat-2' });
    expect(lineage.parentSlug).toBe('parent-from-tree');
    expect(lineage.rootMirrorId).toBe('root-from-tree');
  });

  it('falls back to curiosity lineage seed', () => {
    vi.mocked(getChatArchive).mockReturnValue(null);
    const lineage = resolveMirrorPublishLineage({
      conversationId: 'chat-3',
      curiosityLineage: 'legacy-parent-slug',
    });
    expect(lineage.parentSlug).toBe('legacy-parent-slug');
  });
});
