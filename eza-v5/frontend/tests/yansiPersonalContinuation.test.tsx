import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import YansiPersonalReplayHistory from '@/components/mirror-landing/YansiPersonalReplayHistory';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import { startMirrorGuestChat } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { getChatArchive, saveStandaloneChat } from '@/lib/standaloneChatArchive';
import { bootstrapServerConversations, fetchServerConversationDetail, resetServerConversationStoreForTests } from '@/lib/eza/serverConversationStore';
import type { PublicReplayContext } from '@/lib/eza/mirror-network/publicReplayContinuation';
import { SAINA_MENU_GUEST_LABEL } from '@/lib/eza/sainaCopy';
import { parsePublicReplayContext, publicReplayMessages } from '@/lib/eza/mirror-network/publicReplayContinuation';
import { readYansiReading, writeYansiReading } from '@/lib/eza/mirror/yansiReadingPreferences';
import SainaComposer from '@/components/saina/SainaComposer';

const mocks = vi.hoisted(() => ({ auth: false, compact: true, list: vi.fn(), detail: vi.fn() }));
vi.mock('@/hooks/useSainaMinWidth', () => ({ useSainaCompactShell: () => mocks.compact }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: mocks.auth, isAuthReady: true, logout: vi.fn(),
  user: mocks.auth ? { user_id: 'self', email: 'self@example.test', public_display_name: 'Mevcut kullanıcı', public_avatar_url: 'https://cdn.example/self.jpg' } : null }) }));
vi.mock('@/context/OrganizationContext', () => ({ useOrganization: () => ({ currentOrganization: null }) }));
vi.mock('@/lib/eza/plan/usePlan', () => ({ usePlan: () => ({ isPlus: false, isLoading: false, source: 'anonymous', refreshPlan: vi.fn() }) }));
vi.mock('@/components/standalone/StandaloneObservationExperience', () => ({ default: () => <div /> }));
vi.mock('@/lib/eza/mirror/journey/resolvePublicAuthorDisplay', () => ({ resolvePublicAuthorIdentity: vi.fn(async () => ({
  displayName: 'Public yayıncı', publicHonorific: 'curious', publicAvatarUrl: 'https://cdn.example/publisher.jpg', publicAvatarRevision: 1,
})) }));
vi.mock('@/lib/eza/standaloneConversationsApi', async (original) => ({
  ...await original<typeof import('@/lib/eza/standaloneConversationsApi')>(),
  listServerConversations: mocks.list, getServerConversation: mocks.detail,
}));

function context(count: number): PublicReplayContext {
  return { slug: 'source', journeyVersion: 3, completedStepCount: count, publicTitle: 'Karakter değişimi', authorUserId: 'publisher',
    steps: Array.from({ length: count }, (_, i) => ({ stepIndex: i + 1, publicQuestion: `Kaynak soru ${i + 1}?`, publicAnswer: `Kaynak cevap ${i + 1}.` })) };
}
function session(count: number) {
  return { sessionId: 'session', guestToken: 'guest-token-abcdefghijklmnop', mirrorSlug: 'source', cardTitle: 'Karakter değişimi',
    openingMessage: 'Eski açılış', thoughtCards: [], expiresAt: '2030-01-01T00:00:00Z', parentMirrorId: 'source', rootMirrorId: 'source',
    seedTopic: 'Karakter', seedCategory: 'topic', seedMood: 'curious', publicReplayContext: context(count) };
}
const shellProps = { heroTitle: 'Kendi sorum', isEmpty: false, messages: <div />, composer: <div />, conversations: [], activeChatId: 'personal',
  safeOnlyMode: false, onSafeOnlyModeChange: vi.fn(), analysisModelId: 'openai/gpt-4o-mini', onAnalysisModelChange: vi.fn() };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); mocks.auth = false; mocks.compact = true; vi.clearAllMocks(); resetServerConversationStoreForTests(); });

describe('personal continuation public prefix', () => {
  it.each([1, 3, 4, 8])('keeps %s experienced pairs separate across autosave and reopening', (count) => {
    const created = startMirrorGuestChat({ session: session(count), firstUserMessage: 'Kendi sorum' })!;
    expect(getChatArchive(created.chatId)?.messages).toEqual([]);
    saveStandaloneChat(created.chatId, [{ id: 'personal-u1', text: 'Kendi sorum', isUser: true }]);
    const reopened = getChatArchive(created.chatId)!;
    expect(reopened.messages).toHaveLength(1);
    expect(reopened.messageCount).toBe(1);
    expect(reopened.publicReplayContext?.steps).toHaveLength(count);
    render(<YansiPersonalReplayHistory context={reopened.publicReplayContext!} />);
    const history = screen.getByTestId('yansi-personal-public-history');
    expect(within(history).getByText(`Kaynak cevap ${count}.`)).toBeInTheDocument();
    expect(within(history).queryByText(`Kaynak soru ${count + 1}?`)).not.toBeInTheDocument();
    expect(within(history).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('separator')).toHaveTextContent('Buradan sonrası senin sohbetin');
  });

  it('renders normal personal layout with one composer and no editorial controls while retaining device preference', async () => {
    writeYansiReading({ mode: 'editorial', fontSize: 24, spacing: 'roomy' });
    render(<SainaStandaloneShell {...shellProps} embedded publicReplayContext={context(3)}
      messages={<><YansiPersonalReplayHistory context={context(3)} /><p>Kendi sorum</p></>}
      composer={<SainaComposer onSend={vi.fn()} isLoading={false} />} />);
    await screen.findByTestId('yansi-personal-source-avatar');
    expect(screen.getAllByTestId('saina-composer')).toHaveLength(1);
    expect(screen.getByTestId('yansi-personal-public-history').querySelector('.yansi-editorial-answer')).toBeNull();
    expect(document.querySelector('.yansi-public-reading, [data-reading-mode="editorial"], .yansi-exp-rail')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Okuma ayarları' })).toBeNull();
    expect(readYansiReading()).toMatchObject({ mode: 'editorial', fontSize: 24 });
    expect(screen.getByRole('separator')).toHaveTextContent('Buradan sonrası senin sohbetin');
  });

  it('drops publisher analysis, private IDs and editorial decoration from the canonical continuation prefix', () => {
    const source = context(3);
    const parsed = parsePublicReplayContext({ ...source, ezaSnapshot: { userScore: 92 }, editorial: { displayNumber: '01' },
      steps: source.steps.map((step) => ({ ...step, privateMessageId: 'secret', intent: 'private', ezaSnapshot: { assistantScore: 99 } })) })!;
    expect(parsed).toEqual(source);
    expect(publicReplayMessages(parsed)).toHaveLength(6);
    expect(publicReplayMessages(parsed)[0].text).toBe(source.steps[0].publicQuestion);
    expect(JSON.stringify(parsed)).not.toMatch(/ezaSnapshot|Score|privateMessageId|intent|displayNumber/);
  });

  it.each([false, true])('keeps current-user primary identity and public source secondary (auth=%s)', async (authenticated) => {
    mocks.auth = authenticated;
    render(<SainaStandaloneShell {...shellProps} publicReplayContext={context(4)} embedded />);
    expect(screen.getByTestId('saina-yansi-identity-name')).toHaveTextContent(authenticated ? 'Mevcut kullanıcı' : SAINA_MENU_GUEST_LABEL);
    const secondary = await screen.findByTestId('yansi-personal-source-avatar');
    await waitFor(() => expect(within(secondary).getByTestId('bilign-profile-avatar-photo')).toHaveAttribute('src', expect.stringContaining('publisher.jpg')));
    expect(secondary).toHaveAttribute('href', '/m/source');
    expect(secondary.closest('.bilign-yansi-identity__mark')).toBeNull();
    expect(secondary.querySelector('.yansi-personal-source-face')).toBeTruthy();
    expect(screen.getByTestId('yansi-personal-source-link')).toHaveTextContent('Karakter değişimi · Public yayıncı');
    if (authenticated) {
      const primary = screen.getByTestId('saina-yansi-identity').querySelector('.bilign-yansi-identity__avatar')!;
      expect(primary.querySelector('img')).toHaveAttribute('src', expect.stringContaining('self.jpg'));
    }
  });

  it('keeps a compact source group on mobile, absent on normal chat', () => {
    mocks.compact = false;
    const { rerender } = render(<SainaStandaloneShell {...shellProps} publicReplayContext={context(4)} embedded />);
    expect(screen.getByTestId('yansi-personal-source-avatar').closest('.yansi-personal-source-group')).toBeInTheDocument();
    mocks.compact = true; rerender(<SainaStandaloneShell {...shellProps} embedded />);
    expect(screen.queryByTestId('yansi-personal-source-avatar')).not.toBeInTheDocument();
  });

  it.each([false, true])('sizes the actual source face to 34px outside the primary avatar (desktop=%s)', async (desktop) => {
    mocks.compact = desktop;
    const css = readFileSync(resolve('styles/yansi-reel-responsive.css'), 'utf8');
    const sourceCss = css.split('/* Personal continuation:')[1].split('/* Desktop replay:')[0];
    const style = document.createElement('style'); style.textContent = '/* Personal continuation:' + sourceCss; document.head.append(style);
    try {
      render(<SainaStandaloneShell {...shellProps} publicReplayContext={context(3)} embedded />);
      const source = await screen.findByTestId('yansi-personal-source-avatar');
      const face = source.querySelector('.yansi-personal-source-face')!;
      expect(getComputedStyle(face).width).toBe('34px'); expect(getComputedStyle(face).height).toBe('34px');
      expect(getComputedStyle(source).position).toBe('static');
      expect(source.closest('.bilign-yansi-identity__mark')).toBeNull();
      expect(screen.getByTestId('yansi-personal-source-link').closest('.yansi-personal-source-group')).toBe(source.parentElement);
    } finally { style.remove(); }
  });
  it('restores source context from server detail after local cache loss', async () => {
    const item = { id: 'server-id', clientConversationId: 'personal', title: 'Kendi sorum', conversationType: 'continuation', sourceYansiSlug: 'source',
      messageCount: 1, createdAt: '2026-10-10T00:00:00Z', archived: false, pinned: false, titlePinned: false };
    mocks.list.mockResolvedValue([item]);
    mocks.detail.mockResolvedValue({ ...item, publicReplayContext: context(4), messages: [{ clientMessageId: 'u1', role: 'user', content: 'Kendi sorum', sequence: 1, createdAt: item.createdAt }] });
    await bootstrapServerConversations('self');
    const reopened = await fetchServerConversationDetail('personal');
    expect(reopened?.publicReplayContext?.steps).toHaveLength(4);
    expect(reopened?.treeMetadata?.startedFromMirrorId).toBe('source');
    expect(reopened?.treeMetadata?.sourceType).toBe('mirror');
    expect(reopened?.messages).toHaveLength(1);
    expect(getChatArchive('personal')?.publicReplayContext).toEqual(context(4));
  });

  it('does not hand off when the source archive cannot be saved', () => {
    const originalWrite = localStorage.setItem.bind(localStorage);
    const storageWrite = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'eza_standalone_chat_archive_scoped_v1') throw new Error('quota');
      originalWrite(key, value);
    });
    try {
      expect(startMirrorGuestChat({ session: session(4), firstUserMessage: 'Kendi sorum' })).toBeNull();
    } finally { storageWrite.mockRestore(); }
  });
});
