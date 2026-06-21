/**

 * V4.5 — topic-inspired editorial titles + observation body copy.

 */



import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';

import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

import { clampWords } from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';

import { inferStoryTopicFromEvidence } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';



export type EvidenceMirrorCopy = {

  mirrorTitle: string;

  mirrorText: string;

};



type EditorialTitleGroup = {

  default: string[];

  lantern?: string[];

  route?: string[];

  material?: string[];

  garage?: string[];

  desk?: string[];

  ritual?: string[];

  courtyard?: string[];

};



const EDITORIAL_TITLES: Record<StoryTopicId, EditorialTitleGroup> = {

  travel: {

    default: ['Sokak Lambaları', 'Akşam Rotası', 'Şehrin Ritmi', 'Fener Işıkları', 'Gece Sokakları'],

    lantern: ['Fener Işıkları Altında', 'Sokak Lambaları', 'Fener Işıkları'],

    route: ['Akşam Rotası', 'Şehrin Ritmi', 'Gece Rota Notları'],

  },

  architecture: {

    default: ['Cephe Işığı', 'Malzeme ve Oran', 'Taş ve Metal'],

    material: ['Malzeme Dokusu', 'Cephe Numuneleri', 'Yüzey ve Oran'],

  },

  technology_ai: {

    default: ['Masa Işığı', 'Düşünce Masası', 'Not Defteri'],

    desk: ['Araştırma Masası', 'Ekran Yansıması', 'Notlar ve Diyagram'],

  },

  vehicle: {

    default: ['Garaj Işığı', 'Gece Garaj Işığı', 'Sessiz Seçim'],

    garage: ['Garaj Karşılaştırması', 'İki Siluet', 'Uzun Yol Notu'],

  },

  health: {

    default: ['Sabah Ritüeli', 'Tezgâh Işığı', 'Sakin Seçim'],

    ritual: ['Sabah Bakım Anı', 'Sakin Ritüel', 'Tezgâh Karşılaştırması'],

  },

  spiritual_reflection: {

    default: ['Avlu Işığı', 'Sessiz Mekân', 'Taş ve Hat'],

    courtyard: ['Sessiz Avlu', 'Avlu Işığı', 'Hat Detayı'],

  },

  finance: { default: ['Eşik Notu', 'Gelecek Defteri', 'Plan Masası'] },

  food_culture: { default: ['Mutfak Işığı', 'Tarif Defteri', 'Sıcak Masa'] },

  family: { default: ['Ev Işığı', 'Paylaşılan Masa', 'Sakin Oda'] },

  education: { default: ['Sayfa Işığı', 'Masa Lambası', 'Açık Defter'] },

  general_curiosity: { default: ['Masa Üstü Işık', 'Tek Nesne', 'Soru Anı'] },

};



const BODY_BY_TOPIC: Record<StoryTopicId, string[]> = {

  travel: [

    'Bazı şehirler haritada başlar, ama gerçekten yürümeye başladığında açılır.',

    'Akşam ışıkları altında şehir yavaşça açılırken, yolculuk plan olmaktan çıkıp deneyime dönüşüyor.',

    'Gece sokakları sessizleşirken, rotanın hissi önce haritada değil adımlarda beliriyor.',

  ],

  architecture: [

    'Işık cepheye vurduğunda malzeme konuşmaya başlar; oran ve doku kararın diline dönüşür.',

    'Taş ve metal aynı yüzeyde buluşurken, yapının karakteri ölçüyle netleşir.',

  ],

  technology_ai: [

    'Masa lambası sönmeye yaklaşırken, teknolojinin sorusu sessiz bir etik meseleye dönüşüyor.',

    'Ekranın yansıması defterle aynı ışıkta buluşurken, düşünce somut bir forma kavuşuyor.',

  ],

  vehicle: [

    'Garaj ışığı iki seçeneği aynı sessizlikte tutarken, konfor kararı ölçülebilir bir tercihe dönüşüyor.',

    'Gece garajında duran iki siluet, uzun yol ihtiyacını söze dökmekten önce bekliyor.',

  ],

  health: [

    'Sabah ışığı tezgâha vurduğunda, günlük bakım sakin bir özen meselesine dönüşüyor.',

  ],

  spiritual_reflection: [

    'Avlu ışığı taşın üzerinde uzanırken, sessizlik düşüncenin en net ifadesine dönüşüyor.',

    'Taş ve hat aynı mekânda buluşurken, manevi yön sözsüz bir ağırlık kazanıyor.',

  ],

  finance: [

    'Eşik ışığı deftere düşerken, gelecek planı somut bir yön arayışına dönüşüyor.',

  ],

  food_culture: [

    'Mutfak ışığı sıcakla buluşurken, lezzet araştırması günlük bir ritme dönüşüyor.',

  ],

  family: [

    'Ev ışığı masanın üzerinde toplanırken, yakınlık paylaşılan bir ana dönüşüyor.',

  ],

  education: [

    'Sayfa ışığı defteri aydınlatırken, öğrenme anı sessiz bir odaklanmaya dönüşüyor.',

  ],

  general_curiosity: [

    'Masa üstünde tek bir nesne dururken, merak somut bir soruya dönüşüyor.',

  ],

};



const TOPIC_NAME_PATTERN =

  /japonya|kyoto|gion|tokyo|bmw|mercedes|yapay zeka|diş macunu|cephe malzemesi/i;



const V2_LANGUAGE_PATTERN =

  /keşif|keşfin|yolculuk başlar|inner voice|wonder|possibility|journey|iç ses|ufuk|merakla şekillendi|olasılık|uzak ufuk|inner journey|distance and curiosity/i;



const INVENTORY_BODY_PATTERN =

  /fenerli sokaklar|rota notları|tren bileti|numune,|eskiz ve|defter, diyagram|iki ürün ve|garaj ışığı, karşılaştırma/i;



function isTopicNameTitle(title: string, selectedTopic: string): boolean {

  const lower = title.toLowerCase();

  const topicLower = selectedTopic.trim().toLowerCase();

  if (topicLower && lower.includes(topicLower.slice(0, Math.min(8, topicLower.length)))) {

    return true;

  }

  return TOPIC_NAME_PATTERN.test(title);

}



function isValidEditorialBody(text: string): boolean {

  if (V2_LANGUAGE_PATTERN.test(text)) return false;

  if (INVENTORY_BODY_PATTERN.test(text)) return false;

  return text.trim().length >= 15;

}



function resolveEditorialTitle(input: {

  topicId: StoryTopicId;

  evidence: readonly ConversationEvidence[];

  selectedTopic: string;

  seed: string;

}): string {

  const primary = input.evidence.find((item) => item.role === 'primary') ?? input.evidence[0];

  const blob = `${primary?.label ?? ''} ${primary?.visualHint ?? ''}`.toLowerCase();

  const groups = EDITORIAL_TITLES[input.topicId] ?? EDITORIAL_TITLES.general_curiosity;



  let pool = groups.default;

  if (/lantern|fener|glow|evening street/.test(blob) && groups.lantern) pool = groups.lantern;

  else if (/notebook|map|route|ticket|rota/.test(blob) && groups.route) pool = groups.route;

  else if (/material|sample|stone|metal|malzeme|facade|cephe/.test(blob) && groups.material) {

    pool = groups.material;

  } else if (/garage|sedan|vehicle|car|silhouette/.test(blob) && groups.garage) {

    pool = groups.garage;

  } else if (/desk|screen|diagram|notebook|research/.test(blob) && groups.desk) {

    pool = groups.desk;

  } else if (/bathroom|counter|ritual|sink|brush/.test(blob) && groups.ritual) {

    pool = groups.ritual;

  } else if (/courtyard|calligraphy|mosque|prayer|avlu/.test(blob) && groups.courtyard) {

    pool = groups.courtyard;

  }



  const filtered = pool.filter((title) => !isTopicNameTitle(title, input.selectedTopic));

  const candidates = filtered.length > 0 ? filtered : groups.default;

  return clampWords(hashPick(`${input.seed}-v45-title`, candidates), 5);

}



function resolveEditorialBody(topicId: StoryTopicId, seed: string): string {

  const pool = (BODY_BY_TOPIC[topicId] ?? BODY_BY_TOPIC.general_curiosity).filter(isValidEditorialBody);

  const candidates = pool.length > 0 ? pool : BODY_BY_TOPIC.general_curiosity;

  return hashPick(`${seed}-v45-body`, candidates);

}



export function resolveEvidenceMirrorCopy(input: {

  evidence: readonly ConversationEvidence[];

  selectedTopic: string;

  storyTopicId: StoryTopicId;

  seed: string;

}): EvidenceMirrorCopy {

  const topicId = inferStoryTopicFromEvidence(

    input.storyTopicId,

    input.evidence,

    input.selectedTopic

  );



  return {

    mirrorTitle: resolveEditorialTitle({

      topicId,

      evidence: input.evidence,

      selectedTopic: input.selectedTopic,

      seed: input.seed,

    }),

    mirrorText: resolveEditorialBody(topicId, input.seed),

  };

}


