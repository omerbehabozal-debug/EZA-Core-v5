/**
 * Daily Mirror — behavior family labels & deterministic daily avatar pool (P0).
 */

import type { CharacterArchetypeId } from '@/lib/eza/mirror/ezaCharacterBible';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { MicroMoodId, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';

export type DailyAvatarType = 'animal' | 'human' | 'plant' | 'metaphor' | 'object';

export type DailyAvatarDefinition = {
  id: string;
  displayName: string;
  emoji: string;
  avatarType: DailyAvatarType;
  archetypeId: CharacterArchetypeId;
  shortLabel: string;
};

export const BEHAVIOR_FAMILY_LABEL: Record<PersonaFamilyId, string> = {
  curiosity_exploration: 'Keşif Ailesi',
  decision_direction: 'Karar Ailesi',
  clarity_simplification: 'Netlik Ailesi',
  ideation_creation: 'Fikir Ailesi',
  deep_thinking: 'Derinlik Ailesi',
  sensitive_careful: 'Hassasiyet Ailesi',
  fast_practical: 'Pratik Ailesi',
  planning_structure: 'Plan Ailesi',
  trust_verification: 'Güven Ailesi',
  balanced_calm: 'Denge Ailesi',
};

const AVATARS_BY_FAMILY: Record<PersonaFamilyId, DailyAvatarDefinition[]> = {
  curiosity_exploration: [
    {
      id: 'curious_fox',
      displayName: 'Meraklı Tilki',
      emoji: '🦊',
      avatarType: 'animal',
      archetypeId: 'journey_traveler',
      shortLabel: 'Meraklı keşif',
    },
    {
      id: 'research_owl',
      displayName: 'Araştıran Baykuş',
      emoji: '🦉',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'Derin araştırma',
    },
    {
      id: 'horizon_explorer',
      displayName: 'Ufuk Kaşifi',
      emoji: '🧭',
      avatarType: 'metaphor',
      archetypeId: 'journey_traveler',
      shortLabel: 'Ufuk arayışı',
    },
    {
      id: 'stargazer',
      displayName: 'Yıldız Gözlemcisi',
      emoji: '🔭',
      avatarType: 'metaphor',
      archetypeId: 'journey_traveler',
      shortLabel: 'Geniş bakış',
    },
    {
      id: 'sprouting_seedling',
      displayName: 'Filizlenen Fidan',
      emoji: '🌱',
      avatarType: 'plant',
      archetypeId: 'creative_spirit',
      shortLabel: 'Yeni filizler',
    },
    {
      id: 'pathfinder',
      displayName: 'Yol Bulucu',
      emoji: '🛤️',
      avatarType: 'metaphor',
      archetypeId: 'journey_traveler',
      shortLabel: 'Yeni yollar',
    },
  ],
  decision_direction: [
    {
      id: 'decision_penguin',
      displayName: 'Karar Pengueni',
      emoji: '🐧',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'Net seçim',
    },
    {
      id: 'balance_scales',
      displayName: 'Denge Terazisi',
      emoji: '⚖️',
      avatarType: 'metaphor',
      archetypeId: 'wise_owl',
      shortLabel: 'Tartılan seçenekler',
    },
    {
      id: 'route_mapper',
      displayName: 'Rota Çizen',
      emoji: '🗺️',
      avatarType: 'metaphor',
      archetypeId: 'wise_owl',
      shortLabel: 'Yön bulma',
    },
    {
      id: 'threshold_walker',
      displayName: 'Eşik Yolcusu',
      emoji: '🚪',
      avatarType: 'human',
      archetypeId: 'bridge_builder',
      shortLabel: 'Karar eşiği',
    },
    {
      id: 'compass_keeper',
      displayName: 'Pusula Bekçisi',
      emoji: '🧭',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Sakin yön',
    },
  ],
  clarity_simplification: [
    {
      id: 'clarity_owl',
      displayName: 'Netlik Baykuşu',
      emoji: '🦉',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'Berrak bakış',
    },
    {
      id: 'frame_builder',
      displayName: 'Çerçeve Kurucu',
      emoji: '▢',
      avatarType: 'metaphor',
      archetypeId: 'calm_panda',
      shortLabel: 'Sade çerçeve',
    },
    {
      id: 'focus_lens',
      displayName: 'Odak Merceği',
      emoji: '🔹',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Keskin odak',
    },
    {
      id: 'quiet_editor',
      displayName: 'Sakin Düzenleyici',
      emoji: '🪶',
      avatarType: 'human',
      archetypeId: 'calm_panda',
      shortLabel: 'Sadeleştirme',
    },
    {
      id: 'crystal_thinker',
      displayName: 'Kristal Düşünür',
      emoji: '💎',
      avatarType: 'metaphor',
      archetypeId: 'wise_owl',
      shortLabel: 'Net düşünce',
    },
  ],
  ideation_creation: [
    {
      id: 'idea_architect',
      displayName: 'Fikir Mimarı',
      emoji: '🏗️',
      avatarType: 'metaphor',
      archetypeId: 'creative_spirit',
      shortLabel: 'Fikir inşası',
    },
    {
      id: 'creative_chameleon',
      displayName: 'Yaratıcı Bukalemun',
      emoji: '🦎',
      avatarType: 'animal',
      archetypeId: 'creative_spirit',
      shortLabel: 'Çok renkli fikir',
    },
    {
      id: 'story_weaver',
      displayName: 'Hikâye Dokuyucu',
      emoji: '📖',
      avatarType: 'human',
      archetypeId: 'creative_spirit',
      shortLabel: 'Kurgu ve ilham',
    },
    {
      id: 'spark_gardener',
      displayName: 'Kıvılcım Bahçıvanı',
      emoji: '🌿',
      avatarType: 'plant',
      archetypeId: 'creative_spirit',
      shortLabel: 'Büyüyen fikirler',
    },
    {
      id: 'draft_master',
      displayName: 'Taslak Ustası',
      emoji: '✏️',
      avatarType: 'human',
      archetypeId: 'creative_spirit',
      shortLabel: 'İlk taslak',
    },
  ],
  deep_thinking: [
    {
      id: 'thoughtful_hedgehog',
      displayName: 'Düşünceli Kirpi',
      emoji: '🦔',
      avatarType: 'animal',
      archetypeId: 'calm_panda',
      shortLabel: 'Derin düşünce',
    },
    {
      id: 'layer_opener',
      displayName: 'Katman Açıcı',
      emoji: '📚',
      avatarType: 'metaphor',
      archetypeId: 'wise_owl',
      shortLabel: 'Katman katman',
    },
    {
      id: 'moon_philosopher',
      displayName: 'Ay Felsefecisi',
      emoji: '🌙',
      avatarType: 'metaphor',
      archetypeId: 'calm_panda',
      shortLabel: 'Gece netliği',
    },
    {
      id: 'context_seeker',
      displayName: 'Bağlam Arayan',
      emoji: '🔗',
      avatarType: 'human',
      archetypeId: 'wise_owl',
      shortLabel: 'Bağlam kurma',
    },
    {
      id: 'quiet_depth',
      displayName: 'Sessiz Derinlik',
      emoji: '🌊',
      avatarType: 'metaphor',
      archetypeId: 'calm_panda',
      shortLabel: 'Sakin derinlik',
    },
  ],
  sensitive_careful: [
    {
      id: 'compassionate_deer',
      displayName: 'Şefkatli Geyik',
      emoji: '🦌',
      avatarType: 'animal',
      archetypeId: 'compassionate_deer',
      shortLabel: 'Yumuşak özen',
    },
    {
      id: 'gentle_guardian',
      displayName: 'Nazik Koruyucu',
      emoji: '🛡️',
      avatarType: 'human',
      archetypeId: 'bridge_builder',
      shortLabel: 'Güvenli çerçeve',
    },
    {
      id: 'careful_listener',
      displayName: 'Dikkatli Dinleyici',
      emoji: '👂',
      avatarType: 'human',
      archetypeId: 'bridge_builder',
      shortLabel: 'Duyarlı tempo',
    },
    {
      id: 'soft_boundary',
      displayName: 'Yumuşak Sınır',
      emoji: '🌸',
      avatarType: 'metaphor',
      archetypeId: 'compassionate_deer',
      shortLabel: 'Özenli sınır',
    },
    {
      id: 'warm_shelter',
      displayName: 'Sıcak Sığınak',
      emoji: '🏠',
      avatarType: 'metaphor',
      archetypeId: 'bridge_builder',
      shortLabel: 'Güvenli alan',
    },
  ],
  fast_practical: [
    {
      id: 'swift_squirrel',
      displayName: 'Çevik Sincap',
      emoji: '🐿️',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'Hızlı netlik',
    },
    {
      id: 'practical_fixer',
      displayName: 'Pratik Çözücü',
      emoji: '🔧',
      avatarType: 'human',
      archetypeId: 'wise_owl',
      shortLabel: 'Uygulanabilir adım',
    },
    {
      id: 'action_arrow',
      displayName: 'Aksiyon Oku',
      emoji: '➡️',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'İleri hareket',
    },
    {
      id: 'quick_pulse',
      displayName: 'Hızlı Nabız',
      emoji: '⚡',
      avatarType: 'metaphor',
      archetypeId: 'creative_spirit',
      shortLabel: 'Canlı tempo',
    },
    {
      id: 'checklist_guide',
      displayName: 'Liste Rehberi',
      emoji: '✅',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Net adımlar',
    },
  ],
  planning_structure: [
    {
      id: 'structure_beaver',
      displayName: 'Düzen Kunduzu',
      emoji: '🦫',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'Yapı kurma',
    },
    {
      id: 'blueprint_mind',
      displayName: 'Plan Zihni',
      emoji: '📐',
      avatarType: 'metaphor',
      archetypeId: 'calm_panda',
      shortLabel: 'Plan ve akış',
    },
    {
      id: 'calendar_keeper',
      displayName: 'Takvim Bekçisi',
      emoji: '📅',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Ritim ve düzen',
    },
    {
      id: 'system_weaver',
      displayName: 'Sistem Dokuyucu',
      emoji: '🧱',
      avatarType: 'metaphor',
      archetypeId: 'wise_owl',
      shortLabel: 'Sağlam yapı',
    },
    {
      id: 'route_planner',
      displayName: 'Rota Planlayıcı',
      emoji: '🗺️',
      avatarType: 'human',
      archetypeId: 'wise_owl',
      shortLabel: 'Net rota',
    },
  ],
  trust_verification: [
    {
      id: 'verifying_crow',
      displayName: 'Doğrulayan Karga',
      emoji: '🐦‍⬛',
      avatarType: 'animal',
      archetypeId: 'wise_owl',
      shortLabel: 'İkinci bakış',
    },
    {
      id: 'proof_seeker',
      displayName: 'Kanıt Arayan',
      emoji: '🔎',
      avatarType: 'human',
      archetypeId: 'wise_owl',
      shortLabel: 'Sağlama',
    },
    {
      id: 'careful_anchor',
      displayName: 'Temkinli Çapa',
      emoji: '⚓',
      avatarType: 'metaphor',
      archetypeId: 'bridge_builder',
      shortLabel: 'Güvenli tempo',
    },
    {
      id: 'reference_keeper',
      displayName: 'Referans Bekçisi',
      emoji: '📚',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Kaynak kontrolü',
    },
    {
      id: 'clear_lock',
      displayName: 'Net Kilit',
      emoji: '🔒',
      avatarType: 'object',
      archetypeId: 'wise_owl',
      shortLabel: 'Güvence arayışı',
    },
  ],
  balanced_calm: [
    {
      id: 'calm_panda',
      displayName: 'Sakin Panda',
      emoji: '🐼',
      avatarType: 'animal',
      archetypeId: 'calm_panda',
      shortLabel: 'Sakin denge',
    },
    {
      id: 'gentle_deer',
      displayName: 'Yumuşak Geyik',
      emoji: '🦌',
      avatarType: 'animal',
      archetypeId: 'compassionate_deer',
      shortLabel: 'Yumuşak akış',
    },
    {
      id: 'still_lake',
      displayName: 'Durgun Göl',
      emoji: '🌊',
      avatarType: 'metaphor',
      archetypeId: 'calm_panda',
      shortLabel: 'Sakin ritim',
    },
    {
      id: 'harmony_circle',
      displayName: 'Uyum Halkası',
      emoji: '☯️',
      avatarType: 'metaphor',
      archetypeId: 'bridge_builder',
      shortLabel: 'Dengeli uyum',
    },
    {
      id: 'quiet_observer',
      displayName: 'Sessiz Gözlemci',
      emoji: '👁️',
      avatarType: 'human',
      archetypeId: 'calm_panda',
      shortLabel: 'Gözlem ve denge',
    },
  ],
};

export type DailyAvatarPickInput = {
  mirrorSeed: string;
  cardDate: string;
  latestEntryAt: string;
  entryCount: number;
  personaFamilyId: PersonaFamilyId;
  storyTopicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  microMood?: MicroMoodId;
  intentFingerprint?: string;
};

function hashPickIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 19)) | 0;
  }
  return Math.abs(h) % length;
}

export function getBehaviorFamilyLabel(familyId: PersonaFamilyId): string {
  return BEHAVIOR_FAMILY_LABEL[familyId] ?? 'Denge Ailesi';
}

export function getDailyAvatarPool(familyId: PersonaFamilyId): DailyAvatarDefinition[] {
  return AVATARS_BY_FAMILY[familyId] ?? AVATARS_BY_FAMILY.balanced_calm;
}

export function buildDailyAvatarSeed(input: DailyAvatarPickInput): string {
  return [
    input.mirrorSeed,
    input.cardDate,
    input.latestEntryAt,
    String(input.entryCount),
    input.personaFamilyId,
    input.storyTopicKey,
    input.storyVariant ?? 'default',
    input.microMood ?? 'neutral',
    input.intentFingerprint ?? 'none',
  ].join('|');
}

export function pickDailyAvatar(
  familyId: PersonaFamilyId,
  input: DailyAvatarPickInput
): DailyAvatarDefinition {
  const pool = getDailyAvatarPool(familyId);
  const seed = buildDailyAvatarSeed(input);
  return pool[hashPickIndex(seed, pool.length)]!;
}
