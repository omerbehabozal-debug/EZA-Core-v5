import { describe, expect, it, vi } from 'vitest';

vi.mock('@/context/OrganizationContext', () => ({
  useOrganization: () => ({ currentOrganization: null }),
}));

vi.mock('@/components/standalone/StandaloneObservationExperience', () => ({
  default: ({ createButtonLabel }: { createButtonLabel?: string }) => (
    <div data-testid="saina-mirror-experience-stub">
      <button type="button">{createButtonLabel ?? 'Ayna Oluştur'}</button>
    </div>
  ),
}));
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  SAINA_ANALYSIS_MODEL_LABEL,
  SAINA_ANON_FREE_NOTE,
  SAINA_ASSISTANT_LABEL,
  SAINA_BRAND,
  SAINA_COMPOSER_PLACEHOLDER,
  SAINA_CREATE_MIRROR,
  SAINA_HERO_DEFAULT_TITLE,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_EXPAND_LABEL,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE,
  SAINA_MOBILE_MIRROR_CTA_EMPTY,
  SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY,
  SAINA_POWERED,
  SAINA_PREMIUM_OBSERVING,
  SAINA_SAFE_MODE_LABEL,
  SAINA_TAGLINE,
  SAINA_USER_LABEL,
} from '@/lib/eza/sainaCopy';
import { DEFAULT_ANALYSIS_MODEL_ID, STANDALONE_ANALYSIS_MODELS } from '@/lib/standaloneModels';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import ChatBubble from '@/components/standalone/ChatBubble';
import MessageList from '@/components/standalone/MessageList';

describe('SainaStandaloneShell (Sprint B.2A)', () => {
  const baseProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div data-testid="messages-slot">messages</div>,
    composer: <div data-testid="composer-slot">composer</div>,
    conversations: [
      {
        id: 'chat-1',
        title: 'Özbekistan ge…',
        preview: 'İpek Yolu…',
        time: 'Az önce',
        thumbGradient: 'linear-gradient(135deg, #c47a3a, #8b5a2b, #3d2914)',
      },
    ],
    activeChatId: null as string | null,
    onNewChat: vi.fn(),
    onSelectChat: vi.fn(),
    onOpenPattern: vi.fn(),
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  it('renders SAINA sidebar branding without legacy EZA text or tagline', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    expect(screen.getByTestId('saina-standalone-shell')).toBeInTheDocument();
    expect(screen.getByTestId('saina-conversation-sidebar')).toBeInTheDocument();
    expect(screen.getByText(SAINA_BRAND)).toBeInTheDocument();
    expect(screen.getByText(SAINA_POWERED)).toBeInTheDocument();
    expect(screen.queryByText('EZA', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Standalone', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(SAINA_TAGLINE)).not.toBeInTheDocument();
    expect(screen.queryByText(/YOUR HUMAN-AI MIRROR/i)).not.toBeInTheDocument();
  });

  it('renders hero, composer, and no chat card when empty', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yeni Sohbet');
    expect(screen.getByTestId('composer-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-chat-card')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Ara' })).toBeInTheDocument();
  });

  it('starts with mirror collapsed and shows Ayna pill', () => {
    const { container } = render(<SainaStandaloneShell {...baseProps} />);

    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('saina-mirror-expand-pill')).getByText(SAINA_MIRROR_EXPAND_TAB)
    ).toBeInTheDocument();
    expect(container.querySelector('.saina-mirror-col--collapsed')).toBeTruthy();
    expect(container.querySelector('.saina-center-wrap--mirror-collapsed')).toBeTruthy();
  });

  it('opens mirror panel when expand pill is clicked', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    fireEvent.click(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL));
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
    expect(screen.getByTestId('saina-mirror-experience-stub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAINA_CREATE_MIRROR })).toBeInTheDocument();
    expect(screen.queryByTestId('saina-mirror-expand-pill')).not.toBeInTheDocument();
  });

  it('collapses mirror panel from open state', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    fireEvent.click(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL));
    fireEvent.click(screen.getByRole('button', { name: SAINA_MIRROR_COLLAPSE_LABEL }));
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
  });

  it('shows chat card when not empty', () => {
    render(<SainaStandaloneShell {...baseProps} isEmpty={false} />);

    expect(screen.getByTestId('saina-chat-card')).toBeInTheDocument();
    expect(screen.getByTestId('messages-slot')).toBeInTheDocument();
  });

  it('uses active chat title on hero', () => {
    render(<SainaStandaloneShell {...baseProps} heroTitle="Özbekistan Sohbeti" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Özbekistan Sohbeti');
  });

  it('wires new chat and archive select handlers', () => {
    const onNewChat = vi.fn();
    const onSelectChat = vi.fn();
    render(
      <SainaStandaloneShell
        {...baseProps}
        onNewChat={onNewChat}
        onSelectChat={onSelectChat}
        activeChatId="chat-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yeni sohbet' }));
    expect(onNewChat).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Özbekistan ge/ }));
    expect(onSelectChat).toHaveBeenCalledWith('chat-1');
  });
});

describe('SainaComposer (Sprint B.2A)', () => {
  it('renders SAINA placeholder without model selector', async () => {
    const { default: SainaComposer } = await import('@/components/saina/SainaComposer');
    const onSend = vi.fn();
    render(<SainaComposer onSend={onSend} isLoading={false} />);

    expect(screen.getByPlaceholderText(SAINA_COMPOSER_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByText(/Analiz edilen model/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('saina-send-btn')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Mesaj yaz'), {
      target: { value: 'Merhaba' },
    });
    fireEvent.click(screen.getByTestId('saina-send-btn'));
    expect(onSend).toHaveBeenCalledWith('Merhaba');
  });
});

describe('SainaStandaloneShell (Sprint B.2B)', () => {
  const settingsProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div data-testid="messages-slot">messages</div>,
    composer: <div data-testid="composer-slot">composer</div>,
    conversations: [],
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  it('opens profile menu with Güvenli Mod and Analiz Modeli', () => {
    render(<SainaStandaloneShell {...settingsProps} />);

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    expect(screen.getByTestId('saina-profile-menu')).toBeInTheDocument();
    expect(screen.getByText(SAINA_SAFE_MODE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(SAINA_ANALYSIS_MODEL_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(/Analiz edilen model/i)).not.toBeInTheDocument();
  });

  it('toggles safe-only mode from profile menu', () => {
    const onSafeOnlyModeChange = vi.fn();
    render(
      <SainaStandaloneShell {...settingsProps} onSafeOnlyModeChange={onSafeOnlyModeChange} />
    );

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('saina-safe-mode-toggle'));
    expect(onSafeOnlyModeChange).toHaveBeenCalledWith(true);
  });

  it('changes analysis model from profile menu', () => {
    const onAnalysisModelChange = vi.fn();
    const nextModel = STANDALONE_ANALYSIS_MODELS[1];
    render(
      <SainaStandaloneShell
        {...settingsProps}
        onAnalysisModelChange={onAnalysisModelChange}
      />
    );

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    fireEvent.click(screen.getByRole('option', { name: nextModel.label }));
    expect(onAnalysisModelChange).toHaveBeenCalledWith(nextModel.id);
  });

  it('keeps mirror collapsed by default', () => {
    const { container } = render(<SainaStandaloneShell {...settingsProps} />);
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(container.querySelector('.saina-mirror-col--collapsed')).toBeTruthy();
  });

  it('renders bundled background image layer', () => {
    const { container } = render(<SainaCinematicScene />);
    const layer = screen.getByTestId('saina-scene-image-layer');
    expect(layer).toBeInTheDocument();
    expect(layer.className).toContain('saina-canvas-scene-image--bundled');
    expect((layer as HTMLElement).style.backgroundImage).toMatch(/url\(/);
    expect(container.querySelector('.saina-canvas-overlay--pattern-dim')).toBeTruthy();
    expect(screen.getByTestId('saina-scene-live')).toBeInTheDocument();
    expect(screen.getByTestId('saina-scene-live-lamps')).toBeInTheDocument();
    expect(container.querySelectorAll('.saina-scene-live__lamp').length).toBe(8);
  });

  it('crossfades conversation identity scene over bundled default', async () => {
    const sceneUrl = 'https://cdn.example/conversation-scene.jpg';
    render(<SainaCinematicScene sceneImageUrl={sceneUrl} />);
    const identityLayer = await screen.findByTestId('saina-scene-identity-layer');
    expect(identityLayer).toBeInTheDocument();
    expect((identityLayer as HTMLElement).style.backgroundImage).toContain(sceneUrl);
    expect(identityLayer.className).toContain('saina-canvas-scene-image--identity-visible');
  });

  it('ignores non-persistable scene URLs', () => {
    render(<SainaCinematicScene sceneImageUrl="blob:https://localhost/scene" />);
    expect(screen.queryByTestId('saina-scene-identity-layer')).not.toBeInTheDocument();
  });
});

describe('MessageList / ChatBubble variant=saina (Sprint B.2B)', () => {
  it('renders user bubble without identity chrome and SAINA brand only on first assistant turn', () => {
    const { container } = render(
      <MessageList
        variant="saina"
        messages={[
          { id: '1', text: 'Merhaba', isUser: true },
          { id: '2', text: 'Selam', isUser: false },
          { id: '3', text: 'Devam', isUser: false },
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('saina-msg-user')).toBeInTheDocument();
    expect(screen.getAllByTestId('saina-msg-ai')).toHaveLength(2);
    expect(screen.queryByText(SAINA_USER_LABEL)).not.toBeInTheDocument();
    expect(screen.getAllByText(SAINA_ASSISTANT_LABEL)).toHaveLength(1);
    expect(screen.getAllByTestId('saina-msg-ai-header')).toHaveLength(1);
    expect(container.querySelector('.saina-msg-avatar')).toBeNull();
    expect(container.querySelector('.saina-msg-row--user')).toBeTruthy();
    expect(container.querySelector('.saina-msg-row--ai')).toBeTruthy();
    expect(screen.getByText('Merhaba')).toBeInTheDocument();
    expect(screen.getByText('Selam')).toBeInTheDocument();
    expect(screen.getByText('Devam')).toBeInTheDocument();
  });

  it('preserves safety badge and feedback in saina variant', () => {
    render(
      <ChatBubble
        variant="saina"
        message="Güvenli yanıt"
        isUser={false}
        safeOnlyMode
        safety="Safe"
        feedback={{
          eventId: 'evt-1',
          originalLabel: 'Safe',
          originalScore: 0.9,
        }}
        timestamp={new Date('2026-05-31T12:00:00')}
      />
    );

    expect(screen.getByText('Güvenli yanıt')).toBeInTheDocument();
    expect(screen.getByText('Safe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Geri bildirim/i })).toBeInTheDocument();
  });

  it('uses legacy layout by default', () => {
    const { container } = render(
      <MessageList
        messages={[{ id: '1', text: 'Legacy', isUser: true }]}
        isLoading={false}
      />
    );

    expect(container.querySelector('.saina-msg-row')).toBeNull();
    expect(screen.queryByTestId('saina-msg-user')).not.toBeInTheDocument();
  });
});

function mockSainaSidebarViewport(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('SainaStandaloneShell (Sprint B.2C responsive sidebar)', () => {
  const shellProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div>messages</div>,
    composer: <div>composer</div>,
    conversations: [],
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  it('hides hamburger and sidebar close on desktop layout', async () => {
    mockSainaSidebarViewport(true);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId('saina-mobile-menu-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('saina-sidebar-close-btn')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('saina-conversation-sidebar')).toBeInTheDocument();
  });

  it('shows hamburger on mobile layout below compact shell breakpoint', async () => {
    mockSainaSidebarViewport(false);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-menu-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('saina-sidebar-close-btn')).not.toBeInTheDocument();
  });

  it('shows close X when mobile drawer opens and closes on click', async () => {
    mockSainaSidebarViewport(false);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-menu-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-mobile-menu-btn'));
    expect(screen.getByTestId('saina-sidebar-close-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('saina-sidebar-close-btn'));
    expect(screen.queryByTestId('saina-sidebar-close-btn')).not.toBeInTheDocument();
  });

  it('shows sticky Ayna CTA above composer in mobile shell', async () => {
    mockSainaSidebarViewport(false);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-inline')).toBeInTheDocument();
      expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
      expect(screen.getByTestId('saina-chat-bottom-anchor')).toBeInTheDocument();
    });
    expect(screen.getByText(SAINA_MOBILE_MIRROR_CTA_EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobil görünüm' })).not.toBeInTheDocument();
  });

  it('opens inline mirror panel from mobile CTA without leaving chat', async () => {
    mockSainaSidebarViewport(false);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL));
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
    expect(screen.getByTestId('saina-chat-column')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-mobile-mirror-cta')).not.toBeInTheDocument();
  });
});

describe('SainaStandaloneShell (mobile Ayna CTA states)', () => {
  const shellProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div>messages</div>,
    composer: <div data-testid="composer-slot">composer</div>,
    conversations: [],
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  beforeEach(() => {
    mockSainaSidebarViewport(false);
  });

  it('shows empty CTA copy on fresh mobile chat', async () => {
    render(<SainaStandaloneShell {...shellProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-inline')).toHaveAttribute(
        'data-mirror-mobile-state',
        'empty'
      );
    });
    expect(screen.getByText(SAINA_MOBILE_MIRROR_CTA_EMPTY)).toBeInTheDocument();
  });

  it('updates CTA after first assistant response', async () => {
    render(
      <SainaStandaloneShell
        {...shellProps}
        isEmpty={false}
        mirrorMobileContext={{ hasAssistantResponse: true, hasMirrorSignal: false }}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-inline')).toHaveAttribute(
        'data-mirror-mobile-state',
        'after_first_response'
      );
    });
    expect(screen.getByText(SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE)).toBeInTheDocument();
  });

  it('shows signal-ready CTA with badge when mirror signal exists', async () => {
    render(
      <SainaStandaloneShell
        {...shellProps}
        isEmpty={false}
        mirrorMobileContext={{ hasAssistantResponse: true, hasMirrorSignal: true }}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-inline')).toHaveAttribute(
        'data-mirror-mobile-state',
        'signal_ready'
      );
    });
    expect(screen.getByText(SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY)).toBeInTheDocument();
    expect(screen.getByTestId('saina-mobile-mirror-cta-badge')).toBeInTheDocument();
  });

  it('restores CTA after inline panel collapse', async () => {
    render(<SainaStandaloneShell {...shellProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL));
    fireEvent.click(screen.getByRole('button', { name: SAINA_MIRROR_COLLAPSE_LABEL }));
    expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
  });

  it('keeps CTA in bottom anchor with long message list', async () => {
    const manyMessages = Array.from({ length: 14 }, (_, index) => ({
      id: `msg-${index}`,
      text: `Mesaj ${index + 1}`,
      isUser: index % 2 === 0,
    }));

    render(
      <SainaStandaloneShell
        {...shellProps}
        isEmpty={false}
        messages={
          <MessageList variant="saina" messages={manyMessages} isLoading={false} />
        }
        mirrorMobileContext={{ hasAssistantResponse: true, hasMirrorSignal: false }}
      />
    );

    const anchor = screen.getByTestId('saina-chat-bottom-anchor');
    expect(within(anchor).getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
    expect(within(anchor).getByTestId('composer-slot')).toBeInTheDocument();
    expect(screen.getByTestId('saina-chat-messages-scroll')).toBeInTheDocument();
  });

  it('blocks mobile CTA open when onRequestMirror returns false but keeps CTA visible', async () => {
    render(
      <SainaStandaloneShell
        {...shellProps}
        onRequestMirror={() => false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('saina-mobile-mirror-cta'));
    expect(screen.getByTestId('saina-mobile-mirror-cta')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-standalone-mirror-panel')).not.toBeInTheDocument();
  });

  it('hides mobile CTA rail on compact shell and shows desktop expand pill', async () => {
    mockSainaSidebarViewport(true);
    render(<SainaStandaloneShell {...shellProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId('saina-mobile-mirror-cta')).not.toBeInTheDocument();
      expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    });
  });
});

describe('SainaStandaloneShell (Sprint B.2D chat card growth)', () => {
  const shellProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: false,
    messages: (
      <MessageList
        variant="saina"
        messages={[
          { id: '1', text: 'Merhaba', isUser: true },
          { id: '2', text: 'Selam', isUser: false },
        ]}
        isLoading={false}
      />
    ),
    composer: <div data-testid="composer-slot">composer</div>,
    conversations: [],
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  it('hides chat card on empty conversation', () => {
    render(
      <SainaStandaloneShell
        {...shellProps}
        isEmpty
        messages={null}
      />
    );
    expect(screen.queryByTestId('saina-chat-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('composer-slot')).toBeInTheDocument();
  });

  it('shows compact growth card after first messages', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    const card = screen.getByTestId('saina-chat-card');
    const scroll = screen.getByTestId('saina-chat-messages-scroll');

    expect(card).toHaveClass('saina-chat-card--growth');
    expect(scroll).toHaveClass('saina-standalone-messages-scroll');
    expect(screen.getByText('Merhaba')).toBeInTheDocument();
    expect(screen.getByTestId('composer-slot')).toBeInTheDocument();
  });

  it('uses single scroll container for many messages', () => {
    const manyMessages = Array.from({ length: 12 }, (_, index) => ({
      id: `msg-${index}`,
      text: `Mesaj ${index + 1}`,
      isUser: index % 2 === 0,
    }));

    const { container } = render(
      <SainaStandaloneShell
        {...shellProps}
        messages={
          <MessageList variant="saina" messages={manyMessages} isLoading={false} />
        }
      />
    );

    expect(screen.getAllByTestId('saina-chat-messages-scroll')).toHaveLength(1);
    expect(container.querySelector('.saina-chat-messages--thread')).toBeNull();
    expect(container.querySelector('.saina-message-thread')).toBeTruthy();
  });
});

describe('SainaStandaloneShell (Sprint B.2E plan card)', () => {
  const shellProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div>messages</div>,
    composer: <div>composer</div>,
    conversations: [],
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  beforeEach(() => {
    mockSainaSidebarViewport(true);
  });

  it('does not render collapse control beside Sohbetlerim', () => {
    render(<SainaStandaloneShell {...shellProps} />);
    expect(screen.queryByLabelText('Sohbet listesini daralt')).not.toBeInTheDocument();
  });

  it('renders anonymous plan card for first-time visitors', () => {
    render(<SainaStandaloneShell {...shellProps} planTier="anonymous" />);

    expect(screen.getByText('SAINA Free')).toBeInTheDocument();
    expect(screen.getByText('Şimdi Premium Ol')).toBeInTheDocument();
    expect(screen.getByText(SAINA_ANON_FREE_NOTE)).toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();
  });

  it('renders logged-in free plan card when planTier is free', () => {
    render(<SainaStandaloneShell {...shellProps} planTier="free" />);

    expect(screen.getByText('SAINA Free')).toBeInTheDocument();
    expect(screen.getByText("Premium'a Geç")).toBeInTheDocument();
    expect(
      screen.getByText("Ayna ve İlişki Deseni Premium'da aktif."),
    ).toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();
  });

  it('renders premium plan card without quota when planTier is premium', () => {
    render(<SainaStandaloneShell {...shellProps} planTier="premium" />);

    expect(screen.getByText(/SAINA Premium Aktif/)).toBeInTheDocument();
    expect(screen.getByText(SAINA_PREMIUM_OBSERVING)).toBeInTheDocument();
    expect(screen.getAllByText('Ayna').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('İlişki Haritası').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Şimdi Premium Ol')).not.toBeInTheDocument();
    expect(screen.queryByText('Aylık Mirror Hakkı')).not.toBeInTheDocument();
    expect(screen.queryByText(/7 \/ 10/)).not.toBeInTheDocument();
  });

  it('renders loading plan card without misleading free tier', () => {
    render(<SainaStandaloneShell {...shellProps} planTier="loading" />);

    const planCard = screen.getByTestId('saina-plan-card');
    expect(planCard).toHaveAttribute('data-plan-tier', 'loading');
    expect(within(planCard).getByText('SAINA')).toBeInTheDocument();
    expect(within(planCard).getByText('Plan bilgisi kontrol ediliyor...')).toBeInTheDocument();
    expect(screen.queryByText('SAINA Free')).not.toBeInTheDocument();
    expect(screen.queryByText('Şimdi Premium Ol')).not.toBeInTheDocument();
  });

  it('renders session_invalid plan card with login CTA', () => {
    render(<SainaStandaloneShell {...shellProps} planTier="session_invalid" />);

    const planCard = screen.getByTestId('saina-plan-card');
    expect(planCard).toHaveAttribute('data-plan-tier', 'session_invalid');
    expect(within(planCard).getByText('SAINA')).toBeInTheDocument();
    expect(within(planCard).getByText('Oturum doğrulanamadı')).toBeInTheDocument();
    expect(within(planCard).getByText('Giriş yap')).toBeInTheDocument();
    expect(screen.queryByText('SAINA Free')).not.toBeInTheDocument();
    expect(screen.queryByText('Şimdi Premium Ol')).not.toBeInTheDocument();
  });

  it('blocks mirror open when onRequestMirror returns false', () => {
    const { container } = render(
      <SainaStandaloneShell
        {...shellProps}
        onRequestMirror={() => false}
      />,
    );

    fireEvent.click(screen.getByTestId('saina-mirror-expand-pill'));
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(container.querySelector('.saina-mirror-col--open')).toBeNull();
  });

  it('opens mirror panel when onRequestMirror returns true', () => {
    render(
      <SainaStandaloneShell
        {...shellProps}
        onRequestMirror={() => true}
      />,
    );

    fireEvent.click(screen.getByTestId('saina-mirror-expand-pill'));
    expect(screen.queryByTestId('saina-mirror-expand-pill')).not.toBeInTheDocument();
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
  });

  it('renders sidebar pattern nav with readable copy', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    expect(screen.getAllByText('İlişki Haritası').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Aç →')).toBeInTheDocument();
  });
});

describe('SainaStandaloneShell (Sprint B.2F command palette & notifications)', () => {
  const sampleConversations = [
    {
      id: 'chat-uz',
      title: 'Özbekistan Sohbeti',
      preview: 'İpek Yolu ve Semerkant üzerine…',
      time: 'Az önce',
      thumbGradient: 'linear-gradient(135deg, #c47a3a, #8b5a2b, #3d2914)',
    },
    {
      id: 'chat-bmw',
      title: 'BMW iX Sohbeti',
      preview: 'Elektrikli SUV karşılaştırması…',
      time: 'Dün',
      thumbGradient: 'linear-gradient(135deg, #4a5568, #2d3748, #1a202c)',
    },
  ];

  const shellProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div>messages</div>,
    composer: <div>composer</div>,
    conversations: sampleConversations,
    activeChatId: null as string | null,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
    onAnalysisModelChange: vi.fn(),
  };

  beforeEach(() => {
    mockSainaSidebarViewport(true);
  });

  it('opens command palette when top search is clicked', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    expect(screen.queryByTestId('saina-command-palette')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('saina-top-search-trigger'));
    expect(screen.getByTestId('saina-command-palette')).toBeInTheDocument();
  });

  it('opens command palette with Ctrl+K and Meta+K', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('saina-command-palette')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('saina-command-palette')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByTestId('saina-command-palette')).toBeInTheDocument();
  });

  it('closes command palette with Escape', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('saina-command-palette')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('saina-command-palette')).not.toBeInTheDocument();
  });

  it('filters conversations in command palette by title and preview', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.click(screen.getByTestId('saina-top-search-trigger'));
    const palette = screen.getByTestId('saina-command-palette');
    fireEvent.change(screen.getByTestId('saina-command-palette-input'), {
      target: { value: 'BMW' },
    });

    expect(within(palette).getByText('BMW iX Sohbeti')).toBeInTheDocument();
    expect(within(palette).queryByText('Özbekistan Sohbeti')).not.toBeInTheDocument();
  });

  it('calls onNewChat from command palette quick action', () => {
    const onNewChat = vi.fn();
    render(<SainaStandaloneShell {...shellProps} onNewChat={onNewChat} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.click(screen.getByTestId('saina-command-action-new-chat'));
    expect(onNewChat).toHaveBeenCalled();
    expect(screen.queryByTestId('saina-command-palette')).not.toBeInTheDocument();
  });

  it('opens mirror panel from command palette quick action', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.click(screen.getByTestId('saina-command-action-open-mirror'));
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-mirror-expand-pill')).not.toBeInTheDocument();
  });

  it('calls onSelectChat when a conversation result is chosen', () => {
    const onSelectChat = vi.fn();
    render(<SainaStandaloneShell {...shellProps} onSelectChat={onSelectChat} />);

    fireEvent.click(screen.getByTestId('saina-top-search-trigger'));
    fireEvent.click(screen.getByTestId('saina-command-chat-chat-uz'));
    expect(onSelectChat).toHaveBeenCalledWith('chat-uz');
  });

  it('opens notifications dropdown with empty state', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.click(screen.getByTestId('saina-notifications-trigger'));
    expect(screen.getByTestId('saina-notifications-panel')).toBeInTheDocument();
    expect(screen.getByTestId('saina-notifications-empty')).toBeInTheDocument();
    expect(screen.getByText('Henüz yeni bildirim yok.')).toBeInTheDocument();
  });

  it('still opens profile menu after top bar updates', () => {
    render(<SainaStandaloneShell {...shellProps} />);

    fireEvent.click(screen.getByTestId('saina-profile-menu-trigger'));
    expect(screen.getByTestId('saina-profile-menu')).toBeInTheDocument();
  });

  it('renders compact search field in top bar', () => {
    render(<SainaStandaloneShell {...shellProps} />);
    expect(screen.getByTestId('saina-top-search-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-mobile-search-btn')).not.toBeInTheDocument();
  });
});
