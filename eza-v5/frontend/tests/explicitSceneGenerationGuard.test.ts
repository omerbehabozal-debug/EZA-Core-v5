/**
 * Explicit scene-generation contract — conversation updates must not regen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  shouldAutoGenerateMirrorScene,
  shouldHydrateExistingMirrorScene,
} from '@/lib/eza/mirror/shouldAutoGenerateMirrorScene';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);
const chatSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
  'utf8'
);
const streamSrc = readFileSync(join(process.cwd(), 'hooks/useStreamResponse.ts'), 'utf8');

describe('conversation updates never call Director / generate-scene', () => {
  it('chat message path does not import prepare or generate-scene APIs', () => {
    expect(chatSrc).not.toMatch(/prepareDirectorDraft/);
    expect(chatSrc).not.toMatch(/generateMirrorScene/);
    expect(streamSrc).not.toMatch(/prepareDirectorDraft/);
    expect(streamSrc).not.toMatch(/generateMirrorScene/);
  });

  it('new chat messages only refresh mirror entries, not scene generation', () => {
    expect(chatSrc).toContain('setConversationMirrorEntries');
    expect(chatSrc).toContain('buildConversationMirrorEntries(messages)');
    expect(chatSrc).not.toMatch(/handleGenerateMirrorScene|commitMirrorReady|runMirrorWithReveal/);
  });
});

describe('remount / mobile panel hydrate without regen', () => {
  it('hydrates existing persistable scene when auto is not armed', () => {
    expect(
      shouldHydrateExistingMirrorScene({
        allowAuto: false,
        existingPersistableSceneUrl: 'https://cdn.example/scene.jpg',
      })
    ).toBe(true);
    expect(
      shouldAutoGenerateMirrorScene({
        allowAuto: false,
        isAuthReady: true,
        canCreateVisual: true,
        dailyStatus: 'ready',
        sceneImageStatus: 'idle',
        hasVisualPrompt: true,
        autoKey: 'd:fp:0',
        sceneAutoKey: null,
        existingPersistableSceneUrl: 'https://cdn.example/scene.jpg',
      })
    ).toBe(false);
  });

  it('Experience restores archive/cache scene and disarms auto on hydrate', () => {
    expect(experienceSrc).toContain('shouldHydrateExistingMirrorScene');
    expect(experienceSrc).toContain('getChatArchive(conversationId)?.conversationSceneUrl');
    expect(experienceSrc).toMatch(
      /hydrateSceneFromCache[\s\S]*allowAutoSceneGenerationRef\.current = false/
    );
  });

  it('remount / conversationId reset does not wipe scene cache', () => {
    // React state may reset; localStorage scene must survive Discover → chat reopen.
    const remountEffect = experienceSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?\}, \[conversationId\]\);/
    )?.[0];
    expect(remountEffect).toBeTruthy();
    expect(remountEffect).not.toContain('clearMirrorSceneCacheForScope');
  });

  it('Keşfet remount keeps snapshot after scene success for hydrate CTA', () => {
    expect(experienceSrc).toContain('saveConversationMirrorSnapshot(conversationId, entries');
  });

  it('hydrates when archive/cache persists even if refresh CTA is open_first', () => {
    expect(experienceSrc).toContain('hasPersistedConversationMirror');
    expect(experienceSrc).toMatch(
      /refreshCta === 'open_first' && !persisted/
    );
  });

  it('chat unmount does not wipe conversation mirror entries to null', () => {
    const effectCleanup = chatSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?setConversationMirrorEntries\([\s\S]*?return \(\) => \{[\s\S]*?\};[\s\S]*?\}, \[messages, chatId/
    )?.[0];
    expect(effectCleanup).toBeTruthy();
    expect(effectCleanup).not.toMatch(
      /return \(\) => \{[\s\S]*setConversationMirrorEntries\(\[\], null\)/
    );
  });

  it('chat first paint hydrates from ?chat= archive to avoid empty Ayna flash', () => {
    expect(chatSrc).toContain('readChatStateFromUrl');
    expect(chatSrc).toContain('useState<string | null>(initialChat.chatId)');
  });
});

describe('explicit create clears previous chat background', () => {
  it('runMirrorWithReveal clears conversation scene identity and cache before reveal', () => {
    expect(experienceSrc).toContain('clearChatBackgroundScene');
    expect(experienceSrc).toContain('clearConversationSceneIdentity');
    expect(experienceSrc).toMatch(
      /runMirrorWithReveal[\s\S]*clearChatBackgroundScene\(conversationId\)[\s\S]*clearMirrorSceneCacheForScope\(conversationId\)/
    );
  });
});

describe('publish happens once after scene, not in commitMirrorReady', () => {
  it('commitMirrorReady does not publish before scene exists', () => {
    const commitIdx = experienceSrc.indexOf('const commitMirrorReady');
    const commitBlock = experienceSrc.slice(commitIdx, commitIdx + 2200);
    expect(commitBlock).toContain('Defer network publish until scene exists');
    expect(commitBlock).not.toMatch(/void prepareMirrorShareLink\(card\)/);
  });

  it('successful generate-scene path does not auto-publish (Yayınla is explicit)', () => {
    const genIdx = experienceSrc.indexOf('const handleGenerateMirrorScene');
    const genBlock = experienceSrc.slice(genIdx, genIdx + 12000);
    expect(genBlock).toContain('generateMirrorScene(visualForApi');
    expect(genBlock).toContain('Yayınla is explicit');
    expect(genBlock).not.toMatch(
      /prepareMirrorShareLink\(cardForScene,\s*result\.sceneImageUrl/
    );
  });
});

describe('explicit retry and new-scene re-arm generation', () => {
  it('retry arms allowAuto then calls generate', () => {
    expect(experienceSrc).toMatch(
      /handleRetryMirrorScene[\s\S]*allowAutoSceneGenerationRef\.current = true[\s\S]*handleGenerateMirrorScene\(\)/
    );
  });

  it('new-scene arms allowAuto then calls generate with next session and reuseMappedPrompt', () => {
    expect(experienceSrc).toMatch(
      /handleNewMirrorScene[\s\S]*allowAutoSceneGenerationRef\.current = true[\s\S]*handleGenerateMirrorScene\(nextSession,\s*\{\s*reuseMappedPrompt:\s*true\s*\}\)/
    );
  });
});

describe('Director card update does not mid-flight setState churn', () => {
  it('defers setGeneratedDailyCard until after generate-scene succeeds', () => {
    const genIdx = experienceSrc.indexOf('const handleGenerateMirrorScene');
    const genBlock = experienceSrc.slice(genIdx, genIdx + 12000);
    expect(genBlock).toContain('runFailClosedMirrorSceneGeneration');
    expect(genBlock).toContain('Defer React card update until after scene completes');
    const setCardIdx = genBlock.indexOf('setGeneratedDailyCard(cardForScene)');
    const generateIdx = genBlock.indexOf('generateMirrorScene(visualForApi');
    expect(setCardIdx).toBeGreaterThan(-1);
    expect(generateIdx).toBeGreaterThan(-1);
    // Card React update happens after generateMirrorScene call site
    expect(setCardIdx).toBeGreaterThan(generateIdx);
  });
});

describe('explicit-generation rule is mode-agnostic (LEGACY/SOFT/FULL)', () => {
  it('auto-gen gate does not branch on directorMode', () => {
    const gateSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/shouldAutoGenerateMirrorScene.ts'),
      'utf8'
    );
    expect(gateSrc).not.toMatch(/LEGACY|SOFT|FULL|SHADOW|directorMode/);
    expect(experienceSrc).toContain('shouldAutoGenerateMirrorScene');
  });
});
