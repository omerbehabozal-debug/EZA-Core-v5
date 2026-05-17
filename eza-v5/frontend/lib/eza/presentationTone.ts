/**
 * EZA presentation tone — aynı sinyal, farklı sunum.
 * Governance: nötr denetçi · Standalone: samimi gözlemci
 *
 * Kural: kişisel hissettir, kişilik tanımı yapma.
 * Yasak: "sen şöylesin", ruh hali yargısı, psikolojik etiket.
 */

import type {
  AiBehaviorCategoryId,
  UserObservationCategoryId,
} from '@/lib/eza/dailyObservation';

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

export const WHY_SHOWN_BULLETS: Record<PresentationTone, string[]> = {
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

export const USER_CATEGORY_LABEL_TONE: Record<
  UserObservationCategoryId,
  ToneVariants
> = {
  balanced: {
    governance: ['Dengeli etkileşim'],
    standalone: ['Dengeli akış', 'Sakin düşünme akışı'],
  },
  decision_support: {
    governance: ['Karar desteği'],
    standalone: ['Karar öncesi netlik', 'Seçenekleri anlama'],
  },
  clarity_seek: {
    governance: ['Netlik arayışı'],
    standalone: ['Netlik arayışı', 'Doğrulama odağı'],
  },
  flow_harmony: {
    governance: ['Akış uyumu'],
    standalone: ['Uyumlu akış', 'Akıcı etkileşim'],
  },
  sensitive_signals: {
    governance: ['Hassas sinyaller'],
    standalone: ['Dikkatli ton', 'Hassas konu odağı'],
  },
  safe_balance: {
    governance: ['Güvenli denge'],
    standalone: ['Ölçülü ton', 'Dikkatli etkileşim'],
  },
  question_clarity: {
    governance: ['Soru netliği'],
    standalone: ['Net soru yapısı', 'Açık soru tonu'],
  },
  exploration: {
    governance: ['Keşif odaklı'],
    standalone: ['Keşif & merak', 'Fikir geliştirme'],
  },
  quiet: {
    governance: ['Sakin akış'],
    standalone: ['Sakin akış', 'Hafif ton'],
  },
};

export function categoryLabelForTone(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, USER_CATEGORY_LABEL_TONE[category], seed);
}

const USER_LINES: Record<UserObservationCategoryId, ToneVariants> = {
  balanced: {
    governance: [
      'Son etkileşimlerde denge stabil göründü.',
      'Son konuşmalar genel profille uyumlu seyretti.',
    ],
    standalone: [
      'Son konuşmalarda dengeli bir düşünme akışı öne çıktı.',
      'Bugünkü etkileşimler sakin ve ölçülü bir çizgide kaldı.',
    ],
  },
  decision_support: {
    governance: [
      'Son etkileşimlerde karar desteği arayışı öne çıktı.',
      'Son konuşmalarda karar öncesi netlik arayışı gözlemlendi.',
    ],
    standalone: [
      'Bugün bazı konularda yön bulmaya çalışıyor gibiydin.',
      'Karar vermeden önce seçenekleri tartıyor gibiydin.',
      'Bazı sorular karar öncesi netlik arayışı taşıyordu.',
    ],
  },
  clarity_seek: {
    governance: [
      'Son etkileşimlerde netlik arayışı öne çıktı.',
      'Son konuşmalarda doğrulama ve netlik sinyalleri belirginleşti.',
    ],
    standalone: [
      'Bugün cevaplardan çok netlik almaya çalışıyor gibiydin.',
      'Bugünkü sorular daha doğrudan ve net bir yapıdaydı.',
      'Bazı sorularında hızlı açıklık arayışı dikkat çekiyordu.',
    ],
  },
  flow_harmony: {
    governance: [
      'Son etkileşimlerde yanıtlarla uyum yüksek seyretti.',
      'Son oturumda akış uyumu belirgin bir ton taşıdı.',
    ],
    standalone: [
      'Bugünkü konuşmalarda akış oldukça doğal ilerledi.',
      'Son konuşmalarda uyum sinyali güçlü kaldı.',
    ],
  },
  sensitive_signals: {
    governance: [
      'Son etkileşimlerde hassas konu sinyalleri daha belirgin göründü.',
      'Son oturumda hassas sinyal yoğunluğu dikkat çekti.',
    ],
    standalone: [
      'Bazı konularda daha dikkatli bir konuşma tonu vardı.',
      'Bugün bazı girişlerde dikkat gerektiren sinyaller oluştu.',
    ],
  },
  safe_balance: {
    governance: [
      'Hassas konu sinyali gözlemlendi.',
      'Son oturumda girdi tarafında dikkat çeken sinyaller göründü.',
    ],
    standalone: [
      'Bazı konularda daha ölçülü bir soru tonu gözlemlendi.',
      'Son oturumda dikkatli bir etkileşim çizgisi öne çıktı.',
    ],
  },
  question_clarity: {
    governance: [
      'Son sorular daha doğrudan ve net bir yapıdaydı.',
      'Son oturumda soru netliği odaklı bir ton seyretti.',
    ],
    standalone: [
      'Bugünkü sorular daha doğrudan ve net bir yapı taşıyordu.',
      'Son konuşmalarda soru netliği sinyali belirgindi.',
    ],
  },
  exploration: {
    governance: [
      'Son konuşmalar daha çok fikir geliştirme yönünde ilerledi.',
      'Son oturumda keşif odaklı bir etkileşim tonu gözlemlendi.',
    ],
    standalone: [
      'Bugünkü konuşmalarda yeni fikirleri keşfetme isteği daha belirgindi.',
      'Bugün cevaplardan çok yeni bakış açıları arıyor gibiydin.',
      'Bazı sorularında merak duygusu daha baskındı.',
    ],
  },
  quiet: {
    governance: [
      'Belirgin bir kullanıcı sinyali sapması gözlemlenmedi.',
      'Son etkileşimler sakin ve dengeli bir çizgide kaldı.',
    ],
    standalone: [
      'Bugünkü konuşmalar genel akışınla uyumlu görünüyordu.',
      'Belirgin bir sapma gözlemlenmedi.',
    ],
  },
};

/** Ana hero insight — merak uyandıran tek cümle */
const PRIMARY_INSIGHT: Record<UserObservationCategoryId, ToneVariants> = {
  balanced: {
    governance: ['Denge stabil görünüyor.'],
    standalone: [
      'Son konuşmalarda dengeli ve sakin bir düşünme akışı öne çıkıyordu.',
      'Konuşmaların genel çizgisi ölçülü ve dengeli ilerledi.',
    ],
  },
  decision_support: {
    governance: ['Karar desteği arayışı belirginleşti.'],
    standalone: [
      'Bugün cevaplardan çok yön bulmaya çalışıyor gibiydin.',
      'Karar öncesi netlik arayışı bugün daha belirgindi.',
    ],
  },
  clarity_seek: {
    governance: ['Netlik arayışı öne çıktı.'],
    standalone: [
      'Bugün cevaplardan çok netlik almaya çalışıyor gibiydin.',
      'Sorularında hızlı açıklık arayışı dikkat çekiyordu.',
    ],
  },
  flow_harmony: {
    governance: ['Akış uyumu yüksek seyretti.'],
    standalone: [
      'Konuşma akışı doğal ve uyumlu ilerliyordu.',
      'Bugünkü etkileşimlerde akış sinyali güçlü kaldı.',
    ],
  },
  sensitive_signals: {
    governance: ['Hassas sinyal yoğunluğu dikkat çekti.'],
    standalone: [
      'Bazı konularda daha ölçülü ve dikkatli bir ton öne çıkıyordu.',
      'Hassas konularda konuşma tonu daha temkinliydi.',
    ],
  },
  safe_balance: {
    governance: ['Güvenli denge sinyali görüldü.'],
    standalone: [
      'Ölçülü bir konuşma tonu bugün daha belirgindi.',
      'Dikkatli ama akıcı bir etkileşim çizgisi vardı.',
    ],
  },
  question_clarity: {
    governance: ['Soru netliği odaklı ton.'],
    standalone: [
      'Soruların bugün daha net ve hedef odaklı bir yapı taşıyordu.',
      'Doğrudan netlik arayışı öne çıkıyordu.',
    ],
  },
  exploration: {
    governance: ['Keşif odaklı etkileşim.'],
    standalone: [
      'Bugünkü konuşmalarda merak ve keşif sinyali daha belirgindi.',
      'Yeni ihtimaller arayışı bugün öne çıkıyordu.',
    ],
  },
  quiet: {
    governance: ['Sakin etkileşim akışı.'],
    standalone: [
      'Sakin ve dengeli bir konuşma çizgisi sürdü.',
      'Belirgin bir ton sapması oluşmadı.',
    ],
  },
};

type BalanceLineEntry = ToneVariants & { split?: ToneVariants };

const BALANCE_LINES: Partial<Record<UserObservationCategoryId, BalanceLineEntry>> = {
  decision_support: {
    standalone: [
      'Karar arayışına rağmen etkileşim dengesi korundu.',
      'Buna rağmen konuşma dengesi stabil kaldı.',
    ],
    governance: ['Karar arayışına yanıt tonu uyumlu kaldı.'],
  },
  exploration: {
    standalone: [
      'Konuşma akışı keşif odaklı ama dengeli ilerledi.',
      'Merak sinyaline rağmen denge korundu.',
    ],
    governance: ['Keşif tonu dengeli kaldı.'],
  },
  clarity_seek: {
    standalone: ['Konuşma akışı hedef odaklı ilerledi.'],
    governance: ['Netlik arayışı dengeli seyretti.'],
  },
  sensitive_signals: {
    standalone: [
      'Hassas sinyallere rağmen konuşma dengesi korundu.',
      'Buna rağmen etkileşim dengesi stabil kaldı.',
    ],
    governance: ['Hassas sinyallere rağmen denge korundu.'],
    split: {
      standalone: [
        'Hassas konularda bile konuşma dengesi korundu.',
        'Buna rağmen denge bozulmadan ilerledi.',
      ],
      governance: ['Hassas sinyale rağmen denge korundu.'],
    },
  },
  flow_harmony: {
    standalone: ['Etkileşim tonu stabil ve dengeli kaldı.'],
    governance: ['Etkileşim dengesi stabil kaldı.'],
  },
  balanced: {
    standalone: ['Belirgin bir sapma gözlemlenmedi.', 'Konuşma dengesi stabil kaldı.'],
    governance: ['Etkileşim dengesi stabil kaldı.'],
  },
  quiet: {
    standalone: ['Belirgin bir sapma gözlemlenmedi.'],
    governance: ['Denge stabil kaldı.'],
  },
};

const AI_LINES: Record<AiBehaviorCategoryId, ToneVariants> = {
  explanatory: {
    governance: [
      'Yanıtlar daha açıklayıcı bir ton taşıyordu.',
      'AI yanıtları son oturumda daha açıklayıcı bir çizgide kaldı.',
    ],
    standalone: [
      'AI daha açıklayıcı ve yön gösterici cevaplar vermeye yöneldi.',
      'Yanıtlar daha kısa ve açıklayıcı bir ton taşıyordu.',
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
    ],
  },
};

export function userObservationLine(
  category: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, USER_LINES[category], seed);
}

export function aiObservationLine(
  category: AiBehaviorCategoryId,
  tone: PresentationTone,
  seed: string
): string {
  return pickToneCopy(tone, AI_LINES[category], `${seed}-ai`);
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
  return pickToneCopy(tone, PRIMARY_INSIGHT[category], `${seed}-hero`);
}

export function balanceObservationLine(
  userCat: UserObservationCategoryId,
  tone: PresentationTone,
  seed: string,
  options?: { split?: boolean }
): string | null {
  const entry = BALANCE_LINES[userCat];
  if (!entry) return null;
  if (options?.split && entry.split) {
    return pickToneCopy(tone, entry.split, `${seed}-bal-split`);
  }
  return pickToneCopy(tone, entry, `${seed}-bal`);
}

export function whyShownBullets(tone: PresentationTone): string[] {
  return WHY_SHOWN_BULLETS[tone];
}

export const PRIORITY_ALERT_HEADLINES: ToneVariants = {
  standalone: [
    'Son konuşmada dikkat gerektiren bir giriş sinyali gözlemlendi.',
    'Bazı girişlerde hassas bir ton öne çıktı — önce bu hatırlatılıyor.',
    'Son etkileşimde olumsuz veya hassas bir girdi sinyali belirdi.',
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
  const shorts: Partial<Record<UserObservationCategoryId, ToneVariants>> = {
    decision_support: {
      governance: ['Karar desteği öne çıktı.', 'Karar arayışı belirginleşti.'],
      standalone: ['Karar öncesi netlik öne çıktı.', 'Seçenekleri anlama odağı belirdi.'],
    },
    clarity_seek: {
      governance: ['Netlik arayışı öne çıktı.'],
      standalone: ['Netlik arayışı öne çıktı.', 'Bugün netlik sinyali belirgindi.'],
    },
    exploration: {
      governance: ['Keşif tonu öne çıktı.'],
      standalone: ['Keşif tonu öne çıktı.', 'Merak sinyali belirgindi.'],
    },
    sensitive_signals: {
      governance: ['Hassas sinyal dikkat çekti.'],
      standalone: ['Dikkatli ton öne çıktı.', 'Hassas konu sinyali belirdi.'],
    },
    balanced: {
      governance: ['Denge korundu.', 'Dengeli bir oturum.'],
      standalone: ['Dengeli bir akış.', 'Sakin bir düşünme çizgisi.'],
    },
    quiet: {
      governance: ['Sakin bir etkileşim akışı.'],
      standalone: ['Sakin bir konuşma akışı.'],
    },
  };
  const v = shorts[userCat];
  if (v) return pickToneCopy(tone, v, `${seed}-m-user`);
  return fallback;
}
