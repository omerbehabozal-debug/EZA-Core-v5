/**
 * EZA presentation tone — aynı sinyal, farklı sunum.
 * Governance: nötr denetçi · Standalone: samimi gözlemci
 *
 * Copy havuzu: observationCopyPools.ts (100+ varyasyon)
 */

import type {
  AiBehaviorCategoryId,
  UserObservationCategoryId,
} from '@/lib/eza/dailyObservation';
import {
  OBSERVATION_COPY_POOLS,
  RARE_WOW_INSIGHTS,
} from '@/lib/eza/observationCopyPools';

export type PresentationTone = 'governance' | 'standalone';

export type ToneVariants = { governance: string[]; standalone: string[] };

function pickVariant(variants: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 11)) | 0;
  }
  return variants[Math.abs(h) % variants.length]!;
}

export function pickToneCopy(
  tone: PresentationTone,
  variants: ToneVariants,
  seed: string
): string {
  return pickVariant(variants[tone], seed);
}

export const STANDALONE_SIGNAL_NOTE =
  'EZA mesaj metnini saklamaz; yalnızca bugünkü konuşmalardaki düşünme biçimine dair gözlemsel sinyaller üretir.';

export const GOVERNANCE_OBSERVATION_SUB =
  'Son etkileşim oturumundan çıkan kısa bir gözlem notu.';

export const STANDALONE_OBSERVATION_SUB =
  'Son konuşmalarından çıkan kısa bir etkileşim notu.';

export const MIRROR_LABELS: Record<
  PresentationTone,
  { user: string; ai: string; balance: string }
> = {
  governance: { user: 'Girdi', ai: 'Yanıt', balance: 'Denge' },
  standalone: { user: 'Sen', ai: 'AI', balance: 'Denge' },
};

const DEFAULT_WHY_BULLETS: Record<PresentationTone, string[]> = {
  governance: [
    'Son etkileşim oturumundaki soru yapısı',
    'AI yanıt tonu ve dengesi',
    'Gözlemsel etkileşim sinyalleri',
    'Son etkileşim deseni',
  ],
  standalone: [
    'Son konuşma tonu',
    'Soru yapısı',
    'AI yanıt dengesi',
    'Son etkileşim deseni',
  ],
};

export const USER_CATEGORY_LABEL_TONE: Record<UserObservationCategoryId, ToneVariants> = {
  balanced: {
    governance: ['Dengeli etkileşim'],
    standalone: ['Dengeli akış', 'Sakin düşünme akışı', 'Dengeli gün'],
  },
  decision_support: {
    governance: ['Karar desteği'],
    standalone: ['Karar öncesi netlik', 'Seçenekleri anlama', 'Karar desteği'],
  },
  clarity_seek: {
    governance: ['Netlik arayışı'],
    standalone: ['Netlik arayışı', 'Doğrulama odağı', 'Hedef odaklı akış'],
  },
  flow_harmony: {
    governance: ['Akış uyumu'],
    standalone: ['Uyumlu akış', 'Akıcı etkileşim', 'Akış uyumu'],
  },
  sensitive_signals: {
    governance: ['Hassas sinyaller'],
    standalone: ['Dikkatli ton', 'Hassas konu odağı', 'Hassas sinyaller'],
  },
  safe_balance: {
    governance: ['Güvenli denge'],
    standalone: ['Ölçülü ton', 'Dikkatli etkileşim', 'Güvenli denge'],
  },
  question_clarity: {
    governance: ['Soru netliği'],
    standalone: ['Net soru yapısı', 'Açık soru tonu', 'Soru netliği'],
  },
  exploration: {
    governance: ['Keşif odaklı'],
    standalone: ['Keşif & merak', 'Fikir geliştirme', 'Merak / keşif'],
  },
  creative_ideas: {
    governance: ['Fikir geliştirme'],
    standalone: ['Yaratıcı akış', 'Fikir geliştirme', 'Tasarlama odağı'],
  },
  intellectual_depth: {
    governance: ['Düşünsel yoğunluk'],
    standalone: ['Katmanlı akış', 'Derinleşme', 'Düşünsel yoğunluk'],
  },
  explanation_seek: {
    governance: ['Açıklama arayışı'],
    standalone: ['Gerekçe arayışı', 'Açıklama odağı', 'Açıklama arayışı'],
  },
  quiet: {
    governance: ['Sakin akış'],
    standalone: ['Sakin akış', 'Hafif ton', 'Dengeli gün'],
  },
};

export function categoryLabelForTone(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, USER_CATEGORY_LABEL_TONE[category], seed);
}

/** Ek denge varyasyonları — hassas split */
const BALANCE_SPLIT_EXTRA: Partial<Record<UserObservationCategoryId, ToneVariants>> = {
  sensitive_signals: {
      standalone: [
        'Hassas konularda bile konuşma dengesi korundu.',
        'Buna rağmen denge bozulmadan ilerledi.',
        'Hassas girişe rağmen akış güvenli kaldı.',
      ],
      governance: [
        'Hassas sinyale rağmen denge korundu.',
        'Riskli girişe rağmen denge stabil kaldı.',
      ],
    },
  safe_balance: {
    standalone: [
      'Riskli girişe rağmen yanıt dengesi bozulmadı.',
      'Hassas sinyale rağmen etkileşim dengesi korundu.',
    ],
    governance: ['Riskli girişe rağmen denge stabil kaldı.'],
  },
};

const AI_LINES: Record<AiBehaviorCategoryId, ToneVariants> = {
  explanatory: {
    governance: [
      'Yanıtlar daha açıklayıcı bir ton taşıyordu.',
      'AI yanıtları son oturumda daha açıklayıcı bir çizgide kaldı.',
      'Çıktılar açıklama yoğunluğu taşıdı.',
    ],
    standalone: [
      'AI daha açıklayıcı ve yön gösterici cevaplar vermeye yöneldi.',
      'Yanıtlar daha kısa ve açıklayıcı bir ton taşıyordu.',
      'Yanıtlar konuyu açan bir yapı kullandı.',
      'AI açıklama tarafını güçlendirdi.',
    ],
  },
  safe_boundary: {
    governance: [
      'Yanıtlar güvenli sınırlar içinde kaldı.',
      'AI yanıtlarında güvenli sınır vurgusu belirgin göründü.',
    ],
    standalone: [
      'Yanıtlar güvenli bir çizgide kaldı.',
      'Son oturumda yanıtlar ölçülü sınırlar içinde seyretti.',
      'AI güvenli çerçeveyi korudu.',
      'Yanıt tonu ölçülü sınırlar içinde ilerledi.',
    ],
  },
  low_redirect: {
    governance: [
      'AI yanıtlarında yönlendirme yoğunluğu düşük seyretti.',
      'Yanıtlarda yönlendirme etkisi düşük düzeyde kaldı.',
    ],
    standalone: [
      'Yanıtlarda yönlendirme baskısı düşük kaldı.',
      'Son konuşmalarda yönlendirme sinyali hafif seyretti.',
      'Yönlendirme yoğunluğu düşük görünüyordu.',
      'Yanıtlar yönlendirme baskısı oluşturmadı.',
    ],
  },
  suggestion_density: {
    governance: [
      'Bazı yanıtlarda öneri dili daha belirgin göründü.',
      'Bazı yanıtlarda daha güçlü öneri tonu gözlemlendi.',
    ],
    standalone: [
      'Bazı yanıtlarda öneri tonu biraz daha belirgindi.',
      'Son oturumda yönlendirici bir yanıt tonu ara sıra öne çıktı.',
      'Öneri dili kısa süreli belirdi.',
      'Yanıtlarda öneri yoğunluğu orta seyretti.',
    ],
  },
  balanced_refusal: {
    governance: [
      'AI hassas girişlerde dengeli bir sınır çizdi.',
      'Hassas girişlerde yanıt dengesi korunmuş görünüyor.',
    ],
    standalone: [
      'Hassas konularda yanıtlar dengeli bir sınır korudu.',
      'Son oturumda yanıtlar ölçülü bir denge taşıdı.',
      'AI hassas girişlerde ölçülü sınır korudu.',
      'Yanıtlar reddetmeden güvenli çerçeve kurdu.',
    ],
  },
  high_alignment: {
    governance: [
      'Yanıtlar soru bağlamıyla yüksek uyum gösterdi.',
      'AI yanıtlarında uyum sinyali yüksek seyretti.',
    ],
    standalone: [
      'Yanıtlar soru yapınla yüksek uyum gösterdi.',
      'AI yanıtları bağlamla uyumlu kaldı.',
      'Uyum sinyali güçlü seyretti.',
      'Yanıtlar konuşma ritmine iyi eşlik etti.',
    ],
  },
  neutral_tone: {
    governance: [
      'AI yanıtları nötr ve dengeli bir çizgide kaldı.',
      'Yanıtlar sakin ve ölçülü bir ton taşıdı.',
    ],
    standalone: [
      'Yanıtlar sakin ve dengeli bir ton taşıdı.',
      'Son oturumda ölçülü bir yanıt çizgisi gözlemlendi.',
      'Yanıt tonu nötr ve dengeli kaldı.',
      'AI konuşmanın ritmini dengede tuttu.',
    ],
  },
  sensitive_balance: {
    governance: [
      'AI yanıtları hassas sinyallere rağmen dengeyi korudu.',
      'Yanıtlar hassas girişlere rağmen güvenli sınırlarda kaldı.',
    ],
    standalone: [
      'Hassas konularda yanıtlar dengeyi korudu.',
      'Son oturumda yanıtlar dikkatli ama akıcı kaldı.',
      'AI hassas girişlerde güvenli sınırları korudu.',
      'Yanıtlar hassas noktalarda kontrollü kaldı.',
    ],
  },
};

function poolFor(category: UserObservationCategoryId) {
  return OBSERVATION_COPY_POOLS[category];
}

export function userObservationLine(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, poolFor(category).user, seed);
}

/** Standalone: kullanıcı kategorisine göre AI satırı; governance: davranış kategorisi */
export function aiObservationLine(
  category: AiBehaviorCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, AI_LINES[category], `${seed}-ai`);
}

export function aiObservationLineForUserCategory(
  userCategory: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string,
  fallbackAiCategory: AiBehaviorCategoryId = 'neutral_tone'
): string {
  if (tone === 'standalone') {
    return pickToneCopy(tone, poolFor(userCategory).ai, `${seed}-ai-u`);
  }
  return aiObservationLine(fallbackAiCategory, tone, seed);
}

export function observationSupportLine(tone: PresentationTone): string {
  return tone === 'standalone'
    ? 'Bu, son konuşmalarındaki düşünme biçimine dair kısa bir gözlem notu.'
    : 'Bu gözlem son etkileşim oturumundaki soru yapısı, AI yanıt tonu ve dengeye dayanır.';
}

export function primaryInsightForCategory(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, poolFor(category).primaryInsight, `${seed}-hero`);
}

export function balanceObservationLine(
  userCat: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string,
  options?: { split?: boolean }
): string | null {
  const splitExtra = BALANCE_SPLIT_EXTRA[userCat];
  if (options?.split && splitExtra) {
    return pickToneCopy(tone, splitExtra, `${seed}-bal-split`);
  }
  return pickToneCopy(tone, poolFor(userCat).balance, `${seed}-bal`);
}

export function whyShownBullets(tone: PresentationTone): string[] {
  return DEFAULT_WHY_BULLETS[tone];
}

export function whyShownBulletsForCategory(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string[] {
  const sets = poolFor(category).whyBulletSets[tone];
  if (!sets.length) return DEFAULT_WHY_BULLETS[tone];
  let h = 0;
  const s = `${seed}-why-set`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 13)) | 0;
  }
  const picked = sets[Math.abs(h) % sets.length]!;
  return [...picked, DEFAULT_WHY_BULLETS[tone][2]!, DEFAULT_WHY_BULLETS[tone][3]!];
}

/** Nadiren — seed ile deterministik (~1/6 oturum) */
export function rareWowInsight(
  tone: PresentationTone,
  seed: string,
  enabled: boolean
): string | null {
  if (!enabled) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * 7) | 0;
  }
  if (Math.abs(h) % 6 !== 0) return null;
  return pickToneCopy(tone, RARE_WOW_INSIGHTS, `${seed}-wow`);
}

export const PRIORITY_ALERT_HEADLINES: ToneVariants = {
  standalone: [
    'Son konuşmada dikkat gerektiren bir giriş sinyali gözlemlendi.',
    'Bazı girişlerde hassas bir ton öne çıktı — önce bu hatırlatılıyor.',
    'Son etkileşimde olumsuz veya hassas bir girdi sinyali belirdi.',
    'Dikkat gerektiren bir giriş sinyali önce hatırlatılıyor.',
  ],
  governance: [
    'Son oturumda hassas girdi sinyali gözlemlendi.',
    'Dikkat gerektiren girdi sinyali öncelikli olarak işaretlendi.',
  ],
};

export const PRIORITY_ALERT_DETAILS: ToneVariants = {
  standalone: [
    'Bu, son konuşmalardaki tek bir girişten gelen gözlemsel bir uyarıdır; yargı değildir.',
    'Sohbetteki diğer mesajlar daha sakin olsa bile bu sinyal önce hatırlatılır.',
    'Aşağıdaki özet genel akış içindir; hassas giriş ayrıca kaydedildi.',
    'Genel akış aşağıda; bu tespit öncelikli olarak not edildi.',
  ],
  governance: [
    'Tekil hassas giriş tespiti — genel oturum özeti aşağıdadır.',
    'Ortalama düşük olsa bile belirgin girdi sinyali önceliklidir.',
  ],
};

export function observationManset(
  userCat: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string,
  fallback: string
): string {
  const m = poolFor(userCat).manset;
  if (m) return pickToneCopy(tone, m, `${seed}-m-user`);
  return fallback;
}
