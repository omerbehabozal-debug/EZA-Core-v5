/**
 * Slice 5 — Merakıma ekle / Meraklarım frontend tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  isAuthReady: true,
  user: { user_id: 'user-consumer' } as { user_id: string } | null,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/eza/mirror-network/yansiSaveApi', () => ({
  fetchYansiSaveState: vi.fn(async (slug: string) => ({
    ok: true as const,
    slug,
    saved: false,
  })),
  saveYansi: vi.fn(async (slug: string) => ({
    ok: true as const,
    status: 'saved',
    slug,
    saved: true,
  })),
  unsaveYansi: vi.fn(async (slug: string) => ({
    ok: true as const,
    status: 'removed',
    slug,
    saved: false,
  })),
  fetchMySavedYansilar: vi.fn(async () => ({
    ok: true as const,
    data: { items: [], total: 0, limit: 48, offset: 0 },
  })),
}));

import YansiSaveButton from '@/components/mirror-landing/YansiSaveButton';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import {
  clearYansiSaveStore,
  noteYansiSaveState,
  hydrateYansiSaveStore,
} from '@/lib/eza/mirror-network/yansiSaveStore';
import { saveYansi, fetchMySavedYansilar } from '@/lib/eza/mirror-network/yansiSaveApi';
import {
  YANSI_SAVE_ADD,
  YANSI_SAVE_REMOVE,
  YANSI_SAVE_SAVED,
  YANSI_SAVE_SECTION_TITLE,
  YANSI_SAVE_UNAVAILABLE,
} from '@/lib/eza/mirror/copy';

const root = join(process.cwd());

beforeEach(() => {
  clearYansiSaveStore();
  authState.isAuthenticated = true;
  authState.isAuthReady = true;
  authState.user = { user_id: 'user-consumer' };
  vi.mocked(saveYansi).mockClear();
  vi.mocked(fetchMySavedYansilar).mockResolvedValue({
    ok: true,
    data: { items: [], total: 0, limit: 48, offset: 0 },
  });
});

describe('Slice 5 YansiSaveButton', () => {
  it('shows Merakıma ekle for authenticated non-owner', async () => {
    render(<YansiSaveButton slug="yansi-b" authorUserId="author-other" />);
    await waitFor(() => {
      expect(screen.getByTestId('yansi-save-button')).toHaveTextContent(YANSI_SAVE_ADD);
    });
  });

  it('hides Save for own Yansı', () => {
    authState.user = { user_id: 'author-self' };
    render(<YansiSaveButton slug="yansi-b" authorUserId="author-self" />);
    expect(screen.queryByTestId('yansi-save-button')).toBeNull();
  });

  it('toggles to Meraklarımda after save', async () => {
    render(<YansiSaveButton slug="yansi-b" authorUserId="author-other" />);
    await waitFor(() => screen.getByTestId('yansi-save-button'));
    fireEvent.click(screen.getByTestId('yansi-save-button'));
    await waitFor(() => {
      expect(screen.getByTestId('yansi-save-button')).toHaveAttribute('data-saved', 'true');
      expect(screen.getByTestId('yansi-save-button')).toHaveTextContent(YANSI_SAVE_SAVED);
    });
    expect(saveYansi).toHaveBeenCalledWith('yansi-b');
  });

  it('follows active slug prop (B vs X)', async () => {
    const { rerender } = render(
      <YansiSaveButton slug="yansi-b" authorUserId="author-other" />
    );
    await waitFor(() => screen.getByTestId('yansi-save-button'));
    expect(screen.getByTestId('yansi-save-button')).toHaveAttribute('data-slug', 'yansi-b');
    rerender(<YansiSaveButton slug="yansi-x" authorUserId="author-other" />);
    await waitFor(() => {
      expect(screen.getByTestId('yansi-save-button')).toHaveAttribute('data-slug', 'yansi-x');
    });
  });

  it('stale save for B does not mark X saved', async () => {
    let resolveSave: ((value: unknown) => void) | null = null;
    vi.mocked(saveYansi).mockImplementation(
      (slug: string) =>
        new Promise((resolve) => {
          resolveSave = () =>
            resolve({ ok: true as const, status: 'saved', slug, saved: true });
        })
    );
    const { rerender } = render(
      <YansiSaveButton slug="yansi-b" authorUserId="author-other" />
    );
    await waitFor(() => screen.getByTestId('yansi-save-button'));
    fireEvent.click(screen.getByTestId('yansi-save-button'));
    rerender(<YansiSaveButton slug="yansi-x" authorUserId="author-other" />);
    await waitFor(() => {
      expect(screen.getByTestId('yansi-save-button')).toHaveAttribute('data-slug', 'yansi-x');
    });
    resolveSave?.(null);
    await waitFor(() => expect(saveYansi).toHaveBeenCalled());
    // X should remain unsaved in the button UI for current slug.
    expect(screen.getByTestId('yansi-save-button')).toHaveAttribute('data-slug', 'yansi-x');
    // After stale resolve, X button still shows add (not saved for X).
    await waitFor(() => {
      expect(screen.getByTestId('yansi-save-button')).toHaveTextContent(YANSI_SAVE_ADD);
    });
  });
});

describe('Slice 5 Meraklarım sidebar', () => {
  it('hides section when saved list empty', () => {
    render(
      <SainaConversationSidebar
        conversations={[]}
        onSelectChat={() => undefined}
      />
    );
    expect(screen.queryByTestId('saina-meraklarim-section')).toBeNull();
  });

  it('shows Meraklarım with saved row outside conversation groups', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            savedAt: new Date().toISOString(),
            availability: 'available',
            publicTitle: 'Title yansi-b',
            sceneImageUrl: 'https://cdn.example/b.jpg',
            authorDisplayName: 'Ada',
            authorUserId: 'author-other',
          },
        ],
        total: 1,
        limit: 48,
        offset: 0,
      },
    });
    await hydrateYansiSaveStore();
    render(
      <SainaConversationSidebar
        conversations={[
          {
            id: 'conv-1',
            kind: 'conversation',
            title: 'Sohbet',
            preview: 'p',
            time: 'şimdi',
            savedAt: new Date().toISOString(),
            thumbGradient: 'g',
          },
        ]}
        conversationGroups={[
          {
            id: 'g1',
            title: 'Grup',
            updatedAt: new Date().toISOString(),
            sortOrder: 0,
            conversations: [
              {
                id: 'conv-1',
                kind: 'conversation',
                title: 'Sohbet',
                preview: 'p',
                time: 'şimdi',
                savedAt: new Date().toISOString(),
                thumbGradient: 'g',
                isMirrorSource: false,
              },
            ],
          },
        ]}
        onSelectChat={() => undefined}
      />
    );
    expect(screen.getByTestId('saina-meraklarim-section')).toBeTruthy();
    expect(screen.getByTestId('saina-meraklarim-title')).toHaveTextContent(
      YANSI_SAVE_SECTION_TITLE
    );
    expect(screen.getByTestId('saina-saved-yansi-row-yansi-b')).toHaveAttribute(
      'data-sidebar-kind',
      'saved-yansi'
    );
    // Not nested inside the conversation group children as a conversation.
    expect(screen.getByTestId('saina-saved-yansi-row-yansi-b').closest('.saina-conv-group-children')).toBeNull();
  });

  it('saved menu only offers Meraklarımdan kaldır', async () => {
    noteYansiSaveState('yansi-b', true);
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            savedAt: new Date().toISOString(),
            availability: 'available',
            publicTitle: 'Title yansi-b',
          },
        ],
        total: 1,
        limit: 48,
        offset: 0,
      },
    });
    await hydrateYansiSaveStore();
    render(<SainaConversationSidebar conversations={[]} onSelectChat={() => undefined} />);
    fireEvent.click(screen.getByTestId('saina-saved-yansi-menu-yansi-b'));
    expect(screen.getByTestId('saina-saved-yansi-unsave-yansi-b')).toHaveTextContent(
      YANSI_SAVE_REMOVE
    );
    expect(screen.queryByText('Yayından kaldır')).toBeNull();
    expect(screen.queryByText('Sohbeti sil')).toBeNull();
  });

  it('unavailable row shows neutral copy and disables open', async () => {
    vi.mocked(fetchMySavedYansilar).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            slug: 'yansi-b',
            savedAt: new Date().toISOString(),
            availability: 'unavailable',
          },
        ],
        total: 1,
        limit: 48,
        offset: 0,
      },
    });
    await hydrateYansiSaveStore();
    render(<SainaConversationSidebar conversations={[]} onSelectChat={() => undefined} />);
    expect(screen.getByTestId('saina-saved-yansi-row-yansi-b')).toHaveTextContent(
      YANSI_SAVE_UNAVAILABLE
    );
    expect(screen.getByTestId('saina-saved-yansi-open-yansi-b')).toBeDisabled();
  });
});

describe('Slice 5 source contracts', () => {
  it('chain experience binds Save to active artifact slug', () => {
    const src = readFileSync(
      join(root, 'components/mirror-landing/MirrorYansiChainExperience.tsx'),
      'utf8'
    );
    expect(src).toContain('YansiSaveButton');
    expect(src).toContain('slug={activeNode.artifact.slug}');
    expect(src).toContain('authorUserId={activeNode.artifact.authorUserId}');
  });

  it('pending save intent uses sessionStorage only', () => {
    const src = readFileSync(
      join(root, 'lib/eza/mirror-network/yansiSavePendingIntent.ts'),
      'utf8'
    );
    expect(src).toContain('sessionStorage');
    expect(src).not.toContain('localStorage');
  });
});
