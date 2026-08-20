/**
 * Phase 8.3.1 — auth persistence, account isolation, lineage closure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearPendingGuestClaim,
  guestScope,
  isJwtExpired,
  readPendingGuestClaim,
  scopeKey,
  userScope,
  writePendingGuestClaim,
} from '@/lib/eza/localIdentityScope';
import {
  createConversationGroup,
  listConversationGroups,
  listConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { mergeGuestConversationTree } from '@/lib/eza/conversation-tree/mergeGuestConversationTree';
import { resolveLineageProofToken } from '@/lib/eza/mirror-network/resolveLineageProofToken';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';
import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';
import {
  createStandaloneChat,
  readActiveChatId,
  readChatArchives,
  readChatArchivesForScope,
  upsertChatArchive,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';
import { claimGuestConversationGroups } from '@/lib/eza/conversation-tree/claimGuestConversationGroups';
import { peekMirrorGuestToken, rotateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';

vi.mock('@/lib/eza/conversation-tree/claimGuestConversationGroups', () => ({
  claimGuestConversationGroups: vi.fn().mockResolvedValue({ claimed: [], merged: 0 }),
}));

const USER_A = 'user-a-111';
const USER_B = 'user-b-222';
const GUEST = 'guest-phase831-token-abcdefgh';

function asGuest(token = GUEST): void {
  localStorage.removeItem('eza_token');
  localStorage.removeItem('eza_user');
  localStorage.setItem(MIRROR_GUEST_TOKEN_KEY, token);
}

function asUser(userId: string, token = `jwt-${userId}`): void {
  localStorage.setItem('eza_token', token);
  localStorage.setItem(
    'eza_user',
    JSON.stringify({ user_id: userId, email: `${userId}@example.com`, role: 'proxy_user' })
  );
}

function makeJwt(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow, sub: 'x' })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('Phase 8.3.1 account-scoped local conversation state', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    clearPendingGuestClaim();
  });

  it('scopes chat archive, groups, and active chat by identity', () => {
    asUser(USER_A);
    const groupA = createConversationGroup({ title: 'A Group', userId: USER_A });
    const chatA = createStandaloneChat({ groupId: groupA.id, title: 'A chat' });
    writeActiveChatId(chatA);

    asGuest();
    expect(readChatArchives().some((c) => c.id === chatA)).toBe(false);
    expect(listConversationGroups().some((g) => g.id === groupA.id)).toBe(false);
    expect(readActiveChatId()).toBeNull();

    asUser(USER_B);
    const groupB = createConversationGroup({ title: 'B Group', userId: USER_B });
    createStandaloneChat({ groupId: groupB.id, title: 'B chat' });
    expect(readChatArchives().some((c) => c.id === chatA)).toBe(false);
    expect(readChatArchives().some((c) => c.title === 'B chat')).toBe(true);

    asUser(USER_A);
    expect(readChatArchives().some((c) => c.id === chatA)).toBe(true);
    expect(listConversationGroups().some((g) => g.id === groupA.id)).toBe(true);
    expect(readActiveChatId()).toBe(chatA);
  });

  it('logout identity switch hides A; B cannot see A; A restore works', async () => {
    asGuest();
    const g = createConversationGroup({ title: 'Guest Seed', guestToken: GUEST });
    createStandaloneChat({
      groupId: g.id,
      title: 'Seed chat',
      treeMetadata: { groupId: g.id, sourceType: 'direct', isGuestSession: true },
    });

    await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt-a',
    });

    asUser(USER_A);
    expect(readChatArchives().some((c) => c.title === 'Seed chat')).toBe(true);

    // Simulate logout visibility: clear auth + rotate guest
    asGuest(rotateMirrorGuestToken());
    expect(readChatArchives().some((c) => c.title === 'Seed chat')).toBe(false);

    asUser(USER_B);
    createStandaloneChat({ title: 'Only B' });
    expect(readChatArchives().map((c) => c.title)).toEqual(['Only B']);

    asUser(USER_A);
    expect(readChatArchives().some((c) => c.title === 'Seed chat')).toBe(true);
    expect(readChatArchives().some((c) => c.title === 'Only B')).toBe(false);
  });

  it('guest→user rebind is additive and idempotent', async () => {
    asUser(USER_A);
    upsertChatArchive({
      id: 'chat-existing-a',
      title: 'Existing A',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 0,
      messages: [],
    });

    asGuest();
    upsertChatArchive({
      id: 'chat-guest-only',
      title: 'Guest only',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 0,
      messages: [],
      treeMetadata: { sourceType: 'direct', isGuestSession: true },
    });

    const first = await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt-a',
    });
    const second = await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt-a',
    });

    expect(first.merged).toBe(true);
    expect(second.merged).toBe(false);

    asUser(USER_A);
    const titles = readChatArchives().map((c) => c.title).sort();
    expect(titles).toEqual(['Existing A', 'Guest only']);
    expect(readChatArchivesForScope(guestScope(GUEST))).toHaveLength(0);
  });

  it('merge keeps lineage proof for stream/publish fallback', async () => {
    asGuest();
    upsertChatArchive({
      id: 'chat-proof',
      title: 'Proof',
      preview: '',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'hi', isUser: true }],
      mirrorOrigin: {
        startedFromMirrorId: 'parent-slug',
        parentMirrorId: 'parent-slug',
        rootMirrorId: 'root-slug',
        seedTopic: 't',
        seedCategory: 'c',
        seedMood: 'm',
        lineageProofToken: 'proof-831',
        isGuestSession: true,
      },
    });

    await mergeGuestConversationTree({ userId: USER_A, guestToken: GUEST, authToken: 'jwt' });
    asUser(USER_A);
    const chat = readChatArchives().find((c) => c.id === 'chat-proof');
    expect(resolveLineageProofToken(chat)).toBe('proof-831');
    expect(chat?.mirrorOrigin).toBeUndefined();
    expect(resolveMirrorPublishLineage({ conversationId: 'chat-proof' }).lineageProofToken).toBe(
      'proof-831'
    );
  });

  it('resolveLineageProofToken prefers mirrorOrigin then treeMetadata', () => {
    expect(
      resolveLineageProofToken({
        mirrorOrigin: { lineageProofToken: 'from-origin' },
        treeMetadata: { lineageProofToken: 'from-tree' },
      })
    ).toBe('from-origin');
    expect(
      resolveLineageProofToken({
        treeMetadata: { lineageProofToken: 'from-tree' },
      })
    ).toBe('from-tree');
  });

  it('skips empty claim on reopen; retries claim when pending marker set', async () => {
    const empty = await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt',
    });
    expect(empty.claimAttempted).toBe(false);
    expect(claimGuestConversationGroups).not.toHaveBeenCalled();

    writePendingGuestClaim({ guestToken: GUEST, userId: USER_A });
    const retry = await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt',
      rotateGuestTokenAfterClaim: false,
    });
    expect(retry.claimAttempted).toBe(true);
    expect(claimGuestConversationGroups).toHaveBeenCalledWith(GUEST);
    expect(readPendingGuestClaim()).toBeNull();
  });

  it('claim failure keeps pending marker and does not rotate guest token', async () => {
    vi.mocked(claimGuestConversationGroups).mockRejectedValueOnce(new Error('claim failed'));
    asGuest();
    createStandaloneChat({
      title: 'Pending guest',
      treeMetadata: { sourceType: 'direct', isGuestSession: true },
    });
    const before = peekMirrorGuestToken();

    const result = await mergeGuestConversationTree({
      userId: USER_A,
      guestToken: GUEST,
      authToken: 'jwt',
    });

    expect(result.claimOk).toBe(false);
    expect(result.guestTokenRotated).toBe(false);
    expect(peekMirrorGuestToken()).toBe(before);
    expect(readPendingGuestClaim()).toEqual({ guestToken: GUEST, userId: USER_A });

    asUser(USER_A);
    expect(readChatArchives().some((c) => c.title === 'Pending guest')).toBe(true);
  });

  it('auth failure path must not move guest data (no premature user scope)', () => {
    asGuest();
    createStandaloneChat({ title: 'Stay guest' });
    // Simulate failed login: no eza_token/user written
    expect(localStorage.getItem('eza_token')).toBeNull();
    expect(readChatArchives().some((c) => c.title === 'Stay guest')).toBe(true);
    expect(listConversationGroupsForScope(userScope(USER_A))).toHaveLength(0);
    expect(scopeKey(guestScope(GUEST))).toBe(`guest:${GUEST}`);
  });

  it('JWT expiry helper detects expired tokens', () => {
    expect(isJwtExpired(makeJwt(-60))).toBe(true);
    expect(isJwtExpired(makeJwt(3600))).toBe(false);
    expect(isJwtExpired('opaque-token')).toBeNull();
  });
});

describe('Phase 8.3.1 source contracts', () => {
  it('AuthContext validates session on hydrate and keeps isAuthReady gated', () => {
    const src = readFileSync(join(process.cwd(), 'context/AuthContext.tsx'), 'utf8');
    expect(src).toContain('validateAuthSession');
    expect(src).toContain('isJwtExpired');
    expect(src).toContain('setIsAuthReady(true)');
    expect(src).toContain('rotateMirrorGuestToken');
    expect(src).toContain('notifyConversationVisibilityChanged');
  });

  it('StandaloneChatInner uses canonical resolveLineageProofToken', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(src).toContain('resolveLineageProofToken');
    expect(src).toContain('lineageProofTokenForSend = resolveLineageProofToken(activeChat)');
  });

  it('does not emit Phase 6 experience events during auth hydrate', () => {
    const src = readFileSync(join(process.cwd(), 'context/AuthContext.tsx'), 'utf8');
    expect(src).not.toContain('trackExperience');
    expect(src).not.toContain('STARTED');
    expect(src).not.toContain('COMPLETED');
    expect(src).not.toContain('SKIPPED');
    expect(src).not.toContain('yansiExposure');
  });
});
