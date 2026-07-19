import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import {
  clearConversationSceneIdentity,
  createStandaloneChat,
  setConversationSceneIdentity,
} from '@/lib/standaloneChatArchive';

describe('resolveChromeConversationSceneUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('prefers cleared archive over a stale React prop', () => {
    const id = createStandaloneChat({ title: 'Kyoto' });
    setConversationSceneIdentity(id, {
      url: 'https://cdn.example/old-kyoto.jpg',
      source: 'mirror_local',
    });
    clearConversationSceneIdentity(id);

    expect(
      resolveChromeConversationSceneUrl(id, 'https://cdn.example/old-kyoto.jpg')
    ).toBeNull();
  });

  it('returns fresh archive URL when present', () => {
    const id = createStandaloneChat({ title: 'Kyoto 2' });
    setConversationSceneIdentity(id, {
      url: 'https://cdn.example/new-kyoto.jpg',
      source: 'mirror_local',
    });

    expect(
      resolveChromeConversationSceneUrl(id, 'https://cdn.example/old-kyoto.jpg')
    ).toBe('https://cdn.example/new-kyoto.jpg');
  });

  it('uses prop when no active chat', () => {
    expect(
      resolveChromeConversationSceneUrl(null, 'https://cdn.example/scene.jpg')
    ).toBe('https://cdn.example/scene.jpg');
  });
});
