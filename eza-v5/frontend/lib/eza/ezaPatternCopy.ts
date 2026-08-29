/** EZA İlişki Haritası — inline info card copy (fixed product text). */

export const EZA_INFO_WHAT_IS = {
  title: 'EZA nedir?',
  paragraphs: [
    'İnsan ile yapay zekâ arasındaki etkileşimi anlamaya ve anlamlandırmaya çalışan bir altyapıdır.',
    'Yapay zekâ hayatımızın giderek daha büyük bir parçası olurken EZA, insanın onunla nasıl etkileşim kurduğunu ve bu ilişkinin zaman içinde nasıl şekillendiğini anlamaya çalışır.',
  ],
} as const;

export const EZA_INFO_CONTRIBUTION = {
  title: 'Sen nasıl katkı sağlıyorsun?',
  paragraphs: [
    "EZA'yı gönüllü olarak etkinleştirerek insan–AI etkileşiminin anlaşılmasına katkıda bulunursun.",
  ],
} as const;

export const EZA_INFO_WHAT_YOU_SEE = {
  title: 'Sen ne görüyorsun?',
  paragraphs: [
    'EZA da bu etkileşimin sende oluşturduğu desenleri İlişki Haritası, Trendler ve İçgörüler üzerinden görünür hale getirir.',
  ],
} as const;

export const EZA_INFO_FOOTER_LABEL = 'EZA hakkında daha fazla bilgi ↗';
export const EZA_INFO_FOOTER_URL = 'https://eza.global';
export const EZA_INFO_FOOTER_DOMAIN = 'eza.global';

/** @deprecated Use structured EZA_INFO_* constants — kept for legacy imports. */
export const EZA_INFO_DRAWER_SECTIONS = [
  EZA_INFO_WHAT_IS,
  EZA_INFO_CONTRIBUTION,
  EZA_INFO_WHAT_YOU_SEE,
] as const;

export const EZA_ACTIVATION_TITLE = 'EZA şu anda etkin değil';

export const EZA_ACTIVATION_BODY =
  'İnsan ile yapay zekâ arasındaki etkileşimi anlamaya ve anlamlandırmaya çalışan EZA’ya gönüllü olarak katkı sağla.';

export const EZA_ACTIVATION_CTA = "EZA'yı etkinleştir";
