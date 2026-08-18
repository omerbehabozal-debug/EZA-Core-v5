/** SAINA Keşfet — product language (not social feed). */

export const SAINA_DISCOVER_TITLE = 'Keşfet';

export const SAINA_DISCOVER_NAV_BODY = 'Dünyanın merak ettiği Aynalar';

export const SAINA_DISCOVER_NAV_CTA = 'Keşfet →';

export const SAINA_DISCOVER_HERO_LINE_1 = 'Bugün dünyanın en ilginç merakları';

export const SAINA_DISCOVER_HERO_LINE_2 = 'Bir merak seç.';

export const SAINA_DISCOVER_HERO_LINE_3 = 'Kendi yolculuğunu başlat.';

export const SAINA_DISCOVER_CTA = 'Bu konuyu ben de merak ediyorum';

export const SAINA_DISCOVER_LIMIT_CTA = 'Hesabını Yükselt →';

export const SAINA_DISCOVER_EMPTY_TITLE = 'Henüz keşfedilecek Ayna yok.';

export const SAINA_DISCOVER_EMPTY_BODY = 'İlk Aynayı sen oluştur.';

export const SAINA_DISCOVER_ERROR = 'Keşfet şu anda yüklenemedi.';

export const SAINA_DISCOVER_ERROR_RETRY = 'Lütfen biraz sonra tekrar dene.';

export const SAINA_DISCOVER_MODE_RASTLANTISAL = 'Rastlantısal';

export const SAINA_DISCOVER_MODE_STRONG_CURIOSITY = 'Güçlü Merak';

export const SAINA_DISCOVER_MODE_NEWEST = 'En Yeni';

export const SAINA_DISCOVER_STRONG_CURIOSITY_TITLE = 'Güçlü Merak şu anda kullanılamıyor.';

export const SAINA_DISCOVER_STRONG_CURIOSITY_BODY =
  'Rastlantısal veya En Yeni ile bakabilirsin.';

export const SAINA_DISCOVER_INVALID_MODE = 'Bu Keşfet görünümü geçerli değil.';

export const SAINA_DISCOVER_MORE_ERROR = 'Daha fazla Yansı şu an yüklenemedi.';

export const SAINA_DISCOVER_MORE_RETRY = 'Tekrar dene';

export function formatDiscoverYansiCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n.toLocaleString('tr-TR')} Yansı`;
}
