import { describe, expect, it } from 'vitest';
import { splitSainaMessageIntoBlocks } from '@/lib/eza/sainaMessageBlocks';

describe('splitSainaMessageIntoBlocks', () => {
  it('returns a single paragraph for short text', () => {
    expect(splitSainaMessageIntoBlocks('Selam')).toEqual([
      { type: 'paragraph', text: 'Selam' },
    ]);
  });

  it('splits explicit double-newline paragraphs', () => {
    expect(
      splitSainaMessageIntoBlocks('İlk paragraf.\n\nİkinci paragraf.')
    ).toEqual([
      { type: 'paragraph', text: 'İlk paragraf.' },
      { type: 'paragraph', text: 'İkinci paragraf.' },
    ]);
  });

  it('groups bullet lines into a list block', () => {
    expect(
      splitSainaMessageIntoBlocks('Özet:\n\n- Birinci madde\n- İkinci madde')
    ).toEqual([
      { type: 'paragraph', text: 'Özet:' },
      { type: 'list', items: ['Birinci madde', 'İkinci madde'] },
    ]);
  });

  it('splits long single-block text into sentence groups', () => {
    const longText =
      'Bu birinci cümle ve biraz daha uzun bir ifade. Bu ikinci cümle yine açıklayıcı. ' +
      'Bu üçüncü cümle devam ediyor. Bu dördüncü cümle akışı sürdürüyor. ' +
      'Bu beşinci cümle önemli bir nokta. Bu altıncı cümle kapanışa hazırlanıyor. ' +
      'Bu yedinci cümle son düşünceyi taşıyor. Bu sekizinci cümle tamamlayıcı.';

    const blocks = splitSainaMessageIntoBlocks(longText);
    expect(blocks.every((block) => block.type === 'paragraph')).toBe(true);
    expect(blocks.length).toBeGreaterThan(1);
  });
});
