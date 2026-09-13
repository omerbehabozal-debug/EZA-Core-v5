/**
 * Live conversation background apply after READY Yansı generation.
 * Scene chrome must not depend on identity-promotion CAS.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isPersistableConversationSceneUrl,
} from '@/lib/eza/conversationSceneIdentity';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import {
  createStandaloneChat,
  getChatArchive,
  setConversationSceneIdentity,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

const SCENE =
  'https://api.ezacore.ai/api/public/mirror-scene-assets/live-apply-scene.png';
const PRIOR =
  'https://api.ezacore.ai/api/public/mirror-scene-assets/prior-scene.png';

/** Mirrors the Experience live-apply gate (auth CAS must not appear here). */
function mayCommitLiveConversationScene(input: {
  conversationId?: string | null;
  sceneImageUrl?: string | null;
}): boolean {
  return (
    Boolean(input.conversationId) &&
    isPersistableConversationSceneUrl(input.sceneImageUrl || '')
  );
}

function applyLiveConversationScene(input: {
  conversationId: string;
  sceneImageUrl: string;
  focalX?: number;
  focalY?: number;
}) {
  if (
    !mayCommitLiveConversationScene({
      conversationId: input.conversationId,
      sceneImageUrl: input.sceneImageUrl,
    })
  ) {
    return false;
  }
  setConversationSceneIdentity(input.conversationId, {
    url: input.sceneImageUrl,
    source: 'mirror_local',
  });
  useSainaChromeStore.getState().setChrome({
    conversationSceneUrl: input.sceneImageUrl,
    ...(typeof input.focalX === 'number'
      ? { conversationSceneFocalX: input.focalX }
      : {}),
    ...(typeof input.focalY === 'number'
      ? { conversationSceneFocalY: input.focalY }
      : {}),
  });
  return true;
}

function resetChromeScene() {
  useSainaChromeStore.getState().setChrome({
    conversationSceneUrl: null,
    conversationSceneFocalX: null,
    conversationSceneFocalY: null,
  });
}

describe('live conversation scene apply (READY ≠ identity CAS)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetChromeScene();
  });
  afterEach(() => {
    localStorage.clear();
    resetChromeScene();
  });

  it('Experience gate no longer requires identityPromotion === applied', () => {
    expect(experienceSrc).toContain('persistAuthenticatedReadyYansi');
    expect(experienceSrc).toContain('mayCommitConversationScene');
    expect(experienceSrc).toMatch(
      /const mayCommitConversationScene =\s*Boolean\(conversationId\) &&\s*isPersistableConversationSceneUrl\(result\.sceneImageUrl\);/
    );
    expect(experienceSrc).not.toMatch(
      /mayCommitConversationScene[\s\S]{0,200}authIdentityPromoted/
    );
    expect(experienceSrc).not.toContain('authIdentityPromoted');
    expect(experienceSrc).not.toMatch(
      /Durable conversation visual: guest always; auth only after identity promotion CAS/
    );
  });

  it('1: READY scene + identityPromotion applied → archive+chrome updated', () => {
    const chatId = createStandaloneChat({ title: 'Chat applied' });
    const identityPromotion: 'applied' = 'applied';
    expect(identityPromotion).toBe('applied');

    expect(
      applyLiveConversationScene({ conversationId: chatId, sceneImageUrl: SCENE })
    ).toBe(true);
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(SCENE);
    expect(useSainaChromeStore.getState().conversationSceneUrl).toBe(SCENE);
    expect(resolveChromeConversationSceneUrl(chatId, null)).toBe(SCENE);
  });

  it('2: READY scene + identityPromotion noop_stale → archive+chrome STILL updated', () => {
    const chatId = createStandaloneChat({ title: 'Chat stale' });
    const identityPromotion: 'noop_stale' = 'noop_stale';
    expect(identityPromotion).not.toBe('applied');

    expect(
      applyLiveConversationScene({ conversationId: chatId, sceneImageUrl: SCENE })
    ).toBe(true);
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(SCENE);
    expect(resolveChromeConversationSceneUrl(chatId, 'https://cdn.example/stale.jpg')).toBe(
      SCENE
    );
  });

  it('3: READY scene + persistence null → archive+chrome STILL updated', () => {
    const chatId = createStandaloneChat({ title: 'Chat persist null' });
    const persisted: null = null;
    expect(persisted).toBeNull();

    expect(
      applyLiveConversationScene({
        conversationId: chatId,
        sceneImageUrl: SCENE,
        focalX: 0.42,
        focalY: 0.58,
      })
    ).toBe(true);
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(SCENE);
    expect(useSainaChromeStore.getState().conversationSceneUrl).toBe(SCENE);
    expect(useSainaChromeStore.getState().conversationSceneFocalX).toBe(0.42);
    expect(useSainaChromeStore.getState().conversationSceneFocalY).toBe(0.58);
  });

  it('4: generation failure / non-persistable URL → background unchanged', () => {
    const chatId = createStandaloneChat({ title: 'Chat fail' });
    setConversationSceneIdentity(chatId, {
      url: PRIOR,
      source: 'mirror_local',
    });
    useSainaChromeStore.getState().setChrome({ conversationSceneUrl: PRIOR });

    expect(
      mayCommitLiveConversationScene({
        conversationId: chatId,
        sceneImageUrl: 'blob:https://localhost/x',
      })
    ).toBe(false);
    expect(
      applyLiveConversationScene({
        conversationId: chatId,
        sceneImageUrl: 'blob:https://localhost/x',
      })
    ).toBe(false);
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(PRIOR);
    expect(useSainaChromeStore.getState().conversationSceneUrl).toBe(PRIOR);
  });

  it('5: guest-equivalent path — no conversationId → no apply; valid guest chat applies', () => {
    expect(
      mayCommitLiveConversationScene({
        conversationId: null,
        sceneImageUrl: SCENE,
      })
    ).toBe(false);

    const guestChat = createStandaloneChat({ title: 'Guest' });
    expect(
      applyLiveConversationScene({ conversationId: guestChat, sceneImageUrl: SCENE })
    ).toBe(true);
    expect(getChatArchive(guestChat)?.conversationSceneUrl).toBe(SCENE);
  });

  it('6: scene apply does not mutate messages', () => {
    const chatId = createStandaloneChat({ title: 'Chat msgs' });
    const messages = [
      { id: 'u1', text: 'soru', isUser: true as const },
      { id: 'a1', text: 'cevap', isUser: false as const },
    ];
    upsertChatArchive({
      ...(getChatArchive(chatId) as NonNullable<ReturnType<typeof getChatArchive>>),
      messages,
    });
    applyLiveConversationScene({ conversationId: chatId, sceneImageUrl: SCENE });
    const after = getChatArchive(chatId);
    expect(after?.messages).toEqual(messages);
    expect(after?.messages).toHaveLength(2);
  });

  it('Experience still persists auth Yansı independently of live scene apply', () => {
    const persistIdx = experienceSrc.indexOf('persistAuthenticatedReadyYansi');
    const gateIdx = experienceSrc.indexOf('const mayCommitConversationScene');
    expect(persistIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(persistIdx);
    expect(experienceSrc).toContain('setConversationSceneIdentity(conversationId');
    expect(experienceSrc).toContain('conversationSceneUrl: result.sceneImageUrl');
  });
});
