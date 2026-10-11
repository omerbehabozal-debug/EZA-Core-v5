import { webcrypto, createHash } from 'node:crypto';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { editorialSourceHash, validateEditorial, fetchYansiEditorial, type EditorialVersion } from '@/lib/eza/mirror/yansiEditorial';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import YansiEditorialBody from '@/components/mirror-landing/YansiEditorialBody';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';
import { writeYansiReading } from '@/lib/eza/mirror/yansiReadingPreferences';
import { saveFrozenReplayProgress, startReplaySession, clearAllFrozenReplayProgressForTests } from '@/lib/eza/mirror/journey/frozenReplaySession';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const answer = '# Başlık\r\n\r\nTürkçe 😀.\r\n\r\n1. Bir\r\n   - İç madde\r\n\r\n> Alıntı\r\n\r\n```js\r\nconst a = 1;\r\n```\r\n\r\n[Bağlantı](https://example.com)';
function artifact(slug = 'editorial'): PublicFrozenJourneyArtifact {
  return { slug, journeyId: slug, journeyVersion: 1, publicTitle: 'Orijinal başlık', authorUserId: 'publisher', selectedCount: 6, replayReady: true,
    steps: Array.from({ length: 6 }, (_, i) => ({ stepIndex: i + 1, publicQuestion: 'Soru 😀?', publicAnswer: answer })) };
}
async function metadata(source: PublicFrozenJourneyArtifact): Promise<EditorialVersion> {
  return { slug: source.slug, journeyVersion: 1, language: 'und', templateVersion: 1, sourceHash: await editorialSourceHash(source), offsetEncoding: 'utf-16', status: 'ready',
    steps: source.steps.map((step) => ({ stepIndex: step.stepIndex, questionHash: hash(step.publicQuestion), answerHash: hash(step.publicAnswer),
      blocks: [{ type: 'sectionHeading', startOffset: 0, endOffset: 10, displayNumber: '01' }, { type: 'markdown', startOffset: 10, endOffset: answer.length }] })) };
}
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); localStorage.clear(); clearAllFrozenReplayProgressForTests(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('persisted editorial public contract', () => {
  it('keeps editorial source and scroll completion on endpoint failure, then returns to standard without refetch', async () => {
    const source = artifact('error-layout');
    const session = startReplaySession(source);
    saveFrozenReplayProgress({ ...session, completedStepCount: 6, replayCompleted: true, phase: 'completed' });
    writeYansiReading({ mode: 'editorial', fontSize: 24, spacing: 'roomy' });
    const fetch = vi.fn((url: string) => Promise.resolve({ ok: !String(url).includes('/editorial?'), json: async () => ({}) }));
    vi.stubGlobal('fetch', fetch);
    render(<YansiExperienceSessionProvider slug={source.slug}><MirrorFrozenReplay artifact={source}
      desktopIdentity={{ title: source.publicTitle!, displayName: 'Yayıncı', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null }} />
      <YansiExperienceControls activeIdentity={source.slug} /></YansiExperienceSessionProvider>);
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('/editorial?'))).toBe(true));
    expect(screen.getAllByTestId('yansi-editorial-answer')).toHaveLength(6);
    expect(screen.queryByText('01')).toBeNull();
    const scroll = screen.getByTestId('mirror-frozen-replay-thread');
    expect(scroll).toContainElement(screen.getByTestId('mirror-frozen-replay-complete'));
    const composer = screen.getByPlaceholderText('Kendi merakınla devam et…');
    expect(scroll).not.toContainElement(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Okuma ayarları' }));
    fireEvent.click(screen.getByRole('button', { name: 'Standart' }));
    expect(screen.queryByTestId('yansi-editorial-answer')).toBeNull();
    expect(screen.getAllByRole('heading', { name: 'Başlık' })).toHaveLength(6);
    expect(screen.getByPlaceholderText('Kendi merakınla devam et…')).toBe(composer);
    fireEvent.click(screen.getByRole('button', { name: 'Editoryal' }));
    await act(async () => {});
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/editorial?'))).toHaveLength(1);
    expect(screen.getAllByTestId('yansi-editorial-answer')).toHaveLength(6);
  });
  it('validates exact Unicode/CRLF source and rejects stale hash, version, language and gaps', async () => {
    const source = artifact(); const value = await metadata(source);
    expect(await validateEditorial(value, source)).toEqual(value);
    for (const bad of [{ ...value, sourceHash: 'wrong' }, { ...value, journeyVersion: 2 }, { ...value, language: 'en' }, { ...value, templateVersion: 2 }]) {
      expect(await validateEditorial(bad, source)).toBeNull();
    }
    const gap = structuredClone(value); gap.steps[0].blocks[1].startOffset++;
    expect(await validateEditorial(gap, source)).toBeNull();
  });
  it('coalesces concurrent requests for one public source', async () => {
    const source = artifact('concurrent'); const value = await metadata(source);
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => value }); vi.stubGlobal('fetch', fetch);
    const results = await Promise.all(Array.from({ length: 100 }, () => fetchYansiEditorial(source)));
    expect(fetch).toHaveBeenCalledTimes(1); expect(results.every((result) => result?.sourceHash === value.sourceHash)).toBe(true);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
  });
  it('renders whole source markdown without losing nested lists, code, quote or link', async () => {
    const source = artifact(); const value = await metadata(source);
    render(<YansiEditorialBody text={answer} isUser={false} structure={value.steps[0]} />);
    expect(screen.getByRole('heading').textContent).toBe('01Başlık');
    expect(screen.getByText('01')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: 'Bağlantı' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByText('const a = 1;').closest('pre')).toBeTruthy();
    expect(screen.getByText('Alıntı').closest('blockquote')).toBeTruthy();
    expect(screen.getByText('İç madde').closest('ul')?.closest('li')).toBeTruthy();
  });
  it('applies late metadata without resetting replay, duplicating text, moving composer or manual scroll', async () => {
    const source = artifact('late'); const value = await metadata(source);
    const session = startReplaySession(source); saveFrozenReplayProgress({ ...session, completedStepCount: 6, replayCompleted: true, phase: 'completed' });
    writeYansiReading({ mode: 'editorial', fontSize: 20, spacing: 'roomy' });
    let resolve!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn((url: string) => String(url).includes('/editorial?')
      ? new Promise((r) => { resolve = r; }) : Promise.resolve({ ok: true, json: async () => ({}) })));
    render(<YansiExperienceSessionProvider slug="late"><MirrorFrozenReplay artifact={source}
      desktopIdentity={{ title: source.publicTitle!, displayName: 'Yayıncı', authorUserId: 'publisher', avatarUrl: null, honorific: null, timeLabel: null }} />
      <YansiExperienceControls activeIdentity="late" /></YansiExperienceSessionProvider>);
    await waitFor(() => expect(resolve).toBeTruthy());
    const root = screen.getByTestId('mirror-frozen-replay-thread'); root.scrollTop = 125; fireEvent.scroll(root);
    const composer = screen.getByPlaceholderText('Kendi merakınla devam et…');
    await act(async () => resolve({ ok: true, json: async () => value }));
    await waitFor(() => expect(screen.getAllByText('01')).toHaveLength(6), { timeout: 5000 });
    await waitFor(() => expect(root.scrollTop).toBe(125));
    expect(screen.getAllByTestId('yansi-editorial-question')).toHaveLength(6);
    expect(screen.getByTestId('mirror-frozen-replay-complete')).toBeTruthy();
    expect(screen.getByPlaceholderText('Kendi merakınla devam et…')).toBe(composer);
    expect(screen.getByTestId('yansi-public-reading').style.getPropertyValue('--yansi-reading-size')).toBe('20px');
    fireEvent.click(screen.getByRole('button', { name: 'Okuma ayarları' }));
    fireEvent.click(screen.getByRole('button', { name: 'Standart' }));
    expect(screen.queryByTestId('yansi-editorial-answer')).toBeNull();
    expect(screen.getAllByRole('heading', { name: 'Başlık' })).toHaveLength(6);
  });
});
