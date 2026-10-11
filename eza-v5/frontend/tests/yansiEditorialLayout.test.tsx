import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import YansiEditorialBody from '@/components/mirror-landing/YansiEditorialBody';
import { captureReadingAnchor, restoreReadingAnchor } from '@/lib/eza/mirror/yansiReadingAnchor';

describe('desktop editorial layout boundary', () => {
  it('preserves flattened source without inventing sections when metadata is absent', () => {
    const text = 'Birinci düşünce. İkinci düşünce. 1. Eski düzleştirilmiş liste.';
    render(<YansiEditorialBody text={text} isUser={false} />);
    expect(screen.getByTestId('yansi-editorial-answer').textContent).toBe(text);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText('01')).toBeNull();
  });
  it('uses editorial question presentation before metadata becomes ready', () => {
    render(<YansiEditorialBody text="Orijinal soru?" isUser />);
    expect(screen.getByTestId('yansi-editorial-question').textContent).toBe('Orijinal soru?');
    expect(screen.getByTestId('yansi-editorial-question').querySelector('.yansi-editorial-heading__number')).toBeNull();
  });
  it('anchors the first visible turn across wrapping changes instead of preserving stale scrollTop', () => {
    const root = document.createElement('div');
    const hidden = document.createElement('article'); const visible = document.createElement('article');
    hidden.className = visible.className = 'saina-msg-row'; root.append(hidden, visible);
    root.getBoundingClientRect = () => ({ top: 100, bottom: 500 } as DOMRect);
    hidden.getBoundingClientRect = () => ({ top: -100, bottom: 80 } as DOMRect);
    let top = 120;
    visible.getBoundingClientRect = () => ({ top, bottom: top + 240 } as DOMRect);
    root.scrollTop = 300;
    const anchor = captureReadingAnchor(root);
    expect(anchor?.turn).toBe(visible);
    top = 190; restoreReadingAnchor(anchor);
    expect(root.scrollTop).toBe(370);
    top = 50; restoreReadingAnchor(captureReadingAnchor(root));
    expect(root.scrollTop).toBe(370);
  });
  it('uses pixel fallback only when no visible turn survives', () => {
    const root = document.createElement('div'); root.scrollTop = 125;
    const anchor = captureReadingAnchor(root); root.scrollTop = 0;
    restoreReadingAnchor(anchor); expect(root.scrollTop).toBe(125);
    expect(captureReadingAnchor(null)).toBeNull();
  });
  it('isolates expanded geometry from standard, mobile and composer styles and bounds code overflow', () => {
    const css = postcss.parse(readFileSync(resolve('styles/saina-yansi-desktop.css'), 'utf8'));
    let expanded = false; let code = false;
    css.walkRules((rule) => {
      rule.walkDecls('--yansi-editorial-width', (decl) => {
        expect(rule.selector).toContain("[data-reading-mode='editorial']");
        expect(rule.parent?.type).toBe('atrule');
        expect((rule.parent as postcss.AtRule).params).toBe('(min-width: 900px)');
        expect(decl.value).toBe('720px');
        expect(rule.selector).not.toContain('composer'); expanded = true;
      });
      if (rule.selector.includes('editorial') && rule.selector.includes('yansi-editorial-answer pre')) {
        const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [(node as postcss.Declaration).prop, (node as postcss.Declaration).value]));
        expect(declarations['max-width']).toBe('100%');
        expect(declarations['overflow-x']).toBe('auto'); code = true;
      }
    });
    expect(expanded && code).toBe(true);
  });
});
