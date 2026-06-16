/**
 * Cinematic copy overrides keyed by SAINA-selected conversation sub-topic.
 * OpenAI does not choose topics — these templates ground the poster narrative.
 */

import type { SainaMirrorEmotionalTone } from '@/lib/eza/mirror/conversationMirrorV2/types';

export type SelectedTopicCopy = {
  topicSummary?: string;
  mirrorTitle: string;
  mirrorText: string;
  closingLine?: string;
  sceneMetaphor: string;
  visualKeywords: string[];
  emotionalTone: SainaMirrorEmotionalTone;
};

const SELECTED_TOPIC_COPY: Record<string, SelectedTopicCopy> = {
  'Baklava tarifi': {
    mirrorTitle: 'Tatlı Bir Gelenek',
    mirrorText:
      'Bugün bir tariften çok, tanıdık bir tadın nasıl kurulduğunu aradın. Ölçüler, malzemeler ve küçük ayrıntılar aynı sofranın etrafında birleşti.',
    closingLine: 'Bazı tatlar, anılarıyla birlikte gelir.',
    sceneMetaphor:
      'A warm traditional kitchen at golden hour, quiet preparation, golden pastry layers, soft steam, handcrafted details',
    visualKeywords: [
      'baklava',
      'warm kitchen',
      'golden light',
      'traditional dessert',
      'quiet preparation',
    ],
    emotionalTone: 'nostalgic',
  },
  'Sütlaç tarifi': {
    mirrorTitle: 'Sofranın Sıcaklığı',
    mirrorText:
      'Konuşman bir tarif listesinden çok, sade ve tanıdık bir tatın nasıl hissettirdiğine yöneldi. Merakın, ölçülerden çok paylaşılan bir ritme kaydı.',
    sceneMetaphor: 'Creamy dessert in a ceramic bowl with soft amber kitchen light',
    visualKeywords: ['sütlaç', 'warm kitchen', 'ceramic bowl', 'amber light', 'comfort'],
    emotionalTone: 'nostalgic',
  },
  'Cephe malzeme bilgisi': {
    mirrorTitle: 'Malzemenin Sesi',
    mirrorText:
      'Bugün cepheyi yalnızca görünüm olarak değil, malzemenin zaman içinde nasıl yaşayacağı üzerinden düşündün.',
    sceneMetaphor: 'Facade material samples in warm architectural studio light',
    visualKeywords: ['facade', 'material', 'architecture', 'texture', 'golden hour'],
    emotionalTone: 'focused',
  },
  'BMW vs Mercedes': {
    mirrorTitle: 'Sessiz Karşılaştırmalar',
    mirrorText:
      'Bugün iki markadan çok kendi önceliklerini tarttın. Konfor, kalite ve uzun vadeli memnuniyet seçeneklerin arkasındaki asıl ölçüydü.',
    closingLine: 'Bazen doğru seçim, en çok parlayan değil, en uzun süre iyi hissettirendir.',
    sceneMetaphor: 'Two premium cars in a cinematic quiet showroom with warm reflections',
    visualKeywords: ['luxury cars', 'dark showroom', 'gold light', 'decision', 'reflection'],
    emotionalTone: 'decisive',
  },
  'Diş macunu seçimi': {
    topicSummary:
      'Kullanıcı florür, hassasiyet ve beyazlatıcı diş macunları arasında güvenli ve dengeli bir seçim yapmaya çalışıyor.',
    mirrorTitle: 'Temiz Bir Seçim',
    mirrorText:
      'Bugün bir üründen çok, güven veren bir denge aradın. Temizlik, hassasiyet ve güvenlik aynı küçük kararın içinde buluştu.',
    closingLine: 'Bazen doğru seçim, en parlak vaat değil, uzun süre iyi hissettiren dengedir.',
    sceneMetaphor:
      'A calm premium bathroom counter at morning light with subtle water reflections and clean details',
    visualKeywords: [
      'toothpaste',
      'morning light',
      'clean bathroom counter',
      'water reflection',
      'soft ivory',
      'premium hygiene',
      'quiet choice',
    ],
    emotionalTone: 'careful',
  },
  'Hassas dişler': {
    topicSummary:
      'Kullanıcı hassasiyet artırmayan, güvenli ve dengeli bir diş macunu seçimi arıyor.',
    mirrorTitle: 'Nazik Bir Denge',
    mirrorText:
      'Konuşman bir ürün listesinden çok, günlük rutinde sakin ve güven veren bir his arayışına yöneldi.',
    sceneMetaphor:
      'A calm premium bathroom counter at morning light with subtle water reflections and clean details',
    visualKeywords: [
      'toothpaste',
      'morning light',
      'clean bathroom counter',
      'soft ivory',
      'quiet choice',
    ],
    emotionalTone: 'careful',
  },
};

export function resolveSelectedTopicCopy(
  selectedTopic: string,
  seed: string
): SelectedTopicCopy | null {
  const exact = SELECTED_TOPIC_COPY[selectedTopic];
  if (exact) return exact;

  const normalized = selectedTopic.toLowerCase();
  for (const [key, copy] of Object.entries(SELECTED_TOPIC_COPY)) {
    if (key.toLowerCase() === normalized) return copy;
  }
  return null;
}

export function composeSelectedTopicMirrorCopy(
  selectedTopic: string,
  seed: string,
  storyLine?: string
): SelectedTopicCopy | null {
  const base = resolveSelectedTopicCopy(selectedTopic, seed);
  if (!base) return null;
  if (!storyLine?.trim()) return base;
  const words = storyLine.trim().split(/\s+/).filter(Boolean);
  if (words.length < 8) return base;
  return {
    ...base,
    mirrorText: storyLine.trim(),
  };
}
