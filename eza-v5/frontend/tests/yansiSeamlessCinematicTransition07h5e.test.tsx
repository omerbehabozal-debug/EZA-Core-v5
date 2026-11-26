/**
 * 07H.5E — Keşfet → Deneyimle must not flash the default cityscape.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';

const BIZ = '11111111-1111-1111-1111-111111111111';
const ASSET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COVER = `/api/business-yansi/public-media/${BIZ}/${ASSET}`;

describe('07H.5E seamless cinematic transition', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Image',
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        naturalWidth = 0;
        set src(_value: string) {
          // Cold cache: decode arrives async — identity must already be painted.
          queueMicrotask(() => {
            this.complete = true;
            this.naturalWidth = 1024;
            this.onload?.();
          });
        }
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('paints cover identity on first frame without cityscape bundled layer', () => {
    render(<SainaCinematicScene sceneImageUrl={COVER} />);
    const identity = screen.getByTestId('saina-scene-identity-layer');
    expect(identity).toHaveAttribute('data-saina-scene-fit', 'cover');
    expect(identity.className).toContain('saina-canvas-scene-image--identity-visible');
    expect(identity.style.backgroundImage).toContain(COVER);
    expect(screen.queryByTestId('saina-scene-image-layer')).toBeNull();
    expect(screen.getByTestId('saina-scene-pending-layer')).toBeInTheDocument();
    expect(document.querySelector('[data-saina-scene-pending="cover"]')).toBeTruthy();
  });

  it('keeps cover visible across remount (warm Keşfet→Deneyimle handoff)', () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = true;
        naturalWidth = 1024;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    const { unmount } = render(<SainaCinematicScene sceneImageUrl={COVER} />);
    expect(screen.getByTestId('saina-scene-identity-layer')).toBeInTheDocument();
    unmount();
    render(<SainaCinematicScene sceneImageUrl={COVER} />);
    expect(screen.getByTestId('saina-scene-identity-layer').style.backgroundImage).toContain(
      COVER
    );
    expect(screen.queryByTestId('saina-scene-image-layer')).toBeNull();
  });

  it('uses cityscape only when there is no cover URL', () => {
    render(<SainaCinematicScene />);
    expect(screen.getByTestId('saina-scene-image-layer')).toBeInTheDocument();
    expect(screen.queryByTestId('saina-scene-identity-layer')).toBeNull();
    expect(screen.queryByTestId('saina-scene-pending-layer')).toBeNull();
  });

  it('falls back to cityscape only after confirmed load error', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = false;
        naturalWidth = 0;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    render(<SainaCinematicScene sceneImageUrl={COVER} />);
    expect(screen.getByTestId('saina-scene-identity-layer')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('saina-scene-identity-layer')).toBeNull();
      expect(screen.getByTestId('saina-scene-image-layer')).toBeInTheDocument();
    });
  });

  it('openChatDepth preloads business cover URL before depth change', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/mirror-landing/MirrorYansiChainExperience.tsx'),
      'utf8'
    );
    expect(src).toMatch(/preloadArtifactScene\(activeNode\?\.artifact/);
    expect(src).toMatch(/function resolveExperienceSceneUrl/);
    expect(src).toMatch(/businessCoverUrl\(artifact\.businessMedia\)/);
  });
});
