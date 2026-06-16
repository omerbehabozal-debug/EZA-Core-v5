/**
 * Topic-based cinematic copy templates for Mirror V2 (privacy-safe, no raw chat).
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SainaMirrorEmotionalTone } from '@/lib/eza/mirror/conversationMirrorV2/types';
import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';

export type TopicMirrorTemplate = {
  topicLabel: string;
  titles: string[];
  mirrorTexts: string[];
  closingLines: string[];
  sceneMetaphors: string[];
  visualKeywords: string[];
  defaultTone: SainaMirrorEmotionalTone;
};

export const TOPIC_MIRROR_TEMPLATES: Record<StoryTopicId, TopicMirrorTemplate> = {
  travel: {
    topicLabel: 'Seyahat ve keşif',
    titles: ['Doğuya Açılan Kapı', 'Uzak Ritimler', 'Yolun Ötesinde'],
    mirrorTexts: [
      'Bugün bir rotayı yalnızca haritada değil, uzakta duran bir yaşam ritmi gibi düşündün. Merakın, gidilecek yerlerden çok orada nasıl hissedeceğine yöneldi.',
      'Konuşman bir varış noktasından çok bir atmosfer arayışı taşıyordu. İlgin, mesafeden çok deneyimin dokusuna kaydı.',
    ],
    closingLines: ['Bazı yolculuklar haritada değil, iç sesinde başlar.'],
    sceneMetaphors: [
      'Mist over a quiet path at golden hour',
      'Distant lantern light on a calm street at dusk',
    ],
    visualKeywords: ['travel', 'quiet street', 'lanterns', 'mountain silhouette', 'soft gold light'],
    defaultTone: 'curious',
  },
  vehicle: {
    topicLabel: 'Premium araç kararı',
    titles: ['Sessiz Karşılaştırmalar', 'Konforun Terazisi', 'Uzun Yolun Seçimi'],
    mirrorTexts: [
      'Bugün iki markadan çok kendi önceliklerini tarttın. Konfor, kalite ve uzun vadeli memnuniyet seçeneklerin arkasındaki asıl ölçüydü.',
      'Karşılaştırman yüzeyde özelliklerde değil, hangi dünyanın sana daha uzun süre iyi hissettireceğinde yoğunlaştı.',
    ],
    closingLines: [
      'Bazen doğru seçim, en çok parlayan değil, en uzun süre iyi hissettirendir.',
    ],
    sceneMetaphors: [
      'Two premium cars in a cinematic quiet showroom',
      'Warm reflections on polished metal in a dark garage',
    ],
    visualKeywords: ['luxury cars', 'dark showroom', 'gold light', 'decision', 'reflection'],
    defaultTone: 'decisive',
  },
  architecture: {
    topicLabel: 'Mimari ve cephe kararları',
    titles: ['Bir Yapının Hafızası', 'Işığın Çerçevesi', 'Malzemenin Sesi'],
    mirrorTexts: [
      'Bugün cepheyi yalnızca güzelleştirmeye çalışmadın. Malzeme, oran ve ışık üzerinden kalıcı bir iz bırakmanın yolunu aradın.',
      'Konuşman bir görünümden çok bir yapının zaman içinde nasıl yaşanacağına odaklandı.',
    ],
    closingLines: ['Bazı yapılar önce zihinde tamamlanır.'],
    sceneMetaphors: [
      'Architectural model and warm city light',
      'Facade study with golden hour shadows',
    ],
    visualKeywords: ['architecture', 'facade', 'model', 'golden hour', 'premium materials'],
    defaultTone: 'focused',
  },
  technology_ai: {
    topicLabel: 'Yapay zeka ve teknoloji',
    titles: ['Görünmeyeni Anlamak', 'Yeni Bir Dil', 'Güvenin Eşiği'],
    mirrorTexts: [
      'Bugün teknolojiyi bir araç olarak değil, nasıl düşündüğünü genişletebilecek bir alan olarak tarttın. Soruların hızdan çok anlamaya yöneldi.',
      'Merakın, yeniliğin kendisinden çok onun sana ne hissettireceğine kaydı.',
    ],
    closingLines: ['Bazı sistemler önce merakla anlaşılır.'],
    sceneMetaphors: ['Soft light on a quiet desk with abstract data glow'],
    visualKeywords: ['technology', 'quiet desk', 'soft glow', 'reflection', 'minimal'],
    defaultTone: 'curious',
  },
  finance: {
    topicLabel: 'Finans ve gelecek planı',
    titles: ['Yeni Bir Eşiğin Önünde', 'Sakin Hesap', 'Uzun Vadeli Ritim'],
    mirrorTexts: [
      'Bugün belirsizliği bir engel gibi değil, olasılıkların açıldığı bir alan gibi ele aldın. Henüz netleşmeyen şeyler bile yönünü göstermeye başladı.',
      'Konuşman kısa vadeli sonuçlardan çok sürdürülebilir bir düzen kurma isteği taşıyordu.',
    ],
    closingLines: ['Bazı kapılar, yaklaşınca görünür.'],
    sceneMetaphors: ['A road opening into sunrise mist'],
    visualKeywords: ['sunrise', 'path', 'mist', 'new beginning', 'distant light'],
    defaultTone: 'hopeful',
  },
  health: {
    topicLabel: 'Sağlık ve denge',
    titles: ['Bedenin Sessiz Sinyali', 'Denge Arayışı', 'İç Ritim'],
    mirrorTexts: [
      'Bugün sağlığı bir hedef listesi gibi değil, günlük ritminle uyumlu bir denge arayışı gibi ele aldın.',
      'Konuşman hızlı çözümlerden çok sürdürülebilir bir iyi hisse yöneldi.',
    ],
    closingLines: ['Bazı iyileşmeler önce dinlemeyle başlar.'],
    sceneMetaphors: ['Morning light through sheer curtains in a calm room'],
    visualKeywords: ['calm room', 'morning light', 'stillness', 'breath', 'soft tones'],
    defaultTone: 'calm',
  },
  food_culture: {
    topicLabel: 'Yemek ve kültür',
    titles: ['Tatların Hafızası', 'Sofranın Dili', 'Kültürün İzleri'],
    mirrorTexts: [
      'Bugün bir lezzeti yalnızca tat olarak değil, bir kültürün dokusunu hissetme biçimi olarak düşündün.',
      'Merakın, tariflerden çok paylaşılan bir deneyimin sıcaklığına yöneldi.',
    ],
    closingLines: ['Bazı tatlar, anılarıyla birlikte gelir.'],
    sceneMetaphors: ['Warm table setting with soft bokeh and amber light'],
    visualKeywords: ['food culture', 'warm table', 'amber light', 'texture', 'intimacy'],
    defaultTone: 'nostalgic',
  },
  family: {
    topicLabel: 'Aile ve yakınlık',
    titles: ['Aynı Çatı Altında', 'Yakınlığın Sesi', 'Birlikte Kalma'],
    mirrorTexts: [
      'Bugün yakınlığı büyük jestlerden çok günlük ritimdeki küçük uyumlar üzerinden düşündün.',
      'Konuşman bir ilişkiyi onarmaktan çok onu daha iyi anlamaya yöneldi.',
    ],
    closingLines: ['Bazı bağlar, sessizce güçlenir.'],
    sceneMetaphors: ['Warm interior light in a shared quiet home space'],
    visualKeywords: ['home', 'warm interior', 'shared space', 'soft light', 'togetherness'],
    defaultTone: 'reflective',
  },
  education: {
    topicLabel: 'Öğrenme ve gelişim',
    titles: ['Öğrenmenin Eşiği', 'Yeni Bir Katman', 'Merakın Yönü'],
    mirrorTexts: [
      'Bugün öğrenmeyi bir yarış gibi değil, kendi ritmine uygun bir derinleşme olarak ele aldın.',
      'Soruların cevaplardan çok anlamanın nasıl genişleyeceğine odaklandı.',
    ],
    closingLines: ['Bazı bilgiler, hazır olunca yerine oturur.'],
    sceneMetaphors: ['Open book near a window with soft afternoon light'],
    visualKeywords: ['learning', 'open book', 'window light', 'study', 'quiet focus'],
    defaultTone: 'focused',
  },
  spiritual_reflection: {
    topicLabel: 'Manevi düşünce',
    titles: ['İçe Dönen Yol', 'Sessiz Anlam', 'Zamanın İzleri'],
    mirrorTexts: [
      'Bugün anlamı dışarıda aramaktan çok iç sesinde dinlemeye yöneldin. Soruların acele etmeden derinleşti.',
      'Konuşman bir cevap arayışından çok bir duraklama ve farkındalık hissi taşıyordu.',
    ],
    closingLines: ['Bazı yollar, sessizlikte açılır.'],
    sceneMetaphors: ['Candlelight and stone texture in soft shadow'],
    visualKeywords: ['spiritual', 'stone texture', 'candlelight', 'shadow', 'stillness'],
    defaultTone: 'reflective',
  },
  general_curiosity: {
    topicLabel: 'Günlük merak',
    titles: ['Kendine Dönmek', 'Sessiz Sorular', 'Karar Anı'],
    mirrorTexts: [
      'Bugün konuşman tek bir cevapta değil, düşünceni netleştiren sorularda yoğunlaştı. Merakın sakin ama yönlüydü.',
      'Sohbetin bir sonuca koşmaktan çok kendi iç dünyanda yeni bir açı bulma çabası gibi aktı.',
    ],
    closingLines: ['Bazı aynalar, konuşmadan sonra daha net görünür.'],
    sceneMetaphors: ['Quiet path through soft mist at dawn'],
    visualKeywords: ['curiosity', 'dawn mist', 'quiet path', 'reflection', 'soft gold'],
    defaultTone: 'reflective',
  },
};

export function pickTopicTemplate(
  topicId: StoryTopicId,
  seed: string
): TopicMirrorTemplate {
  return TOPIC_MIRROR_TEMPLATES[topicId] ?? TOPIC_MIRROR_TEMPLATES.general_curiosity;
}

export function composeTopicMirrorCopy(
  topicId: StoryTopicId,
  seed: string,
  storyLine?: string
): Pick<TopicMirrorTemplate, 'topicLabel'> & {
  mirrorTitle: string;
  mirrorText: string;
  closingLine?: string;
  sceneMetaphor: string;
  visualKeywords: string[];
  emotionalTone: SainaMirrorEmotionalTone;
} {
  const template = pickTopicTemplate(topicId, seed);
  const mirrorText = storyLine?.trim()
    ? trimWordCount(storyLine, 50)
    : hashPick(`${seed}-text`, template.mirrorTexts);

  return {
    topicLabel: template.topicLabel,
    mirrorTitle: hashPick(`${seed}-title`, template.titles),
    mirrorText,
    closingLine: hashPick(`${seed}-close`, template.closingLines),
    sceneMetaphor: hashPick(`${seed}-scene`, template.sceneMetaphors),
    visualKeywords: template.visualKeywords,
    emotionalTone: template.defaultTone,
  };
}

export function trimWordCount(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}
