import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  SAINA_HERO_DEFAULT_TITLE,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_STANDALONE_MIRROR_PLACEHOLDER_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';

vi.mock('@/components/standalone/StandaloneSidebar', () => ({
  default: () => <aside data-testid="standalone-sidebar-mock">Sidebar</aside>,
}));

describe('SainaStandaloneShell (Sprint B.1)', () => {
  const baseProps = {
    heroTitle: SAINA_HERO_DEFAULT_TITLE,
    isEmpty: true,
    messages: <div data-testid="messages-slot">messages</div>,
    composer: <div data-testid="composer-slot">composer</div>,
    safeOnlyMode: false,
    onSafeOnlyModeChange: vi.fn(),
    hasActiveChat: true,
    onNewChat: vi.fn(),
  };

  it('renders SAINA shell with hero, composer, and no chat card when empty', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    expect(screen.getByTestId('saina-standalone-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Yeni Sohbet');
    expect(screen.getByTestId('composer-slot')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-chat-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('saina-standalone-mirror-panel')).toBeInTheDocument();
    expect(screen.getByText(SAINA_STANDALONE_MIRROR_PLACEHOLDER_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Ara' })).toBeInTheDocument();
  });

  it('shows chat card when not empty', () => {
    render(<SainaStandaloneShell {...baseProps} isEmpty={false} />);

    expect(screen.getByTestId('saina-chat-card')).toBeInTheDocument();
    expect(screen.getByTestId('messages-slot')).toBeInTheDocument();
  });

  it('collapses mirror panel and shows expand pill', () => {
    render(<SainaStandaloneShell {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: SAINA_MIRROR_COLLAPSE_LABEL }));
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeInTheDocument();
    expect(screen.getByText(SAINA_MIRROR_EXPAND_TAB)).toBeInTheDocument();
  });

  it('uses active chat title on hero', () => {
    render(<SainaStandaloneShell {...baseProps} heroTitle="Özbekistan Sohbeti" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Özbekistan Sohbeti');
  });
});
