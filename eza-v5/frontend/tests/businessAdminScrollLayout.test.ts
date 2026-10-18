/**
 * Business / Platform Admin scroll + applications layout architecture.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Business / Admin scroll layout', () => {
  const css = readFileSync(join(process.cwd(), 'styles/saina-business.css'), 'utf8');

  it('promotes business canvas to the vertical scrollport', () => {
    expect(css).toContain('saina-app-root.saina-business-shell .saina-canvas.saina-business-canvas-wrap');
    expect(css).toMatch(/\.saina-business-canvas-wrap[\s\S]*?overflow-y:\s*auto/);
    expect(css).toContain('overscroll-behavior-y: contain');
  });

  it('defeats route-transition flex clip so content can grow the canvas', () => {
    expect(css).toMatch(
      /\.saina-app-root\.saina-business-shell\s+\.saina-route-transition\s*\{[^}]*overflow:\s*visible/
    );
    expect(css).toMatch(
      /\.saina-app-root\.saina-business-shell\s+\.saina-route-transition\s*\{[^}]*flex:\s*0\s+0\s+auto/
    );
    expect(css).toMatch(/\.biz-panel\s*\{[^}]*flex:\s*0\s+0\s+auto/);
  });

  it('does not trap Business work area in a clipped nested scroll without height', () => {
    // Content-sized body; canvas owns overflow.
    expect(css).toMatch(/\.biz-body\s*\{[^}]*flex:\s*0\s+0\s+auto/);
    expect(css).toMatch(/\.biz-work\s*\{[^}]*overflow:\s*visible/);
  });

  it('applications use ~30/70 width fill without 1120px content cap', () => {
    expect(css).toMatch(
      /\.biz-admin-layout\s*\{[^}]*grid-template-columns:\s*minmax\(240px,\s*30%\)\s+minmax\(0,\s*1fr\)/
    );
    expect(css).not.toMatch(/\.padmin-content\s*\{[^}]*width:\s*min\(1120px/);
    expect(css).toMatch(/\.padmin-content\s*\{[^}]*width:\s*100%/);
  });

  it('Auth visibility refresh is throttled', () => {
    const auth = readFileSync(join(process.cwd(), 'context/AuthContext.tsx'), 'utf8');
    expect(auth).toContain('REFRESH_MIN_INTERVAL_MS');
    expect(auth).toContain('refreshInFlight');
    expect(auth).toContain('unchanged');
  });
});
