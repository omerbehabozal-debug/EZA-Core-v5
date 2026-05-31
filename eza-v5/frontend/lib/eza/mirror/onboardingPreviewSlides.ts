/**
 * Onboarding slider slides — statik hedef görseller.
 * Gerçek poster pipeline ile eşleştirme sonraki sprintte yapılacak.
 */

export type OnboardingPreviewSlide = {
  id: string;
  src: string;
  alt: string;
  label: string;
};

export const ONBOARDING_PREVIEW_SLIDES: OnboardingPreviewSlide[] = [
  {
    id: 'recipe',
    src: '/mirror/onboarding-preview-recipe.png',
    alt: 'Örnek ayna kartı — Lezzetli ve sağlıklı bir gün',
    label: 'Lezzetli & Sağlıklı',
  },
  {
    id: 'panda',
    src: '/mirror/onboarding-preview-panda.png',
    alt: 'Örnek ayna kartı — Sakin Panda',
    label: 'Sakin Panda',
  },
  {
    id: 'wellness',
    src: '/mirror/onboarding-preview-wellness.png',
    alt: 'Örnek ayna kartı — Şefkatli Geyik',
    label: 'Şefkatli Geyik',
  },
  {
    id: 'compare',
    src: '/mirror/onboarding-preview-compare.png',
    alt: 'Örnek ayna kartı — Kıyasla ve netleştir',
    label: 'Kıyasla & Netleştir',
  },
];

/** @deprecated Tek görsel — slider için ONBOARDING_PREVIEW_SLIDES kullan. */
export const ONBOARDING_PREVIEW_IMAGE_LEGACY = ONBOARDING_PREVIEW_SLIDES[0].src;
