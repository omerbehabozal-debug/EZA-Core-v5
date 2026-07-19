import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildConversationSceneIdentityFields,
  isPersistableConversationSceneUrl,
} from '@/lib/eza/conversationSceneIdentity';
import {
  createStandaloneChat,
  clearConversationSceneIdentity,
  deleteChatArchive,
  getChatArchive,
  saveStandaloneChat,
  setConversationSceneIdentity,
} from '@/lib/standaloneChatArchive';

describe('conversationSceneIdentity', () => {
  describe('isPersistableConversationSceneUrl', () => {
    it('accepts HTTP(S) URLs', () => {
      expect(isPersistableConversationSceneUrl('https://cdn.example/scene.jpg')).toBe(true);
      expect(isPersistableConversationSceneUrl('http://cdn.example/scene.jpg')).toBe(true);
    });

    it('rejects data:, blob:, and empty values', () => {
      expect(isPersistableConversationSceneUrl('')).toBe(false);
      expect(isPersistableConversationSceneUrl('data:image/png;base64,abc')).toBe(false);
      expect(isPersistableConversationSceneUrl('blob:https://localhost/uuid')).toBe(false);
      expect(isPersistableConversationSceneUrl('not-a-url')).toBe(false);
    });

    it('rejects plain HTTP in production builds', () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(isPersistableConversationSceneUrl('http://cdn.example/scene.jpg')).toBe(false);
      expect(isPersistableConversationSceneUrl('https://cdn.example/scene.jpg')).toBe(true);
      process.env.NODE_ENV = previous;
    });
  });

  describe('setConversationSceneIdentity', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('writes scene identity fields on an existing archive', () => {
      const id = createStandaloneChat({ title: 'Görsel kimlik' });
      const updated = setConversationSceneIdentity(id, {
        url: 'https://cdn.example/mirror-scene.jpg',
        source: 'mirror_guest',
        slug: 'sokak-lambalari',
      });

      expect(updated?.conversationSceneUrl).toBe('https://cdn.example/mirror-scene.jpg');
      expect(updated?.conversationSceneSource).toBe('mirror_guest');
      expect(updated?.conversationSceneSlug).toBe('sokak-lambalari');

      const chat = getChatArchive(id);
      expect(chat?.conversationSceneUrl).toBe('https://cdn.example/mirror-scene.jpg');
    });

    it('clears scene identity so create/update can drop the previous background', () => {
      const id = createStandaloneChat({ title: 'Clear scene' });
      setConversationSceneIdentity(id, {
        url: 'https://cdn.example/old-scene.jpg',
        source: 'mirror_local',
        slug: 'old-slug',
      });

      const cleared = clearConversationSceneIdentity(id);
      expect(cleared?.conversationSceneUrl).toBeNull();
      expect(cleared?.conversationSceneSource).toBeNull();
      expect(cleared?.conversationSceneSlug).toBeNull();
      expect(getChatArchive(id)?.conversationSceneUrl).toBeNull();
    });

    it('does not write non-persistable URLs', () => {
      const id = createStandaloneChat();
      const updated = setConversationSceneIdentity(id, {
        url: 'data:image/png;base64,abc',
        source: 'mirror_local',
        slug: 'test',
      });
      expect(updated).toBeNull();
      expect(getChatArchive(id)?.conversationSceneUrl).toBeUndefined();
    });

    it('blocks scene identity writes for deleted chats', () => {
      const id = createStandaloneChat();
      deleteChatArchive(id);
      const updated = setConversationSceneIdentity(id, {
        url: 'https://cdn.example/scene.jpg',
        source: 'mirror_guest',
        slug: 'slug-1',
      });
      expect(updated).toBeNull();
    });

    it('preserves scene identity through autosave merge', () => {
      const id = createStandaloneChat();
      setConversationSceneIdentity(id, {
        url: 'https://cdn.example/persisted.jpg',
        source: 'mirror_network',
        slug: 'published-slug',
      });

      saveStandaloneChat(id, [{ id: 'm1', text: 'merhaba', isUser: true }]);
      const chat = getChatArchive(id);
      expect(chat?.conversationSceneUrl).toBe('https://cdn.example/persisted.jpg');
      expect(chat?.conversationSceneSource).toBe('mirror_network');
      expect(chat?.conversationSceneSlug).toBe('published-slug');
    });
  });

  describe('buildConversationSceneIdentityFields', () => {
    it('normalizes slug to lowercase', () => {
      const fields = buildConversationSceneIdentityFields({
        url: 'https://cdn.example/a.jpg',
        source: 'mirror_guest',
        slug: 'My-Slug',
      });
      expect(fields?.conversationSceneSlug).toBe('my-slug');
    });
  });
});
