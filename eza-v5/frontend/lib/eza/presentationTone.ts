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
  'Son sohbetlerinden çıkan kısa bir düşünme biçimi notu — yargı değil, gözlem.';

export const MIRROR_LABELS: Record<
  PresentationTone,
  { user: string; ai: string; balance: string }
> = {
  governance: { user: 'Girdi', ai: 'Yanıt', balance: 'Denge' },
  standalone: { user: 'Konuşma tonu', ai: 'Yanıt tonu', balance: 'Denge' },
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
      'Bazı sorular karar öncesi netlik arayışı taşıyordu.',
      'Son konuşmalarda seçenekleri netleştirme eğilimi belirgindi.',
    ],
  },
  clarity_seek: {
    governance: [
      'Son etkileşimlerde netlik arayışı öne çıktı.',
      'Son konuşmalarda doğrulama ve netlik sinyalleri belirginleşti.',
    ],
    standalone: [
      'Bugünkü sorular daha çok netlik arayışı taşıyordu.',
      'Son konuşmalarda doğrulama ve netlik sinyalleri öne çıktı.',
    ],
  },
  flow_harmony: {
    governance: [
      'Son etkileşimlerde yanıtlarla uyum yüksek seyretti.',
      'Son oturumda akış uyumu belirgin bir ton taşıdı.',
    ],
    standalone: [
      'Son konuşmalarda akıcı bir düşünme akışı gözlemlendi.',
      'Bugünkü etkileşimlerde uyum sinyali güçlü kaldı.',
    ],
  },
  sensitive_signals: {
    governance: [
      'Son etkileşimlerde hassas konu sinyalleri daha belirgin göründü.',
      'Son oturumda hassas sinyal yoğunluğu dikkat çekti.',
    ],
    standalone: [
      'Bazı konularda daha dikkatli bir etkileşim tonu gözlemlendi.',
      'Son oturumda hassas konu sinyalleri daha belirgin göründü.',
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
      'Bugünkü etkileşimler daha çok fikir geliştirme yönünde ilerledi.',
    ],
  },
  quiet: {
    governance: [
      'Belirgin bir kullanıcı sinyali sapması gözlemlenmedi.',
      'Son etkileşimler sakin ve dengeli bir çizgide kaldı.',
    ],
    standalone: [
      'Belirgin bir düşünme biçimi sapması gözlemlenmedi.',
      'Son konuşmalar sakin ve dengeli bir çizgide kaldı.',
    ],
  },
};

const AI_LINES: Record<AiBehaviorCategoryId, ToneVariants> = {
  explanatory: {
    governance: [
      'Yanıtlar daha açıklayıcı bir ton taşıyordu.',
      'AI yanıtları son oturumda daha açıklayıcı bir çizgide kaldı.',
    ],
    standalone: [
      'Yanıtlar bugün daha açıklayıcı bir ton taşıdı.',
      'Son oturumda anlatım odaklı bir yanıt çizgisi öne çıktı.',
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
      'Yanıtlar soru bağlamıyla uyumlu kaldı.',
      'Son konuşmalarda uyum sinyali güçlü seyretti.',
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
    ? 'Bu not, son sohbetlerindeki soru yapısı, yanıt tonu ve denge sinyallerine dayanır — yargı değil, gözlem.'
    : 'Bu gözlem son etkileşim oturumundaki soru yapısı, AI yanıt tonu ve dengeye dayanır.';
}

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
