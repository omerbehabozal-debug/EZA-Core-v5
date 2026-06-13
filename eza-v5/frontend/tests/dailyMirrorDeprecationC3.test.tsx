import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => null,
}));

vi.mock('@/lib/eza/plan/usePlan', () => ({
  usePlan: vi.fn(() => ({
    plan: 'plus',
    isPlus: true,
    isFree: false,
    isLoading: false,
    source: 'server',
    setPlan: vi.fn(),
    refreshPlan: vi.fn(),
  })),
}));

vi.mock('@/components/standalone/MirrorEntriesContext', () => ({
  useMirrorEntries: vi.fn(() => []),
}));

import SainaPatternPageInner from '@/components/saina/SainaPatternPageInner';
import StandaloneMirrorIndex from '@/app/standalone/mirror/page';
import StandaloneReportsRedirect from '@/app/standalone/reports/page';
import StandaloneInsightsRedirect from '@/app/standalone/insights/page';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';

const patternShellSrc = readFileSync(
  join(process.cwd(), 'components/saina/SainaPatternShell.tsx'),
  'utf8'
);
const mirrorIndexSrc = readFileSync(
  join(process.cwd(), 'app/standalone/mirror/page.tsx'),
  'utf8'
);
const reportsSrc = readFileSync(join(process.cwd(), 'app/standalone/reports/page.tsx'), 'utf8');
const insightsSrc = readFileSync(join(process.cwd(), 'app/standalone/insights/page.tsx'), 'utf8');
const upgradeModalSrc = readFileSync(
  join(process.cwd(), 'components/plan/UpgradeModal.tsx'),
  'utf8'
);
const dailyPageSrc = readFileSync(
  join(process.cwd(), 'app/standalone/mirror/daily/page.tsx'),
  'utf8'
);
const copySrc = readFileSync(join(process.cwd(), 'lib/eza/mirror/copy.ts'), 'utf8');

describe('Sprint C.3 — Daily Mirror user-facing deprecation', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('removes Günlük Ayna link from pattern shell source', () => {
    expect(patternShellSrc).not.toContain('Günlük Ayna');
    expect(patternShellSrc).not.toContain('MIRROR_DAILY_ROUTE');
  });

  it('does not show Günlük Ayna on rendered pattern page', async () => {
    render(<SainaPatternPageInner />);

    await waitFor(() => {
      expect(screen.getByTestId('saina-pattern-shell')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Günlük Ayna/i)).not.toBeInTheDocument();
  });

  it('redirects /standalone/mirror to /standalone', () => {
    render(<StandaloneMirrorIndex />);
    expect(mockReplace).toHaveBeenCalledWith('/standalone');
    expect(mirrorIndexSrc).not.toContain('MIRROR_DAILY_ROUTE');
  });

  it('redirects /standalone/reports to /standalone', () => {
    render(<StandaloneReportsRedirect />);
    expect(mockReplace).toHaveBeenCalledWith('/standalone');
    expect(reportsSrc).not.toContain('MIRROR_ROUTE');
  });

  it('redirects /standalone/insights to pattern route', () => {
    render(<StandaloneInsightsRedirect />);
    expect(mockReplace).toHaveBeenCalledWith(MIRROR_PATTERN_ROUTE);
    expect(insightsSrc).not.toContain('MIRROR_ROUTE');
    expect(insightsSrc).not.toContain('MIRROR_DAILY_ROUTE');
  });

  it('uses /standalone as UpgradeModal login fallback, not daily', () => {
    expect(upgradeModalSrc).toContain("pathname || '/standalone'");
    expect(upgradeModalSrc).not.toContain('/standalone/mirror/daily');
  });

  it('keeps MIRROR_DAILY_ROUTE constant for backward compatibility', () => {
    expect(copySrc).toContain("export const MIRROR_DAILY_ROUTE = '/standalone/mirror/daily'");
  });

  it('keeps direct daily route page intact', () => {
    expect(dailyPageSrc).toContain('StandaloneObservationExperience');
    expect(dailyPageSrc).toContain('useMirrorEntries');
  });
});
