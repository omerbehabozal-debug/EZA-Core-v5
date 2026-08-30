/**
 * Phase 8.8F Stage 1–5 — scoped desktop Yansı visual styles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAINA_COMPOSER_PLACEHOLDER } from '@/lib/eza/sainaCopy';

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Phase 8.8F Stage 1–5 desktop Yansı styles', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const layout = read('app/standalone/SainaAppRootLayout.tsx');

  it('imports scoped desktop stylesheet from app root layout', () => {
    expect(layout).toContain("import '@/styles/saina-yansi-desktop.css'");
  });

  it('scopes rules to standalone-shell and leaves Discover class unused', () => {
    expect(css).toContain('.saina-app-root.saina-standalone-shell');
    expect(css).not.toContain('.saina-discover-shell');
    expect(css).toContain('@media (min-width: 900px)');
  });

  it('defines Stage 1 fullscreen shell tokens and edge-to-edge frame', () => {
    expect(css).toContain('--bilign-bg: #090b0b');
    expect(css).toContain('--bilign-bronze: #b78949');
    expect(css).toContain('padding: 0');
    expect(css).toContain('border-radius: 0');
    expect(css).toContain('--saina-sidebar-width: 280px');
  });

  it('defines Stage 2 fixed sidebar surface with subtle hairline and Yansı edge bleed', () => {
    expect(css).toContain('rgba(232, 226, 215, 0.045)');
    expect(css).toContain('--bilign-sidebar-surface: #0c0d0d');
    expect(css).toContain('--yansi-accent-rgb: 183, 137, 73');
    expect(css).toContain('border-right: 1px solid rgba(232, 226, 215, 0.045)');
    expect(css).toContain('rgba(var(--yansi-accent-rgb), 0.025)');
    expect(css).toContain('width: 28px');
    expect(css).toContain('--saina-sidebar-fade-width: 160px');
  });

  it('defines Stage 3 image normalization and keeps focal CSS var path untouched in scene CSS', () => {
    expect(css).toContain('saturate(0.9)');
    expect(css).toContain('contrast(0.97)');
    expect(css).toContain('brightness(0.94)');
    const scene = read('styles/saina-mirror.css');
    expect(scene).toContain('--mirror-focal-position');
  });

  it('defines Stage 4 editorial reading-plane measure and in-zone scroll height', () => {
    expect(css).toContain('clamp(340px, 46vh, 540px)');
    expect(css).toContain('min(650px, 100%)');
    expect(css).toContain('blur(20px) saturate(70%)');
    expect(css).toContain('--saina-reading-atmosphere-width');
  });

  it('defines Stage 5 continuation composer glass and muted bronze send', () => {
    expect(css).toContain('min-height: 68px');
    expect(css).toContain('border-radius: 18px');
    expect(css).toContain('blur(22px) saturate(70%)');
  });

  it('updates composer placeholder copy', () => {
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
  });

  it('documents Stage 6–8 identity + rail selectors', () => {
    expect(css).toContain('bilign-yansi-identity');
    expect(css).toContain('bilign-context-rail');
    expect(css).toContain('max-width: 1099px');
  });

  it('tightens empty-state stack and mutes leftover gold chrome', () => {
    expect(css).toContain('saina-main-body--empty');
    expect(css).toContain('saina-chat-column--empty');
    expect(css).toContain('flex-direction: row');
    expect(css).toContain('background: transparent');
  });

  it('restyles desktop Ayna panel chrome without inventing Journey UX', () => {
    expect(css).toContain('saina-mirror-panel');
    expect(css).toContain('--saina-mirror-col-width: 360px');
    expect(css).toContain('saina-mirror-collapse-btn');
    expect(css).toContain('ayna-journey-slide__title');
    expect(css).not.toContain('bilign-progress');
  });
});

describe('Phase 8.8F Stage 9 isolation', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const rail = read('components/saina/SainaYansiContextRail.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');

  it('does not invent handle, plan-as-identity, or 8-step progress', () => {
    expect(hero).not.toContain('planLabel');
    expect(hero).not.toContain('kullanıcı adı');
    expect(hero).not.toContain('bilign-progress');
    expect(hero).not.toMatch(/@[a-z0-9_]+/i);
    expect(css).not.toContain('bilign-progress');
    expect(css).not.toContain('identity__plan');
    expect(hero).toContain('ProfileUserAvatar');
    expect(hero).toContain('avatarUrl');
    expect(hero).toContain('honorificLabel');
    expect(read('components/mirror-landing/MirrorYansiChainExperience.tsx')).toContain(
      'AynaAuthorRow'
    );
    expect(shell).toContain('SainaHeroScene');
    expect(shell).toContain('resolveSainaUserDisplayName');
    expect(shell).toContain('resolveYansiCreatorHonorific');
    expect(shell).toContain('resolveSelfProfileAvatar');
    expect(shell).not.toContain('resolveSainaSidebarFooter');
  });

  it('keeps Ayna reachable through the context rail', () => {
    expect(rail).toContain('onOpenAyna');
    expect(shell).toContain('SainaYansiContextRail');
    expect(shell).toContain('tryOpenMirror');
  });

  it('marks empty conversation stack without inventing chat chrome', () => {
    expect(shell).toContain("isEmpty && 'saina-main-body--empty'");
    expect(shell).toContain("isEmpty && 'saina-chat-column--empty'");
  });

  it('does not restyle Discover, ranking, or profile surfaces', () => {
    expect(css).not.toContain('saina-discover-shell');
    expect(css).not.toContain('strong_curiosity');
    expect(css).not.toContain('bilign-profile');
  });

  it('gates desktop layout at 900px while sharing biligN sidebar tokens on mobile', () => {
    expect(css).toContain('Shared biligN sidebar + tokens apply from mobile up');
    expect(css).toContain('.bilign-yansi-identity__mark');
    expect(css).toContain('.bilign-yansi-identity__name-row');
    expect(css).toMatch(/\.bilign-yansi-identity__name-row \{\s*display: none;/);
    expect(css).toContain('@media (max-width: 899px)');
  });
});

describe('Phase 8.8F Stage A Yansı-first composition', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const rail = read('components/saina/SainaYansiContextRail.tsx');

  it('dissolves the central chat window into a localized reading plane', () => {
    expect(css).toContain('editorial reading plane (not a chat window)');
    expect(css).toContain('rgba(10, 12, 12, 0.66)');
    expect(css).toContain('--saina-reading-atmosphere-width');
    expect(css).toContain('overflow: visible');
    expect(css).not.toContain('rgba(18, 20, 20, 0.80)');
    expect(css).not.toContain('cream border (not bronze geometry)');
  });

  it('keeps conversation in a wide reading plane without bronze/gold card geometry', () => {
    expect(css).toMatch(/min\(\s*900px/);
    expect(css).toContain('72vw');
    expect(css).not.toContain('min(1480px');
    expect(css).not.toContain('min(820px');
    expect(css).toContain('saina-canvas::after');
    expect(css).toContain('--saina-sidebar-fade-width: 160px');
    expect(css).not.toContain('rgba(231, 180, 91');
    expect(css).not.toContain('0 0 120px');
  });

  it('places Yansı identity in the scene and pins conversation to the lower reading zone', () => {
    const frameCss = read('styles/bilign-avatar-identity-frame.css');
    expect(css).toContain('clamp(19px, 1.26vw, 22px)');
    expect(css).toContain('clamp(12px, 0.92vw, 15px)');
    expect(css).toContain('width: 62px');
    expect(css).toContain('-webkit-line-clamp: 2');
    expect(css).toContain('margin-top: auto');
    expect(css).toContain('justify-content: flex-start');
    expect(frameCss).toContain('width: 84px');
    expect(hero).toContain('BilignAvatarIdentityFrame');
    expect(hero).not.toContain('planLabel');
  });

  it('restores user-right / assistant-left without speaker name chrome', () => {
    expect(css).toContain('user right, assistant left');
    expect(css).toContain('margin-left: auto');
    expect(css).toContain('align-self: flex-end');
    expect(css).toContain('.saina-msg-ai-header');
    expect(css).toContain('.saina-msg-ai-title');
    expect(css).toContain('display: none');
  });

  it('keeps the continuation composer on the conversation spine, not the full reading plane', () => {
    expect(css).toContain('.saina-composer-inner');
    expect(css).toContain('width: 100%');
    expect(css).toContain('max-width: var(--saina-composer-width)');
    expect(css).toContain('--saina-composer-width: min(680px, 100%)');
  });

  it('lightens global scene veil so darkness stays behind text, not the whole Yansı', () => {
    expect(css).toContain('transparent 42%');
    expect(css).toContain('brightness(0.94)');
    expect(css).not.toContain('--mirror-focal-position');
    const scene = read('styles/saina-mirror.css');
    expect(scene).toContain('--mirror-focal-position');
  });

  it('keeps continuation composer, Ayna wiring, sidebar, and isolation untouched in product terms', () => {
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
    expect(css).toContain('margin-top: 12px');
    expect(css).toContain('--saina-sidebar-width: 280px');
    expect(shell).toContain('tryOpenMirror');
    expect(rail).toContain('onOpenAyna');
    expect(css).not.toContain('saina-discover-shell');
    expect(css).not.toContain('bilign-progress');
  });
});

describe('Phase 8.8F creator identity contract', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const hero = read('components/saina/SainaHeroScene.tsx');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const profileEdit = read('components/mirror/ayna/ProfileEditSheet.tsx');
  const profilePage = read('components/mirror/ayna/AuthorPublishedYansiProfile.tsx');
  const discoverCard = read('components/saina/SainaDiscoverCard.tsx');
  const aynaAuthor = read('components/mirror/ayna/AynaAuthorRow.tsx');
  const chatInner = read('components/standalone/StandaloneChatInner.tsx');
  const honorific = read('lib/eza/mirror/publicHonorific.ts');
  const creator = read('lib/eza/mirror/yansiCreatorIdentity.ts');
  const patch = read('lib/eza/plan/fetchAuthMe.ts');

  it('uses public display name, honorific, and Yansı title — never plan, email, or handle', () => {
    expect(honorific).toContain("curious: 'Meraklı'");
    expect(honorific).toContain("bilgin: 'Bilgin'");
    expect(creator).toContain('PUBLIC_DISPLAY_NAME_FALLBACK');
    expect(creator).toContain('isGuest');
    expect(creator).not.toContain('user.email');
    expect(creator).not.toContain('split("@")');
    expect(aynaAuthor).toContain('HonorificMarker');
    expect(read('components/mirror-landing/MirrorYansiChainExperience.tsx')).toContain(
      'authorHonorific'
    );
    expect(shell).toContain('heroTitle');
    expect(shell).toContain('SainaHeroScene');
    expect(shell).toContain('resolveSainaUserDisplayName');
    expect(shell).toContain('resolveYansiCreatorHonorific');
    expect(shell).not.toContain('resolveSainaSidebarFooter');
    expect(hero).not.toContain('biligN Free');
    expect(hero).not.toContain('biligN Guest');
    expect(hero).not.toContain('Premium');
    expect(css).not.toContain('identity__plan');
    expect(patch).toContain('body: { public_display_name: publicDisplayName }');
    expect(patch).not.toContain('public_honorific: publicDisplayName');
  });

  it('does not let the owner edit honorific on profile, Discover, mobile, or chat inner', () => {
    expect(profileEdit).not.toContain('public_honorific');
    expect(profileEdit).not.toContain('Bilgin');
    expect(profileEdit).not.toContain('Meraklı');
    expect(profileEdit).not.toContain('HonorificMarker');
    expect(profileEdit).not.toContain('<select');
    expect(profilePage).toContain('HonorificMarker');
    expect(profilePage).not.toContain('<select');
    expect(discoverCard).toContain('HonorificMarker');
    expect(discoverCard).not.toContain('account_tier');
    expect(discoverCard).not.toContain('mirror_plan');
    expect(aynaAuthor).toContain('HonorificMarker');
    expect(chatInner).not.toContain('publicHonorific');
    expect(chatInner).not.toContain('SainaHeroScene');
  });
});

describe('Phase 8.8F Stage B sidebar fade + reading plane refinement', () => {
  const css = read('styles/saina-yansi-desktop.css');
  const mirror = read('styles/saina-mirror.css');
  const shell = read('components/saina/SainaStandaloneShell.tsx');
  const rail = read('components/saina/SainaYansiContextRail.tsx');

  it('paints a 160px scene overlay after the sidebar, on the Yansı image', () => {
    expect(css).toContain('--saina-sidebar-width: 280px');
    expect(css).toContain('--saina-sidebar-fade-width: 160px');
    expect(css).toContain('saina-canvas::after');
    expect(css).toContain('rgba(12, 14, 14, 0.88)');
    expect(css).toContain('rgba(12, 14, 14, 0.72)');
    expect(css).toContain('rgba(12, 14, 14, 0.44)');
    expect(css).toContain('rgba(12, 14, 14, 0.16)');
    expect(css).toContain('width: 160px');
    expect(css).toContain('pointer-events: none');
    expect(css).not.toContain('saina-canvas::before');
    expect(css).not.toContain('width: 168px');
    expect(css).not.toContain('#101212 0%');
  });

  it('does not apply the sidebar fade outside the 900px desktop band', () => {
    const fadeBlock = css.slice(css.lastIndexOf('saina-canvas::after'));
    expect(css).toMatch(
      /@media \(min-width: 900px\) \{[\s\S]*\.saina-canvas::after/
    );
    expect(fadeBlock).not.toContain('@media (max-width: 899px)');
  });

  it('keeps subtle sidebar hairline and fixed width without layout drift', () => {
    expect(css).toContain('border-right: 1px solid rgba(232, 226, 215, 0.045)');
    expect(css).toContain('--saina-sidebar-width: 280px');
    const desktopSidebarIdx = css.indexOf('@media (min-width: 900px)');
    const sidebarBlock = css.slice(
      css.indexOf('.saina-app-root.saina-standalone-shell .saina-sidebar {', desktopSidebarIdx),
      css.indexOf('.saina-app-root.saina-standalone-shell .saina-sidebar::before', desktopSidebarIdx)
    );
    expect(sidebarBlock).toContain('width: var(--saina-sidebar-width)');
    expect(sidebarBlock).not.toContain('300px');
    expect(sidebarBlock).not.toContain('320px');
    expect(css).not.toContain('border-right: none !important');
  });

  it('detaches a 1100px atmosphere from the 650px text measure with long side dissolves', () => {
    expect(css).toContain('--saina-reading-atmosphere-width: min(1100px, 92%)');
    expect(css).toContain('--saina-chat-text-measure: min(650px, 100%)');
    expect(css).toContain('rgba(9, 11, 11, 0.58)');
    expect(css).toContain('rgba(9, 11, 11, 0.1)');
    expect(css).toContain('backdrop-filter: none !important');
    expect(css).toContain('content: none');
    expect(css).toContain('max-width: var(--saina-chat-text-measure)');
    expect(css).toContain('margin-inline: auto');
    expect(css).not.toContain('min(1480px');
    expect(css).not.toContain('mask-composite: intersect');
  });

  it('narrows the plane on 900–1279 and leaves Discover/pattern caps in mirror CSS', () => {
    expect(css).toContain('min-width: 900px) and (max-width: 1279px)');
    expect(css).toContain('780px');
    expect(mirror).toContain('.saina-discover-shell');
    expect(mirror).toContain('min(62vw, 720px)');
    expect(css).not.toContain('.saina-discover-shell');
  });

  it('does not restore a bronze chat card or change product wiring', () => {
    expect(css).not.toContain('rgba(231, 180, 91');
    expect(css).toContain('overflow: visible');
    expect(css).toContain('border-radius: 0');
    expect(shell).toContain('tryOpenMirror');
    expect(rail).toContain('onOpenAyna');
    expect(SAINA_COMPOSER_PLACEHOLDER).toBe('Kendi merakınla devam et…');
  });
});
