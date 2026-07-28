import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isSainaNewChatRequest,
  SAINA_DISCOVER_ROUTE,
  SAINA_NEW_CHAT_ROUTE,
} from '@/lib/eza/sainaRoutes';

const sidebarSrc = readFileSync(
  join(process.cwd(), 'components/saina/SainaConversationSidebar.tsx'),
  'utf8'
);
const chatSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
  'utf8'
);

describe('SAINA sidebar home order — Keşfet first', () => {
  it('exposes Keşfet home and explicit new-chat routes', () => {
    expect(SAINA_DISCOVER_ROUTE).toBe('/standalone/discover');
    expect(SAINA_NEW_CHAT_ROUTE).toBe('/standalone?new=1');
    expect(isSainaNewChatRequest('new=1')).toBe(true);
    expect(isSainaNewChatRequest('?new=1')).toBe(true);
    expect(isSainaNewChatRequest('chat=abc')).toBe(false);
  });

  it('places Keşfet above Yeni sohbet, EZA only in bottom dock', () => {
    const top = sidebarSrc.split('saina-sidebar-top')[1]?.split('saina-conv-list')[0] ?? '';
    const dock = sidebarSrc.split('className="saina-sidebar-dock"')[1]?.split('</nav>')[0] ?? '';

    expect(top.indexOf('saina-discover-nav')).toBeGreaterThan(-1);
    expect(top.indexOf('saina-new-chat-btn')).toBeGreaterThan(top.indexOf('saina-discover-nav'));
    expect(dock).toContain('saina-pattern-nav');
    expect(dock).not.toContain('saina-discover-nav');
    expect(top).not.toContain('saina-pattern-nav');
  });

  it('bare /standalone without chat or new redirects to Keşfet', () => {
    expect(chatSrc).toContain('SAINA_DISCOVER_ROUTE');
    expect(chatSrc).toContain('isSainaNewChatRequest');
    expect(chatSrc).toMatch(
      /router\.replace\(SAINA_DISCOVER_ROUTE[\s\S]*isSainaNewChatRequest|isSainaNewChatRequest[\s\S]*router\.replace\(SAINA_DISCOVER_ROUTE/
    );
  });
});
