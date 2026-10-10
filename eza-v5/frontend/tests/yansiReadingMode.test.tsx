import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import { clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { DEFAULT_YANSI_READING, normalizeYansiReading, readYansiReading, writeYansiReading, YANSI_READING_STORAGE_KEY } from '@/lib/eza/mirror/yansiReadingPreferences';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
const identity = { title: 'Okuma', displayName: 'Yayıncı', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null };
const answer = '# Gerçek başlık\n\nİlk paragraf.\n\n1. Bir\n2. İki\n   - İç madde\n\nSon paragraf.  \nYeni satır.';
function artifact(text = answer) {
  return parsePublicFrozenJourneyArtifact({ slug: 'reading', journeyId: 'reading', journeyVersion: 1,
    publicTitle: 'Okuma', authorUserId: 'publisher', selectedCount: 6, replayReady: true,
    steps: Array.from({ length: 6 }, (_, index) => ({ stepIndex: index + 1, publicQuestion: `Soru ${index + 1}`, publicAnswer: text,
      ezaSnapshot: { userScore: 99, assistantScore: 98, intent: 'private' } })) })!;
}
function mount(text = answer, activeIdentity = 'reading') {
  return render(<YansiExperienceSessionProvider slug="reading">
    <div data-testid="normal-chat"><SainaMessageBody message={text} role="ai" /></div>
    <MirrorFrozenReplay artifact={artifact(text)} desktopIdentity={identity} />
    <YansiExperienceControls activeIdentity={activeIdentity} />
  </YansiExperienceSessionProvider>);
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Okuma ayarları' })); }
beforeEach(() => { localStorage.clear(); clearAllFrozenReplayProgressForTests(); });

describe('local reading preference contract', () => {
  it.each([null, {}, { mode: 'editorial', fontSize: 25, spacing: 'roomy' },
    { mode: 'standard', fontSize: 15, spacing: 'normal' }, { mode: 'editorial', fontSize: 18.5, spacing: 'roomy' },
    { mode: 'bad', fontSize: 18, spacing: 'roomy' }])('fails closed for invalid values %j', (value) => {
    expect(normalizeYansiReading(value)).toEqual(DEFAULT_YANSI_READING);
  });
  it('persists only the three presentation fields, and tolerates corrupt/denied storage', () => {
    writeYansiReading({ mode: 'editorial', fontSize: 24, spacing: 'normal', intent: 'private' } as never);
    expect(JSON.parse(localStorage.getItem(YANSI_READING_STORAGE_KEY)!)).toEqual({ mode: 'editorial', fontSize: 24, spacing: 'normal' });
    expect(readYansiReading().fontSize).toBe(24);
    localStorage.setItem(YANSI_READING_STORAGE_KEY, '{bad');
    expect(readYansiReading()).toEqual(DEFAULT_YANSI_READING);
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readYansiReading()).toEqual(DEFAULT_YANSI_READING);
    read.mockRestore();
  });
});

describe('desktop public reading UI', () => {
  it('limits reading typography to desktop public content and keeps the panel scroll bounded', () => {
    const css = postcss.parse(readFileSync(resolve(process.cwd(), 'styles/yansi-reel-responsive.css'), 'utf8'));
    let rules = 0;
    css.walkRules((rule) => {
      if (!rule.selector.includes('.yansi-public-reading')) return;
      rules++;
      expect(rule.selector).toContain('.yansi-desktop-experience');
      expect(rule.parent).toMatchObject({ name: 'media', params: '(min-width: 900px)' });
      rule.walkDecls('font-size', () => expect(rule.selector).toMatch(/saina-message-list:not\(\.yansi-replay-completion\)|saina-markdown/));
    });
    expect(rules).toBeGreaterThan(5);
    let bounded = false;
    css.walkRules('.yansi-reading-panel', (rule) => {
      const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value]));
      expect(declarations['max-height']).toBe('calc(100dvh - 24px)');
      expect(declarations['overflow-y']).toBe('auto');
      bounded = true;
    });
    expect(bounded).toBe(true);
  });
  it.each([[1024, 768], [1440, 900], [1920, 1080], [1024, 380]])('clamps the panel to a %s × %s viewport using measured rectangles', (width, height) => {
    const oldWidth = window.innerWidth, oldHeight = window.innerHeight;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { left: width - 76, bottom: 260, width: this.dataset.testid === 'yansi-reading-panel' ? 300 : 44,
        height: 320, top: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
      const view = mount(); open();
      const panel = screen.getByRole('dialog');
      const left = Number.parseFloat(panel.style.left), top = Number.parseFloat(panel.style.top);
      expect(left).toBeGreaterThanOrEqual(12); expect(left + 300).toBeLessThanOrEqual(width - 12);
      expect(top).toBeGreaterThanOrEqual(12); expect(top + 320).toBeLessThanOrEqual(height - 12);
      view.unmount();
    } finally {
      rect.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: oldWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: oldHeight });
    }
  });

  it('closes the panel when the active Yansı changes', () => {
    const view = render(<YansiExperienceSessionProvider slug="reading"><YansiExperienceControls activeIdentity="first" /></YansiExperienceSessionProvider>);
    open(); expect(screen.getByRole('dialog')).toBeTruthy();
    view.rerender(<YansiExperienceSessionProvider slug="reading"><YansiExperienceControls activeIdentity="second" /></YansiExperienceSessionProvider>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('defaults to standard; applies independent size/spacing and persists across sessions', () => {
    const view = mount();
    const reading = screen.getByTestId('yansi-public-reading');
    expect(reading).toHaveAttribute('data-reading-mode', 'standard');
    expect(reading.style.getPropertyValue('--yansi-reading-size')).toBe('16px');
    open();
    expect(screen.getByRole('button', { name: 'Standart' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Editoryal' }));
    expect(reading).toHaveAttribute('data-reading-mode', 'editorial');
    expect(reading).toHaveAttribute('data-reading-spacing', 'roomy');
    expect(reading.style.getPropertyValue('--yansi-reading-size')).toBe('18px');
    fireEvent.change(screen.getByRole('slider', { name: 'Yazı boyutu' }), { target: { value: '24' } });
    expect(screen.getByRole('button', { name: 'Yazıyı büyüt' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Normal$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Standart' }));
    expect(reading.style.getPropertyValue('--yansi-reading-size')).toBe('24px');
    expect(reading).toHaveAttribute('data-reading-spacing', 'normal');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '16' } });
    expect(screen.getByRole('button', { name: 'Yazıyı küçült' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ferah' }));
    view.unmount(); mount(); open();
    expect(screen.getByRole('button', { name: 'Ferah' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('normal-chat').closest('.yansi-public-reading')).toBeNull();
    expect(screen.getByTestId('yansi-title-block').closest('.yansi-public-reading')).toBeNull();
    expect(screen.getByTestId('saina-composer').closest('.yansi-public-reading')).toBeNull();
  });

  it('toggles, closes on Escape/outside/Tab departure and restores focus on Escape', () => {
    mount(); open();
    const trigger = screen.getByRole('button', { name: 'Okuma ayarları' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(trigger).toHaveFocus();
    open(); fireEvent.click(trigger); expect(screen.queryByRole('dialog')).toBeNull();
    open(); fireEvent.pointerDown(document.body); expect(screen.queryByRole('dialog')).toBeNull();
    open(); act(() => screen.getByRole('textbox', { name: 'Mesaj yaz' }).focus());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps content, scroll, composer and completed steps while changing presentation', async () => {
    mount('Eski düzleştirilmiş metin. 1. Bir 2. İki');
    fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
    await waitFor(() => expect(screen.getByTestId('yansi-public-reading').querySelector('.saina-msg-ai')).toBeTruthy());
    const root = screen.getByTestId('mirror-frozen-replay-thread');
    const composer = screen.getByTestId('saina-composer');
    root.scrollTop = 0; fireEvent.scroll(root);
    const content = root.querySelector('.saina-msg-ai .saina-msg-prose')!.outerHTML;
    open(); fireEvent.click(screen.getByRole('button', { name: 'Editoryal' }));
    expect(root.querySelector('.saina-msg-ai .saina-msg-prose')!.outerHTML).toBe(content);
    expect(root.querySelector('ol, h3')).toBeNull();
    expect(screen.getByTestId('mirror-frozen-replay-thread')).toBe(root);
    expect(screen.getByTestId('saina-composer')).toBe(composer);
    expect(root.contains(composer)).toBe(false); expect(root.scrollTop).toBe(0);
    expect(screen.getByTestId('mirror-frozen-replay-next-question')).toHaveAttribute('data-step-index', '2');
    expect(root.querySelector('[data-testid="eza-card"]')).toBeNull();
  });

  it('does not restart a reveal when mode changes during playback', async () => {
    const media = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ ...media(query), matches: query.includes('min-width') }));
    try {
      const view = mount(answer.repeat(20));
      fireEvent.click(screen.getByTestId('mirror-frozen-replay-next-question'));
      await waitFor(() => expect(screen.getByTestId('frozen-answer-reveal').textContent!.length).toBeGreaterThan(8));
      const reveal = screen.getByTestId('frozen-answer-reveal');
      const length = reveal.textContent!.length;
      open(); fireEvent.click(screen.getByRole('button', { name: 'Editoryal' }));
      expect(screen.getByTestId('frozen-answer-reveal')).toBe(reveal);
      expect(reveal.textContent!.length).toBeGreaterThanOrEqual(length);
      expect(screen.getByTestId('yansi-public-reading').querySelectorAll('.saina-msg-user')).toHaveLength(1);
      expect(screen.queryByTestId('mirror-frozen-replay-next-question')).toBeNull();
      expect(reveal).toHaveAttribute('data-reveal-complete', 'false');
      view.unmount();
    } finally { window.matchMedia = media; }
  });

  it('does not add controls to Reel or mobile replay', () => {
    const view = render(<YansiExperienceSessionProvider slug="reading"><YansiExperienceControls showPlaybackControls={false} /></YansiExperienceSessionProvider>);
    expect(screen.queryByTestId('yansi-reading-trigger')).toBeNull(); view.unmount();
    const media = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ ...media(query), matches: !query.includes('min-width') }));
    try {
      render(<YansiExperienceSessionProvider slug="reading"><MirrorFrozenReplay artifact={artifact()} /><YansiExperienceControls /></YansiExperienceSessionProvider>);
      expect(screen.queryByTestId('yansi-reading-trigger')).toBeNull();
      expect(screen.queryByTestId('yansi-public-reading')).toBeNull();
    } finally { window.matchMedia = media; }
  });
});
