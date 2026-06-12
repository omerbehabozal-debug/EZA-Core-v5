import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  SAINA_BRAND,
  SAINA_COMPOSER_PLACEHOLDER,
  SAINA_EMPTY_TITLE,
  SAINA_HERO_DEFAULT_TITLE,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_EXPAND_LABEL,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_POWERED,
  SAINA_TAGLINE,
} from '@/lib/eza/sainaCopy';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';

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

  it('starts with mirror collapsed and shows ✦ Ayna pill', () => {
    const { container } = render(<SainaStandaloneShell {...baseProps} />);

    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(screen.getByText(SAINA_MIRROR_EXPAND_TAB)).toBeInTheDocument();
    expect(container.querySelector('.saina-mirror-col--collapsed')).toBeTruthy();
    expect(container.querySelector('.saina-center-wrap--mirror-collapsed')).toBeTruthy();
  });

  it('opens mirror panel when expand pill is clicked', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    fireEvent.click(screen.getByLabelText(SAINA_MIRROR_EXPAND_LABEL));
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
    expect(screen.getByText(SAINA_EMPTY_TITLE)).toBeInTheDocument();
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
