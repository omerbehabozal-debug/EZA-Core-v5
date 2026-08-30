/**
 * Avatar consumer integration — header, chat hero, and Yansı creator stay in sync
 * when AuthContext avatar authority changes without remount.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '@/lib/eza/localIdentityScope';
import { clearEzaUserPreferencesForTests } from '@/lib/eza/ezaUserPrefs';
import SainaProfileMenu from '@/components/saina/SainaProfileMenu';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import { buildProfileAvatarDisplaySrc } from '@/lib/eza/profile/avatarDisplayUrl';
import { resolveSelfProfileAvatar } from '@/lib/eza/profile/resolveConsumerProfileAvatar';

const USER_ID = 'a681c910-0000-4000-8000-000000000001';
const OTHER_ID = 'b681c910-0000-4000-8000-000000000002';
const AVATAR_A = `/api/public/profile-avatars/${USER_ID}.jpg`;
const AVATAR_B = `/api/public/profile-avatars/${OTHER_ID}.jpg`;

const authMocks = vi.hoisted(() => ({
  validateAuthSession: vi.fn(),
}));

vi.mock('@/lib/eza/plan/fetchAuthMe', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/plan/fetchAuthMe')>(
    '@/lib/eza/plan/fetchAuthMe'
  );
  return {
    ...actual,
    validateAuthSession: authMocks.validateAuthSession,
    uploadPublicAvatar: vi.fn(),
    deletePublicAvatar: vi.fn(),
    patchPublicIdentity: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/standalone',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: () => ({
    plan: 'plus',
    isPlus: true,
    isFree: false,
    isLoading: false,
    source: 'server',
    setPlan: vi.fn(),
    refreshPlan: vi.fn(),
  }),
}));

vi.mock('@/lib/eza/plan/useAccountEntitlements', () => ({
  useAccountEntitlements: () => ({
    entitlements: { tier: 'premium' },
    isLoading: false,
    refreshEntitlements: vi.fn(),
  }),
}));

vi.mock('@/lib/eza/profile/normalizeProfileAvatarFile', () => ({
  normalizeProfileAvatarFile: vi.fn(async (file: File) => file),
  isAcceptedProfileAvatarFile: vi.fn(() => true),
}));

vi.mock('@/lib/eza/conversation-tree/mergeGuestConversationTree', () => ({
  mergeGuestConversationTree: vi.fn(async () => ({ ok: true })),
}));

function makeToken(): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: USER_ID })
  );
  return `header.${payload}.signature`;
}

function seedAuth(revision: number, url: string = AVATAR_A) {
  const user = {
    user_id: USER_ID,
    email: 'owner@example.com',
    role: 'user',
    public_display_name: 'Ada Lovelace',
    public_avatar_url: url,
    public_avatar_revision: revision,
    public_honorific: 'curious',
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, makeToken());
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  authMocks.validateAuthSession.mockResolvedValue({
    status: 'valid',
    session: { ...user, mirror_plan: 'plus' },
  });
}

function readImgSrc(testId: string): string | null {
  const root = screen.getByTestId(testId);
  const img = within(root).queryByTestId('bilign-profile-avatar-photo') as HTMLImageElement | null;
  return img?.getAttribute('src') ?? null;
}

function readHeaderImgSrc(): string | null {
  const trigger = screen.getByTestId('saina-profile-menu-trigger');
  const img = within(trigger).queryByTestId('bilign-profile-avatar-photo') as HTMLImageElement | null;
  return img?.getAttribute('src') ?? null;
}

function AuthPatchBridge({ onReady }: { onReady: (patch: (p: object) => void) => void }) {
  const { patchAuthUser } = useAuth();
  useEffect(() => {
    onReady(patchAuthUser);
  }, [onReady, patchAuthUser]);
  return null;
}

function AuthLinkedHero() {
  const { user } = useAuth();
  const heroAvatar = resolveSelfProfileAvatar(user);
  return (
    <SainaHeroScene
      title="Merak başlığı"
      displayName="Ada Lovelace"
      honorificId="curious"
      honorificLabel="Meraklı"
      userId={user?.user_id ?? null}
      avatarUrl={heroAvatar.url}
      avatarCacheBust={heroAvatar.revision}
    />
  );
}

function ConsumerHarness({
  onReady,
  staleSnapshotUrl,
}: {
  onReady: (patch: (p: object) => void) => void;
  staleSnapshotUrl?: string;
}) {
  return (
    <AuthProvider>
      <AuthPatchBridge onReady={onReady} />
      <div data-testid="header-avatar">
        <SainaProfileMenu
          safeOnlyMode={false}
          onSafeOnlyModeChange={vi.fn()}
          analysisModelId="gpt-4o-mini"
          onAnalysisModelChange={vi.fn()}
        />
      </div>
      <div data-testid="hero-avatar">
        <AuthLinkedHero />
      </div>
      <div data-testid="yansi-creator-avatar">
        <AynaAuthorRow
          displayName="Ada Lovelace"
          authorUserId={USER_ID}
          avatarUrl={staleSnapshotUrl ?? AVATAR_A}
          avatarRevision={4}
        />
      </div>
      <div data-testid="other-yansi-creator-avatar">
        <AynaAuthorRow
          displayName="Bob"
          authorUserId={OTHER_ID}
          avatarUrl={AVATAR_A}
          avatarRevision={4}
          publicAvatarUrl={AVATAR_B}
          publicAvatarRevision={2}
        />
      </div>
    </AuthProvider>
  );
}

describe('profile avatar consumer integration', () => {
  beforeEach(() => {
    clearEzaUserPreferencesForTests();
    localStorage.clear();
    authMocks.validateAuthSession.mockReset();
    seedAuth(4);
  });

  it('updates header, hero, and self Yansı creator to B?v=5 without remount', async () => {
    let patchAuthUser: ((patch: object) => void) | null = null;

    render(
      <ConsumerHarness
        onReady={(patch) => {
          patchAuthUser = patch;
        }}
        staleSnapshotUrl={AVATAR_A}
      />
    );

    await waitFor(() => {
      expect(readHeaderImgSrc()).toContain('v=4');
      expect(readImgSrc('hero-avatar')).toContain('v=4');
      expect(readImgSrc('yansi-creator-avatar')).toContain('v=4');
    });

    const expectedB = buildProfileAvatarDisplaySrc(AVATAR_A, 5);

    await act(async () => {
      patchAuthUser?.({
        public_avatar_url: AVATAR_A,
        public_avatar_revision: 5,
      });
    });

    await waitFor(() => {
      expect(readHeaderImgSrc()).toBe(expectedB);
      expect(readImgSrc('hero-avatar')).toBe(expectedB);
      expect(readImgSrc('yansi-creator-avatar')).toBe(expectedB);
      expect(readImgSrc('other-yansi-creator-avatar')).toBe(
        buildProfileAvatarDisplaySrc(AVATAR_B, 2)
      );
    });
  });
});
