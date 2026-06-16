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
  'Japonya seyahati': {
    mirrorTitle: 'Uzak Doğuda Yeni Bir Bakış',
    mirrorText:
      'Bugün Japonya\'yı konuştun. Sadece bir seyahat planlamadın, farklı bir yaşam kültürüne pencere açtın.',
    closingLine: 'Bazı yolculuklar haritada değil, iç sesinde başlar.',
    sceneMetaphor:
      'Figure facing a vast golden horizon at dusk — wonder, distance, curiosity, atmospheric depth',
    visualKeywords: ['wonder', 'distance', 'curiosity', 'golden hour', 'atmospheric depth', 'quiet horizon'],
    emotionalTone: 'curious',
  },
  'Baklava tarifi': {
    mirrorTitle: 'Tatlı Bir Gelenek',
    mirrorText:
      'Bugün bir tariften çok, tanıdık bir tadın nasıl kurulduğunu aradın. Ölçüler, malzemeler ve küçük ayrıntılar aynı sofranın etrafında birleşti.',
    closingLine: 'Bazı tatlar, anılarıyla birlikte gelir.',
    sceneMetaphor:
      'Warm kitchen at golden hour — quiet preparation, steam, handcrafted warmth, nostalgia',
    visualKeywords: ['nostalgia', 'warm kitchen', 'golden light', 'handcrafted', 'quiet preparation'],
    emotionalTone: 'nostalgic',
  },
  'Sütlaç tarifi': {
    mirrorTitle: 'Sofranın Sıcaklığı',
    mirrorText:
      'Konuşman bir tarif listesinden çok, sade ve tanıdık bir tatın nasıl hissettirdiğine yöneldi.',
    sceneMetaphor: 'Ceramic bowl in amber kitchen light — comfort, warmth, shared ritual',
    visualKeywords: ['comfort', 'warm kitchen', 'amber light', 'shared ritual', 'soft texture'],
    emotionalTone: 'nostalgic',
  },
  'Cephe malzeme bilgisi': {
    mirrorTitle: 'Bir Yapının Hafızası',
    mirrorText:
      'Bugün cepheleri, malzemeleri ve detayları konuştun. Ama aslında kalıcı, anlamlı ve sana ait bir şey inşa etmeye çalışıyordun.',
    closingLine: 'Bazı yapılar önce zihinde tamamlanır.',
    sceneMetaphor:
      'Handmade material textures in warm shadow — memory, permanence, craft, belonging',
    visualKeywords: ['memory', 'permanence', 'craft', 'warm shadow', 'material texture', 'belonging'],
    emotionalTone: 'focused',
  },
  'BMW vs Mercedes': {
    mirrorTitle: 'Sessiz Karşılaştırmalar',
    mirrorText:
      'Bugün iki markadan çok kendi önceliklerini tarttın. Konfor, kalite ve uzun vadeli memnuniyet seçeneklerin arkasındaki asıl ölçüydü.',
    closingLine: 'Bazen doğru seçim, en uzun süre iyi hissettirendir.',
    sceneMetaphor:
      'Cinematic quiet showroom reflections — decision, balance, premium calm, warm metal light',
    visualKeywords: ['decision', 'balance', 'premium calm', 'warm reflection', 'quiet comparison'],
    emotionalTone: 'decisive',
  },
  'Diş macunu seçimi': {
    topicSummary: 'Florür, hassasiyet ve beyazlatıcı diş macunları arasında güvenli bir seçim arayışı.',
    mirrorTitle: 'Temiz Bir Seçim',
    mirrorText:
      'Bugün bir üründen çok, güven veren bir denge aradın. Temizlik, hassasiyet ve güvenlik aynı küçük kararın içinde buluştu.',
    closingLine: 'Sakin bir ritim, küçük kararlarda bile hissedilir.',
    sceneMetaphor:
      'Calm premium bathroom counter at morning light — subtle water reflections, quiet balance',
    visualKeywords: [
      'morning light',
      'quiet balance',
      'soft ivory',
      'water reflection',
      'calm ritual',
      'gentle care',
    ],
    emotionalTone: 'careful',
  },
  'Hassas dişler': {
    topicSummary: 'Hassasiyet artırmayan, güvenli ve dengeli bir diş macunu seçimi arayışı.',
    mirrorTitle: 'Nazik Bir Denge',
    mirrorText:
      'Konuşman bir ürün listesinden çok, günlük rutinde sakin ve güven veren bir his arayışına yöneldi.',
    sceneMetaphor:
      'Calm premium bathroom counter at morning light — subtle water reflections, gentle care',
    visualKeywords: ['morning light', 'gentle care', 'quiet balance', 'soft ivory', 'calm ritual'],
    emotionalTone: 'careful',
  },
};

export function resolveSelectedTopicCopy(
  selectedTopic: string,
  _seed: string
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
  seed: string
): SelectedTopicCopy | null {
  return resolveSelectedTopicCopy(selectedTopic, seed);
}
