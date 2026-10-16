import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import YansiMobileAudioSheet from '@/components/mirror-landing/YansiMobileAudioSheet';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { resolvePublicAuthorIdentity, clearPublicAuthorDisplayCacheForTests } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { fetchAuthorPublishedYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import SainaDiscoverCard from '@/components/saina/SainaDiscoverCard';

const mocks = vi.hoisted(() => ({ create: vi.fn(), start: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/hooks/useSainaMinWidth', () => ({ useSainaCompactShell: () => false }));
vi.mock('@/lib/eza/mirror-network/createSohbetSession', () => ({ createMirrorSohbetSession: mocks.create, personalChatStartError: () => 'Sorun korundu' }));
vi.mock('@/lib/eza/mirror-network/mirrorGuestConversation', () => ({ startMirrorGuestChat: mocks.start, MIRROR_GUEST_CHAT_REPLY_PARAM: 'mirrorReply' }));
vi.mock('@/lib/eza/mirror-network/mirrorSohbetAnalytics', () => ({ trackSeedStart: vi.fn(), trackGuestConversationStarted: vi.fn() }));
vi.mock('@/lib/eza/mirror-network/fetchAuthorPublished', () => ({ fetchAuthorPublishedYansilar: vi.fn() }));
vi.mock('@/components/mirror-landing/YansiExposureRoot', () => ({ default: ({ children }: any) => children }));

const identity = { title: 'Public başlık', displayName: 'Yayıncı', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null };
const artifact = () => parsePublicFrozenJourneyArtifact({ slug: 'mobile-ux', journeyId: 'mobile-ux', journeyVersion: 2,
  publicTitle: 'Public başlık', authorUserId: 'publisher', selectedCount: 6, replayReady: true,
  steps: [1, 2, 3, 4, 5, 6].map((stepIndex) => ({ stepIndex, publicQuestion: `Soru ${stepIndex}?`, publicAnswer: 'Yayınlanmış cevap.' })) })!;
const mount = () => render(<YansiExperienceSessionProvider slug="mobile-ux"><MirrorFrozenReplay artifact={artifact()} desktopIdentity={identity} mobilePresentation /></YansiExperienceSessionProvider>);

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); clearPublicAuthorDisplayCacheForTests(); mocks.create.mockResolvedValue({ ok: false }); });

describe('mobile Yansı shared UX', () => {
  it('does not permanently cache a failed author identity lookup', async () => {
    vi.mocked(fetchAuthorPublishedYansilar).mockResolvedValueOnce({ ok: false, code: 'network_error' } as any)
      .mockResolvedValueOnce({ ok: true, data: { userId: 'publisher', displayName: 'Gerçek yayıncı', publicHonorific: 'bilgin', items: [], total: 0 } });
    await resolvePublicAuthorIdentity('publisher');
    expect((await resolvePublicAuthorIdentity('publisher')).displayName).toBe('Gerçek yayıncı');
    await resolvePublicAuthorIdentity('publisher');
    expect(fetchAuthorPublishedYansilar).toHaveBeenCalledTimes(2);
  });
  it('offers a real composer without leaving replay on focus, preserves failed-send draft', async () => {
    mount(); const input = screen.getByRole('textbox', { name: 'Mesaj yaz' });
    expect(input).toHaveAttribute('placeholder', 'Kendi merakınla devam et...');
    fireEvent.focus(input); expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Kendi sorum' } });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    await screen.findByRole('alert'); expect(input).toHaveValue('Kendi sorum');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mirror-frozen-replay-continue')).toBeNull();
  });
  it('uses the existing guarded handoff exactly once and keeps the first message', async () => {
    let finish!: (value: any) => void; mocks.create.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mocks.start.mockReturnValue({ chatId: 'personal' }); mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Mesaj yaz' }), { target: { value: 'İlk soru' } });
    fireEvent.click(screen.getByTestId('saina-send-btn')); fireEvent.click(screen.getByTestId('saina-send-btn'));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    finish({ ok: true, session: { mirrorSlug: 'mobile-ux', guestToken: 'guest' } });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ firstUserMessage: 'İlk soru' }));
  });
  it('marks the first frozen question as actionable and rejects rapid duplicate taps', () => {
    mount(); expect(screen.getByText('Yanıtı görmek için dokun')).toBeInTheDocument();
    const question = screen.getByTestId('mirror-frozen-replay-next-question');
    fireEvent.click(question); fireEvent.click(question);
    expect(screen.getAllByText('Soru 1?')).toHaveLength(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('shares reading mode, size and spacing through the existing mobile audio sheet', () => {
    function Host() { const [open, setOpen] = useState(true); return <YansiExperienceSessionProvider slug="mobile-settings"><YansiMobileAudioSheet open={open} onClose={() => setOpen(false)} /></YansiExperienceSessionProvider>; }
    render(<Host />); fireEvent.click(screen.getByRole('button', { name: 'Editoryal' }));
    expect(screen.getByRole('button', { name: 'Editoryal' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Yazıyı büyüt' }));
    expect(screen.getByRole('slider', { name: 'Yazı boyutu' })).toHaveValue('19');
    fireEvent.click(screen.getByTestId('yansi-mobile-audio-sheet-close')); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('uses a compact truthful fallback on image failure without restoring Discover save controls', () => {
    render(<SainaDiscoverCard item={{ slug: 'image-failure', title: 'Yansı', sceneImageUrl: '/failed.png', yansiCount: 0, journeyVersion: 2 }} />);
    fireEvent.error(screen.getByTestId('saina-discover-card-image'));
    expect(screen.getByTestId('saina-discover-card-image-failure')).toHaveAttribute('data-scene-state', 'error');
    expect(screen.queryByTestId('saina-save-image-failure')).toBeNull();
    fireEvent.click(screen.getByTestId('saina-discover-card-cta-image-failure'));
    expect(mocks.push).toHaveBeenCalledWith('/m/image-failure?journeyVersion=2');
  });
});
