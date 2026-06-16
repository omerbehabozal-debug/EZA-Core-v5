/**
 * V3.1 — meaning-only mirror copy (no topic names, no conversation meta).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';
import type { NarrativeDistanceLevel } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';

const MEANING_COPY_BY_TOPIC: Record<StoryTopicId, { distance2: string[]; distance3: string[] }> = {
  travel: {
    distance2: [
      'Uzak bir ufuk açılıyor; tanıdık olmayan güzellik merakı büyütüyor. Mesafe bir engel değil, iç sesin önce yola çıktığı bir kapı.',
      'Bir ritim uzaktan duyuluyor; varış noktası değil, deneyimin dokusu öne çıkıyor.',
    ],
    distance3: [
      'Altın bir ufukta duran bir figür — merak, mesafe ve henüz adı konmamış bir güzellik.',
      'Boş bir patikada fener ışığı; keşif, dinginlik ve uzaktan gelen bir parıltı.',
    ],
  },
  vehicle: {
    distance2: [
      'İki yol aynı terazide duruyor; konfor, kalite ve uzun vadeli his aynı sessiz ölçüde tartılıyor.',
      'Yansımalar metalde birleşiyor; seçim yüzeyde değil, hangi dünyanın daha uzun süre iyi hissettirdiğinde.',
    ],
    distance3: [
      'Sessiz bir salonda iki ışık bandı — karar, denge ve premium bir sakinlik.',
      'Parlak metalde sıcak yansımalar; terazi henüz eğilmemiş.',
    ],
  },
  architecture: {
    distance2: [
      'Işık bir yapının yüzünde kalıcı bir iz bırakıyor. Form, malzeme ve zaman aynı sessiz cümlede buluşuyor.',
      'Bir mekânın zaman içinde nasıl yaşanacağı, görünümden önce hissediliyor.',
    ],
    distance3: [
      'El yapımı dokular sıcak gölgede — hafıza, kalıcılık ve ait olma.',
      'Altın saatte bir model çalışması; oran, sabır ve kalıcı form.',
    ],
  },
  technology_ai: {
    distance2: [
      'Görünmeyen bağlantılar içeride bir ışık yakıyor; merak, insan yansıması ve henüz adı konmamış bir anlam.',
      'Yenilik değil, onun bıraktığı his öne çıkıyor; sessiz bir masa, uzaktan gelen şehir parıltısı.',
    ],
    distance3: [
      'Pencereden süzülen şehir ışığı — insan, merak ve görünmeyen bağlar.',
      'Yumuşak iç mekân ışığı; düşünce, robot değil.',
    ],
  },
  finance: {
    distance2: [
      'Belirsizlik bir engel değil; olasılıkların açıldığı bir alan. Henüz netleşmeyen şeyler bile yön göstermeye başlıyor.',
      'Kısa vadeli sonuçlardan çok sürdürülebilir bir düzen kurma isteği aynı çerçevede duruyor.',
    ],
    distance3: [
      'Sisli bir şafakta açılan yol — eşik, umut ve uzak bir ışık.',
    ],
  },
  health: {
    distance2: [
      'Bedenin sessiz sinyali bir hedef listesi değil; günlük ritimle uyumlu bir denge arayışı.',
      'Hızlı çözümlerden çok sürdürülebilir bir iyi his aynı sabah ışığında buluşuyor.',
    ],
    distance3: [
      'Şeffaf perdeden süzülen sabah ışığı — sakinlik, nefes ve yumuşak tonlar.',
    ],
  },
  food_culture: {
    distance2: [
      'Bir lezzet yalnızca tat değil; kültürün dokusunu hissetme biçimi olarak duruyor.',
      'Tariflerden çok paylaşılan bir deneyimin sıcaklığı öne çıkıyor.',
    ],
    distance3: [
      'Amber ışıkta yumuşak bokeh — hafıza, doku ve yakınlık.',
    ],
  },
  family: {
    distance2: [
      'Yakınlık büyük jestlerde değil; günlük ritimdeki küçük uyumlarda hissediliyor.',
      'Bir bağı onarmaktan çok onu daha iyi anlama isteği aynı sıcak mekânda duruyor.',
    ],
    distance3: [
      'Paylaşılan sessiz bir ev ışığı — birliktelik ve yumuşak sıcaklık.',
    ],
  },
  education: {
    distance2: [
      'Öğrenme bir yarış değil; kendi ritmine uygun bir derinleşme. Sorular cevaplardan önce geliyor.',
      'Anlamanın nasıl genişleyeceği, sonuçtan önce hissediliyor.',
    ],
    distance3: [
      'Pencere kenarında açık bir sayfa — öğle ışığı ve sessiz odak.',
    ],
  },
  spiritual_reflection: {
    distance2: [
      'Daha derine inme isteği bir cevap arayışından çok duraklama ve farkındalık taşıyor.',
      'Kalbin sesi, zikir ve sessizlik aynı iç yolda buluşuyor.',
    ],
    distance3: [
      'Taş avluda mum ışığı — içe dönüş, dinginlik ve kutsal sessizlik.',
    ],
  },
  general_curiosity: {
    distance2: [
      'Tek bir cevapta değil; düşünceyi netleştiren sorularda yoğunlaşan sakin ama yönlü bir merak.',
      'Sonuca koşmaktan çok iç dünyada yeni bir açı arayışı aynı sabah sisi içinde.',
    ],
    distance3: [
      'Şafak sisi içinde sessiz bir patika — merak, yansıma ve yumuşak altın.',
    ],
  },
};

/** Selected-topic overrides — same meaning lane, never literal topic labels in copy. */
const MEANING_COPY_BY_SELECTED_TOPIC: Record<
  string,
  { distance2: string[]; distance3: string[] }
> = {
  'Japonya seyahati': MEANING_COPY_BY_TOPIC.travel,
  'Baklava tarifi': MEANING_COPY_BY_TOPIC.food_culture,
  'Sütlaç tarifi': MEANING_COPY_BY_TOPIC.food_culture,
  'Cephe malzeme bilgisi': MEANING_COPY_BY_TOPIC.architecture,
  'BMW vs Mercedes': MEANING_COPY_BY_TOPIC.vehicle,
  'Diş macunu seçimi': {
    distance2: [
      'Güven veren bir denge aranıyor; temizlik, hassasiyet ve özen aynı küçük kararın içinde buluşuyor.',
    ],
    distance3: [
      'Sabah ışığında sakin bir tezgâh — su yansımaları, yumuşak fildişi ve sessiz bir ritüel.',
    ],
  },
  'Hassas dişler': {
    distance2: [
      'Günlük rutinde sakin ve güven veren bir his arayışı; ürün listesinden çok özenli bir denge.',
    ],
    distance3: [
      'Sabah ışığında nazik bir ritim — yumuşak tonlar ve sessiz bakım.',
    ],
  },
};

export function resolveMeaningMirrorCopy(input: {
  storyTopicId: StoryTopicId;
  selectedTopic: string;
  seed: string;
  narrativeDistance: NarrativeDistanceLevel;
}): string {
  const pool =
    resolveSelectedTopicPool(input.selectedTopic) ??
    MEANING_COPY_BY_TOPIC[input.storyTopicId] ??
    MEANING_COPY_BY_TOPIC.general_curiosity;

  const variants =
    input.narrativeDistance === 2 ? pool.distance2 : pool.distance3;
  return hashPick(`${input.seed}-meaning-copy-d${input.narrativeDistance}`, variants);
}

function resolveSelectedTopicPool(
  selectedTopic: string
): { distance2: string[]; distance3: string[] } | null {
  const exact = MEANING_COPY_BY_SELECTED_TOPIC[selectedTopic];
  if (exact) return exact;
  const normalized = selectedTopic.toLowerCase();
  for (const [key, pool] of Object.entries(MEANING_COPY_BY_SELECTED_TOPIC)) {
    if (key.toLowerCase() === normalized) return pool;
  }
  return null;
}
