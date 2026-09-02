import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('Phase 8.8G-2 server conversation sync', () => {
  const api = read('lib/eza/standaloneConversationsApi.ts');
  const store = read('lib/eza/serverConversationStore.ts');
  const hook = read('hooks/useAuthenticatedConversationBootstrap.ts');
  const chat = read('components/standalone/StandaloneChatInner.tsx');
  const archive = read('lib/standaloneChatArchive.ts');

  it('defines authenticated conversation API client', () => {
    expect(api).toContain('/api/standalone/conversations');
    expect(api).toContain('listServerConversations');
    expect(api).toContain('getServerConversation');
    expect(api).toContain('createServerConversation');
    expect(api).toContain('deleteServerConversation');
  });

  it('bootstraps server sidebar without requiring localStorage', () => {
    expect(store).toContain('bootstrapServerConversations');
    expect(store).toContain('clearServerConversationState');
    expect(store).toContain('.sort((a, b) => a.sequence - b.sequence)');
    expect(hook).toContain('clearServerConversationState');
    expect(hook).toContain('bootstrapServerConversations');
  });

  it('wires generation persistence payload into stream requests', () => {
    expect(chat).toContain('buildGenerationPersistencePayload');
    expect(store).toContain('clientUserMessageId');
    expect(store).toContain('clientAssistantMessageId');
    expect(chat).toContain('ensureServerConversation');
  });

  it('uses server summaries for authenticated sidebar', () => {
    expect(chat).toContain('isServerBacked');
    expect(chat).toContain('serverSummaries');
    expect(chat).toContain('fetchServerConversationDetail');
    expect(chat).toContain('deleteServerBackedConversation');
  });

  it('tracks serverConversationId on archived chats', () => {
    expect(archive).toContain('serverConversationId?: string');
  });

  it('does not auto-upload legacy local chats in store layer', () => {
    expect(store).not.toContain('listChatArchives');
    expect(store).not.toContain('migrateGuest');
    expect(store).not.toContain('bulkImport');
  });

  it('local 30 cap remains client-only', () => {
    expect(archive).toContain('MAX_CHATS = 30');
    expect(store).not.toContain('MAX_CHATS');
    expect(store).not.toContain('slice(0, MAX_CHATS)');
  });
});

describe('Phase 8.8G-2 backend generation authority', () => {
  const pipeline = read('../backend/core/schemas/pipeline.py');
  const persistence = read('../backend/services/standalone/generation_persistence.py');
  const streaming = read('../backend/api/streaming.py');
  const main = read('../backend/main.py');

  it('extends standalone request with persistence idempotency keys', () => {
    expect(pipeline).toContain('serverConversationId');
    expect(pipeline).toContain('clientUserMessageId');
    expect(pipeline).toContain('clientAssistantMessageId');
  });

  it('persists assistant from server generation path', () => {
    expect(persistence).toContain('persist_assistant_turn_after_generation');
    expect(persistence).toContain('persist_user_turn_before_generation');
    expect(streaming).toContain('persist_assistant_turn_after_generation');
    expect(main).toContain('persist_user_turn_before_generation');
  });
});
