import { describe, expect, it } from 'vitest';
import {
  shouldAutoGenerateMirrorScene,
  shouldHydrateExistingMirrorScene,
} from '@/lib/eza/mirror/shouldAutoGenerateMirrorScene';

describe('shouldAutoGenerateMirrorScene', () => {
  const base = {
    allowAuto: true,
    isAuthReady: true,
    canCreateVisual: true,
    dailyStatus: 'ready',
    sceneImageStatus: 'idle',
    hasVisualPrompt: true,
    autoKey: '2026-07-18:fp1:0',
    sceneAutoKey: null as string | null,
    existingPersistableSceneUrl: null as string | null,
  };

  it('allows first create when armed and idle', () => {
    expect(shouldAutoGenerateMirrorScene(base)).toBe(true);
  });

  it('blocks when allowAuto is false even if idle (remount / chat continue)', () => {
    expect(
      shouldAutoGenerateMirrorScene({
        ...base,
        allowAuto: false,
        existingPersistableSceneUrl: 'https://cdn.example/scene.jpg',
      })
    ).toBe(false);
  });

  it('blocks when scene already complete for autoKey', () => {
    expect(
      shouldAutoGenerateMirrorScene({
        ...base,
        sceneAutoKey: '2026-07-18:fp1:0:complete',
      })
    ).toBe(false);
  });

  it('blocks when not idle', () => {
    expect(
      shouldAutoGenerateMirrorScene({
        ...base,
        sceneImageStatus: 'ready',
      })
    ).toBe(false);
  });
});

describe('shouldHydrateExistingMirrorScene', () => {
  it('hydrates existing scene on remount without arming auto gen', () => {
    expect(
      shouldHydrateExistingMirrorScene({
        allowAuto: false,
        existingPersistableSceneUrl: 'https://cdn.example/scene.jpg',
      })
    ).toBe(true);
  });

  it('does not hydrate-as-skip when user armed a fresh create/update', () => {
    expect(
      shouldHydrateExistingMirrorScene({
        allowAuto: true,
        existingPersistableSceneUrl: 'https://cdn.example/old.jpg',
      })
    ).toBe(false);
  });
});
