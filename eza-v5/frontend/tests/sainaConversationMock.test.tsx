import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_SAINA_CONVERSATION_SCENE,
  SAINA_CHAT_COLUMN_WIDTH,
  SAINA_COLORS,
  SAINA_SEARCH_MAX_WIDTH,
} from '@/lib/eza/sainaSkin';
import {
  SAINA_BRAND,
  SAINA_CHECKLIST,
  SAINA_TAGLINE,
  SAINA_CHIPS_TOGGLE,
  SAINA_CONCEPT_FEELING_TITLE,
  SAINA_CONCEPT_NEXT_TITLE,
  SAINA_CREATE_MIRROR,
  SAINA_HERO_DEFAULT_TITLE,
  SAINA_HERO_PILL,
  SAINA_HERO_META_DURATION,
  SAINA_HERO_META_START,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_EXPAND_LABEL,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_MIRROR_HOW_LABEL,
  SAINA_MIRROR_TITLE,
  SAINA_OPEN_PREVIEW,
  SAINA_LOGGEDIN_FREE_CTA,
  SAINA_FREE_TITLE,
  SAINA_PLAN_ACTIVE,
  SAINA_PREMIUM_MIRROR_LABEL,
  SAINA_PREMIUM_OBSERVING,
  SAINA_PREMIUM_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaConversationMain, {
  SAINA_SAMPLE_MESSAGES,
} from '@/components/saina/SainaConversationMain';
import ConversationMirrorPanel from '@/components/saina/ConversationMirrorPanel';
import SainaConversationMockPage from '@/app/dev/saina-conversation/page';

describe('sainaConversationMock (Sprint A / A.8 alignment)', () => {
  it('exposes chat column width and scene glass tokens', () => {
    expect(DEFAULT_SAINA_CONVERSATION_SCENE).toBe('/saina/default-conversation-scene.png');
    expect(SAINA_CHAT_COLUMN_WIDTH).toBe('min(68vw, 860px)');
    expect(SAINA_SEARCH_MAX_WIDTH).toBe('440px');
    expect(SAINA_COLORS.sceneGlass).toBe('rgba(246,244,239,0.42)');
    expect(SAINA_COLORS.chatColumnWidth).toBe(SAINA_CHAT_COLUMN_WIDTH);
    expect(SAINA_COLORS.searchMaxWidth).toBe(SAINA_SEARCH_MAX_WIDTH);
  });

  it('exposes core mock copy', () => {
    expect(SAINA_BRAND).toBe('SAINA');
    expect(SAINA_MIRROR_TITLE).toBe('Conversation Mirror');
    expect(SAINA_CREATE_MIRROR).toBe('Ayna Oluştur');
    expect(SAINA_CHIPS_TOGGLE).toBe('Öneriler →');
    expect(SAINA_MIRROR_EXPAND_TAB).toBe('✦ Ayna');
    expect(SAINA_CHECKLIST).toHaveLength(4);
    expect(SAINA_SAMPLE_MESSAGES).toHaveLength(3);
  });

  it('renders simplified hero with title only', () => {
    render(<SainaConversationMain />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(SAINA_HERO_DEFAULT_TITLE);
    expect(screen.queryByText(SAINA_HERO_PILL)).not.toBeInTheDocument();
    expect(screen.queryByText(SAINA_HERO_META_START)).not.toBeInTheDocument();
    expect(screen.queryByText(SAINA_HERO_META_DURATION)).not.toBeInTheDocument();
    expect(screen.queryByText(/Başlangıç:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Süre:/)).not.toBeInTheDocument();
  });

  it('starts empty: composer visible, chat card hidden until send', () => {
    const { container } = render(<SainaConversationMain />);

    expect(screen.getByTestId('saina-main-body')).toBeInTheDocument();
    expect(screen.getByTestId('saina-chat-column')).toBeInTheDocument();
    expect(container.querySelector('.saina-top-bar-inner')).toBeTruthy();
    expect(screen.queryByTestId('saina-chat-card')).not.toBeInTheDocument();
    expect(container.querySelector('.saina-composer-box')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Ara' })).toBeInTheDocument();
    expect(screen.getByTestId('saina-chips-toggle')).toHaveTextContent(SAINA_CHIPS_TOGGLE);
    expect(screen.queryByText(SAINA_SAMPLE_MESSAGES[0].text)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mesaj yaz'), {
      target: { value: 'Merhaba SAINA' },
    });
    fireEvent.click(screen.getByTestId('saina-send-btn'));

    expect(screen.getByTestId('saina-chat-card')).toBeInTheDocument();
    expect(screen.getByText('Merhaba SAINA')).toBeInTheDocument();
  });

  it('renders user messages on the right and SAINA on the left in sample state', () => {
    const { container } = render(<SainaConversationMain initialShowSampleMessages />);

    const userRow = container.querySelector('.saina-msg-row--user');
    const aiRow = container.querySelector('.saina-msg-row--ai');

    expect(userRow).toBeTruthy();
    expect(aiRow).toBeTruthy();
    expect(within(userRow as HTMLElement).getByText(SAINA_SAMPLE_MESSAGES[0].text)).toBeInTheDocument();
    expect(within(aiRow as HTMLElement).getByText(SAINA_SAMPLE_MESSAGES[1].text)).toBeInTheDocument();
  });

  it('renders dark sidebar without concept footer on page', () => {
    render(<SainaConversationSidebar interactionsDisabled />);
    expect(screen.getByText('Yeni Sohbet')).toBeInTheDocument();
    expect(screen.getByText(SAINA_PREMIUM_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(SAINA_TAGLINE)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sohbet listesini daralt')).not.toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();

    render(<SainaConversationMockPage />);
    expect(screen.queryByText(SAINA_CONCEPT_FEELING_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText(SAINA_CONCEPT_NEXT_TITLE)).not.toBeInTheDocument();
  });

  it('renders free plan card without quota when planTier is free', () => {
    render(<SainaConversationSidebar planTier="free" interactionsDisabled />);

    expect(screen.getByText(SAINA_FREE_TITLE)).toBeInTheDocument();
    expect(screen.getByText(SAINA_LOGGEDIN_FREE_CTA)).toBeInTheDocument();
    expect(screen.getByText(SAINA_PLAN_ACTIVE)).toBeInTheDocument();
    expect(screen.queryByText(SAINA_PREMIUM_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();
  });

  it('renders premium plan card without quota by default', () => {
    render(<SainaConversationSidebar interactionsDisabled />);

    expect(screen.getByText(SAINA_PREMIUM_TITLE)).toBeInTheDocument();
    expect(screen.getByText(SAINA_PREMIUM_OBSERVING)).toBeInTheDocument();
    expect(screen.getByText(SAINA_PREMIUM_MIRROR_LABEL)).toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();
  });

  it('renders default scene overlays with bundled image layer', () => {
    const { container } = render(<SainaCinematicScene />);
    const layer = screen.getByTestId('saina-scene-image-layer');
    expect(layer).toBeInTheDocument();
    expect(layer.className).toContain('saina-canvas-scene-image--bundled');
    expect((layer as HTMLElement).style.backgroundImage).toMatch(/url\(/);
    expect(container.querySelector('.saina-canvas-overlay--pattern-dim')).toBeTruthy();
    expect(screen.getByTestId('saina-scene-live')).toBeInTheDocument();
    expect(container.querySelector('.saina-scene-live__glow')).toBeTruthy();
    expect(container.querySelector('.saina-scene-live__river')).toBeTruthy();
    expect(container.querySelector('.saina-scene-live__stars')).toBeTruthy();
  });

  it('shows premium mirror expand tab when panel is collapsed', () => {
    render(<SainaConversationMockPage />);
    fireEvent.click(screen.getByRole('button', { name: SAINA_MIRROR_COLLAPSE_LABEL }));
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL)).toBeInTheDocument();
    expect(screen.getByText(SAINA_MIRROR_EXPAND_TAB)).toBeInTheDocument();
  });

  it('preserves create mirror → modal flow', async () => {
    vi.useFakeTimers();
    render(<ConversationMirrorPanel showCollapse onCollapse={vi.fn()} />);

    expect(screen.getByText(SAINA_MIRROR_HOW_LABEL)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: SAINA_CREATE_MIRROR }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    fireEvent.click(screen.getByRole('button', { name: SAINA_OPEN_PREVIEW }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
