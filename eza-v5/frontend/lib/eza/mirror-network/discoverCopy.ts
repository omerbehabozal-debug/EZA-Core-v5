/** SAINA Keşfet — product language (not social feed). */

export const SAINA_DISCOVER_TITLE = 'Keşfet';

export const SAINA_DISCOVER_NAV_BODY = 'Dünyanın merak ettiği Aynalar';

export const SAINA_DISCOVER_NAV_CTA = 'Keşfet →';

export const SAINA_DISCOVER_HERO_LINE_1 = 'Bugün dünyanın en ilginç merakları';

export const SAINA_DISCOVER_HERO_LINE_2 =
  'Başkalarının başlattığı sohbetleri keşfet, kendi yolculuğunu başlat.';

export const SAINA_DISCOVER_CTA = 'Bu sohbete katıl →';

export const SAINA_DISCOVER_EMPTY_TITLE = 'Henüz keşfedilecek Ayna yok.';

export const SAINA_DISCOVER_EMPTY_BODY = 'İlk Aynayı sen oluştur.';

export const SAINA_DISCOVER_ERROR = 'Keşfet şu anda yüklenemedi.';

export const SAINA_DISCOVER_ERROR_RETRY = 'Lütfen biraz sonra tekrar dene.';

export function formatDiscoverYansiCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n.toLocaleString('tr-TR')} Yansı`;
}
