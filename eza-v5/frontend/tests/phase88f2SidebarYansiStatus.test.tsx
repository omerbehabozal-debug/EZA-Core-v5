import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import {
  clearAllMirrorJourneyArtifactsForTests,
  findReusablePreparedYansiArtifact,
  isReusablePreparedYansiArtifact,
  listAllJourneyArtifactsForOwner,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactPublished,
  markMirrorJourneyArtifactPublishFailed,
  markMirrorJourneyArtifactReadyFromLineage,
  noteOwnerYansiSlugPublication,
  resetOwnerYansiPublicationAuthorityForTests,
  resolveConversationYansiStatus,
  shouldSkipAynaSceneGeneration,
  applyOwnerYansiUnpublishedLocally,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey';

function lineage(
  tag: string,
  opts: { blockIndex?: number; version?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: opts.version ?? 1,
    sourceConversationId: opts.conv ?? 'conv-1',
    windowIndex: block,
    windowStart: block * 8,
    windowEnd: block * 8 + 7,
    blockIndex: block,
    windowHash: `h-${tag}`,
    sourceBlockHash: `b-${tag}`,
    scopedInputHash: `s-${tag}`,
    selectedStepsHash: `t-${tag}`,
    selectedCount: 8,
    interpretationHash: `i-${tag}`,
    publicLandingHash: `p-${tag}`,
    mappedPromptHash: `m-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `asset-${tag}`,
    sealedAt: new Date().toISOString(),
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: block * 8 + i,
      sourceUserMessageId: `u-${tag}-${i}`,
      sourceAssistantMessageId: `a-${tag}-${i}`,
      publicQuestion: `Q ${tag} ${i}?`,
      publicAnswer: `A ${tag} ${i}.`,
    })),
  };
}

function ready(owner: string, tag: string, conv = 'conv-1') {
  return markMirrorJourneyArtifactReadyFromLineage(owner, {
    lineage: lineage(tag, { conv }),
    sceneImageUrl: `https://cdn.example/scene-${tag}.jpg`,
    publicTitle: `Title ${tag}`,
    publicSummary: `Summary ${tag}`,
    continuationContext: `Continue ${tag}`,
  });
}

describe('Phase 8.8F.2 sidebar Yansı status + Ayna reopen', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
    resetOwnerYansiPublicationAuthorityForTests();
  });

  it('1. normal conversation → none', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('none');
  });

  it('2. valid ready unpublished → ready (amber)', () => {
    const artifact = ready('user-1', 'draft');
    expect(isReusablePreparedYansiArtifact(artifact)).toBe(true);
    expect(
      resolveConversationYansiStatus({
        artifacts: [artifact!],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('3. published + server public → published (green)', () => {
    const artifact = ready('user-1', 'live')!;
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      slug: 'public-slug',
      shareUrl: '/m/public-slug',
    });
    const published = {
      ...artifact,
      status: 'published' as const,
      publish: { slug: 'public-slug', shareUrl: '/m/public-slug', publishedAt: new Date().toISOString() },
    };
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['public-slug', { slug: 'public-slug', visibility: 'public', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('published');
  });

  it('4. generating → no amber', () => {
    const artifact = markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-gen',
      sourceConversationId: 'conv-1',
      blockIndex: 0,
    });
    expect(
      resolveConversationYansiStatus({
        artifacts: artifact ? [artifact] : [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('none');
  });

  it('5. failed → no amber', () => {
    ready('user-1', 'fail');
    markMirrorJourneyArtifactFailed('user-1', {
      journeyId: 'journey-fail',
      journeyVersion: 1,
      message: 'boom',
    });
    const failed = markMirrorJourneyArtifactFailed('user-1', {
      journeyId: 'journey-fail',
      journeyVersion: 1,
      message: 'boom',
    });
    expect(
      resolveConversationYansiStatus({
        artifacts: failed ? [failed] : [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('none');
  });

  it('6. cached published after server unpublish → not green', () => {
    const published = {
      ...ready('user-1', 'stale')!,
      status: 'published' as const,
      publish: { slug: 'stale-slug', shareUrl: '/m/stale-slug', publishedAt: '2026-01-01T00:00:00.000Z' },
    };
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['stale-slug', { slug: 'stale-slug', visibility: 'private', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('7. publish success + authority public → green', () => {
    const artifact = ready('user-1', 'ok')!;
    noteOwnerYansiSlugPublication('ok-slug', { visibility: 'public', safetyStatus: 'open' });
    const published = {
      ...artifact,
      status: 'published' as const,
      publish: { slug: 'ok-slug', shareUrl: '/m/ok-slug', publishedAt: new Date().toISOString() },
    };
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['ok-slug', { slug: 'ok-slug', visibility: 'public', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('published');
  });

  it('8. publish failure keeps ready, not green', () => {
    const artifact = ready('user-1', 'pfail')!;
    markMirrorJourneyArtifactPublishFailed('user-1', {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      message: 'network',
    });
    expect(
      resolveConversationYansiStatus({
        artifacts: [artifact],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('9. recovered publish (authority public) → green', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [
          {
            ...ready('user-1', 'rec')!,
            status: 'published',
            publish: { slug: 'rec-slug', shareUrl: '/m/rec-slug', publishedAt: new Date().toISOString() },
          },
        ],
        publicationBySlug: new Map([
          ['rec-slug', { slug: 'rec-slug', visibility: 'public', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('published');
  });

  it('10. restricted/safety removed → none, not amber', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [
          {
            ...ready('user-1', 'bad')!,
            status: 'published',
            publish: { slug: 'bad-slug', shareUrl: '/m/bad-slug', publishedAt: new Date().toISOString() },
          },
        ],
        publicationBySlug: new Map([
          ['bad-slug', { slug: 'bad-slug', visibility: 'private', safetyStatus: 'restricted' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('none');
  });

  it('11. private/unpublished reusable → amber', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [
          {
            ...ready('user-1', 'priv')!,
            status: 'published',
            publish: { slug: 'priv-slug', shareUrl: '/m/priv-slug', publishedAt: new Date().toISOString() },
          },
        ],
        publicationBySlug: new Map([
          ['priv-slug', { slug: 'priv-slug', visibility: 'private', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('31. authority not ready → no false green for local published', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [
          {
            ...ready('user-1', 'wait')!,
            status: 'published',
            publish: { slug: 'wait-slug', shareUrl: '/m/wait-slug', publishedAt: new Date().toISOString() },
          },
        ],
        publicationBySlug: new Map(),
        publicationAuthorityReady: false,
      })
    ).toBe('none');
  });

  it('22-25. ready artifact reopen skips duplicate generate and version bump', () => {
    const first = ready('user-1', 'reopen')!;
    expect(shouldSkipAynaSceneGeneration({ artifacts: [first], journeyId: first.journeyId })).toBe(
      true
    );
    const again = markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: first.journeyId,
      sourceConversationId: 'conv-1',
      blockIndex: first.blockIndex,
    });
    expect(again?.status).toBe('ready');
    expect(again?.journeyVersion).toBe(first.journeyVersion);
    expect(findReusablePreparedYansiArtifact([again!])?.journeyId).toBe(first.journeyId);
  });

  it('26. later publish is possible from ready artifact', () => {
    const artifact = ready('user-1', 'later')!;
    const published = markMirrorJourneyArtifactPublished('user-1', {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      slug: 'later-slug',
      shareUrl: '/m/later-slug',
    });
    expect(published?.status).toBe('published');
  });

  it('27-28. published reopen skips generate and does not auto-republish', () => {
    const artifact = ready('user-1', 'pubre')!;
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      slug: 'pubre-slug',
      shareUrl: '/m/pubre-slug',
    });
    const stored = markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: artifact.journeyId,
      sourceConversationId: 'conv-1',
      blockIndex: artifact.blockIndex,
    });
    expect(stored?.status).toBe('published');
    expect(shouldSkipAynaSceneGeneration({ artifacts: [stored!], journeyId: artifact.journeyId })).toBe(
      true
    );
  });

  it('29-30. closing ready Ayna preserves artifact; unpublish demotes to ready', () => {
    const artifact = ready('user-1', 'keep')!;
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      slug: 'keep-slug',
      shareUrl: '/m/keep-slug',
    });
    applyOwnerYansiUnpublishedLocally('keep-slug');
    const remaining = listAllJourneyArtifactsForOwner('user-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.status).toBe('ready');
    expect(isReusablePreparedYansiArtifact(remaining[0])).toBe(true);
  });

  it('33. child conversation does not inherit parent status', () => {
    const parent = ready('user-1', 'parent', 'parent-chat')!;
    expect(
      resolveConversationYansiStatus({
        artifacts: [parent],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
    expect(
      resolveConversationYansiStatus({
        artifacts: [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('none');
  });

  it('31. account isolation: owner scan does not leak other accounts', () => {
    ready('user-a', 'secret', 'shared-conv');
    ready('user-b', 'other', 'shared-conv');
    expect(listAllJourneyArtifactsForOwner('user-a').every((row) => row.journeyId === 'journey-secret')).toBe(
      true
    );
    expect(listAllJourneyArtifactsForOwner('user-b').every((row) => row.journeyId === 'journey-other')).toBe(
      true
    );
  });

  it('guest/local published without profile authority stays amber, not green', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [
          {
            ...ready('guest:tok', 'guestpub')!,
            status: 'published',
            publish: {
              slug: 'guest-slug',
              shareUrl: '/m/guest-slug',
              publishedAt: new Date().toISOString(),
            },
          },
        ],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
  });

  it('unlisted + open safety is green; recover then profile public is green', () => {
    const published = {
      ...ready('user-1', 'unlist')!,
      status: 'published' as const,
      publish: {
        slug: 'unlist-slug',
        shareUrl: '/m/unlist-slug',
        publishedAt: new Date().toISOString(),
      },
    };
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['unlist-slug', { slug: 'unlist-slug', visibility: 'unlisted', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('published');
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
      })
    ).toBe('ready');
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['unlist-slug', { slug: 'unlist-slug', visibility: 'public', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
      })
    ).toBe('published');
  });
});

describe('Phase 8.8F.2 sidebar visual contract', () => {
  const sample = {
    id: 'chat-dot',
    title: 'Mardin Sohbeti',
    preview: 'Taş şehir',
    time: 'Az önce',
    thumbGradient: 'linear-gradient(135deg, #173B45, #0F2B25)',
    thumbImageUrl: 'https://cdn.example/scene.jpg',
  };

  it('12-21. thumbnail unchanged; dot is title-adjacent; no status copy; click intact', () => {
    const onSelectChat = vi.fn();
    const { rerender } = render(
      <SainaConversationSidebar
        conversations={[{ ...sample, yansiStatus: 'ready' }]}
        onSelectChat={onSelectChat}
      />
    );
    const thumb = document.querySelector('.saina-conv-thumb');
    const image = document.querySelector('.saina-conv-thumb__image, .saina-conv-thumb__image');
    const dot = screen.getByTestId('saina-sidebar-yansi-status-chat-dot');
    expect(thumb).toBeTruthy();
    expect(image).toBeTruthy();
    expect(thumb?.contains(dot)).toBe(false);
    expect(dot.getAttribute('data-yansi-status')).toBe('ready');
    expect(dot.getAttribute('aria-label')).toBe('Yansı yayına hazır');
    expect(dot.getAttribute('title')).toBe('Yansı yayına hazır');
    expect(screen.queryByText('Taslak')).not.toBeInTheDocument();
    expect(screen.queryByText('Yayında')).not.toBeInTheDocument();
    expect(screen.queryByText('Yayınlandı')).not.toBeInTheDocument();
    expect(screen.queryByText('Yansı hazır')).not.toBeInTheDocument();

    rerender(
      <SainaConversationSidebar
        conversations={[{ ...sample, yansiStatus: 'published' }]}
        onSelectChat={onSelectChat}
      />
    );
    const green = screen.getByTestId('saina-sidebar-yansi-status-chat-dot');
    expect(green.getAttribute('data-yansi-status')).toBe('published');
    expect(green.getAttribute('aria-label')).toBe('Yansı yayında');

    rerender(
      <SainaConversationSidebar conversations={[{ ...sample }]} onSelectChat={onSelectChat} />
    );
    expect(screen.queryByTestId('saina-sidebar-yansi-status-chat-dot')).not.toBeInTheDocument();

    screen.getByRole('button', { name: /Mardin Sohbeti/ }).click();
    expect(onSelectChat).toHaveBeenCalledWith('chat-dot');
  });

  it('12-16. CSS keeps thumb contract and 6px dots', () => {
    const css = readFileSync(join(process.cwd(), 'styles/saina-mirror.css'), 'utf8');
    const desktop = readFileSync(join(process.cwd(), 'styles/saina-yansi-desktop.css'), 'utf8');
    expect(css).toMatch(/\.saina-conv-thumb\s*\{[^}]*height:\s*2\.625rem/);
    expect(css).toMatch(/\.saina-conv-thumb\s*\{[^}]*width:\s*2\.625rem/);
    expect(desktop).toMatch(/\.saina-conv-thumb\s*\{[^}]*width:\s*42px/);
    expect(desktop).toMatch(/\.saina-conv-thumb\s*\{[^}]*height:\s*42px/);
    expect(css).toMatch(/\.saina-sidebar-yansi-status[^{]*\{[^}]*width:\s*6px/);
    expect(css).toMatch(/\.saina-sidebar-yansi-status[^{]*\{[^}]*height:\s*6px/);
    const statusBlock = css.split('.saina-sidebar-yansi-status')[1]?.split('}')[0] ?? '';
    expect(statusBlock).toMatch(/box-shadow:\s*none/);
    expect(statusBlock).not.toMatch(/pointer-events:\s*none/);
    expect(statusBlock).not.toMatch(/animation/);
  });

  it('20. selected row class stays bronze-left active indicator', () => {
    render(
      <SainaConversationSidebar
        conversations={[{ ...sample, yansiStatus: 'ready' }]}
        activeChatId="chat-dot"
      />
    );
    const row = document.querySelector('[data-testid="saina-conv-row-chat-dot"]');
    expect(row?.className).toMatch(/saina-conv-row--active/);
    expect(row?.className).not.toMatch(/saina-conv-row--quiet/);
  });

  it('34-38. Audio/Rhythm/Share/Ayna eligibility files stay independent of sidebar status', () => {
    const audio = readFileSync(join(process.cwd(), 'lib/eza/mirror/yansiSpeech.ts'), 'utf8');
    const rhythm = readFileSync(join(process.cwd(), 'lib/eza/mirror/yansiRhythm.ts'), 'utf8');
    const share = readFileSync(join(process.cwd(), 'lib/eza/mirror/yansiExperienceShare.ts'), 'utf8');
    expect(audio).toContain('cancelYansiSpeech');
    expect(rhythm).toContain('bilign:yansi-rhythm');
    expect(share).toContain('buildMirrorPublicShareUrl');
    expect(audio).not.toContain('resolveConversationYansiStatus');
    expect(rhythm).not.toContain('resolveConversationYansiStatus');
    expect(share).not.toContain('resolveConversationYansiStatus');
  });

  it('22-24/39. Ayna reopen skips duplicate scene generation; sidebar has no Yansılar chrome', () => {
    const chat = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    const obs = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    const recover = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/journey/recoverPublishedJourney.ts'),
      'utf8'
    );
    const sidebar = readFileSync(
      join(process.cwd(), 'components/saina/SainaConversationSidebar.tsx'),
      'utf8'
    );
    expect(chat).toContain('shouldSkipAynaSceneGeneration');
    expect(obs).toContain('shouldSkipAynaSceneGeneration');
    expect(recover).toContain('hydrateOwnerYansiPublicationAuthority');
    expect(sidebar).not.toContain('Yansılar');
    expect(sidebar).not.toContain('Taslak');
    expect(sidebar).not.toContain('Yayında');
  });
});
