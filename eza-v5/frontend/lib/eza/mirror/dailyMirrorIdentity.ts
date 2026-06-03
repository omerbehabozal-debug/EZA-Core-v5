/**
 * Daily Mirror identity layer — avatar, theme, scene concept (P0).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import {
  buildDailyAvatarSeed,
  getBehaviorFamilyLabel,
  pickDailyAvatar,
  type DailyAvatarDefinition,
  type DailyAvatarPickInput,
} from '@/lib/eza/mirror/dailyAvatarRegistry';
import { resolveDailyTheme } from '@/lib/eza/mirror/dailyThemeRegistry';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { MicroMoodId, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';

export type DailyMirrorIdentityLayer = {
  behaviorFamilyLabel: string;
  dailyAvatarId: string;
  dailyAvatarName: string;
  dailyAvatarEmoji: string;
  dailyAvatarType: DailyAvatarDefinition['avatarType'];
  dailyAvatarArchetypeId: DailyAvatarDefinition['archetypeId'];
  dailyThemeTitle: string;
  dailyThemeSubtitle: string;
  dailySceneConcept: string;
};

const SCENE_SCENE_FRAGMENTS: Partial<Record<SceneTopicKey, string>> = {
  travel: 'yeni rotaları ve ufku keşfediyor',
  architecture: 'mekân ve form üzerinde düşünüyor',
  finance: 'plan ve denge üzerinde duruyor',
  health: 'ritim ve iyi oluş için alan açıyor',
  friendship: 'bağ ve empati üzerinde duruyor',
  creativity: 'ilham ve fikir üretiyor',
  general: 'günün düşünceleri içinde sakin bir yansıma yapıyor',
};

const THEME_SCENE_OVERRIDES: Record<string, string> = {
  'Semerkant Yolculuğu': 'Semerkant meydanında rotasını inceliyor',
  'Mimari Tasarım': 'mimari form ve mekân kararlarını tartıyor',
  'Finansal Karar': 'finansal plan üzerinde netlik arıyor',
  'Sağlık & İyilik': 'iyi oluş ritmi için sakin bir alan kuruyor',
  'Ürün Stratejisi': 'ürün yönü ve öncelikleri netleştiriyor',
  'Araç Kararı': 'konfor ve sürüş deneyimini kıyaslıyor',
  'İlişki & Bağ': 'ilişki dengesini yumuşak bir çerçevede görüyor',
  'Keşif Yolculuğu': 'yeni bir yolculuk perspektifi arıyor',
  'Yaratıcı Akış': 'yaratıcı bir akışın içinde ilerliyor',
  'Günün Düşüncesi': 'günün düşünceleri içinde sakin bir yansıma yapıyor',
};

function latestEntryAt(entries: SavedBehavioralEntry[]): string {
  if (!entries.length) return '';
  const sorted = [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  return sorted[0]?.savedAt ?? '';
}

function buildSceneFragment(
  avatarName: string,
  themeTitle: string,
  topicKey: SceneTopicKey
): string {
  const override = THEME_SCENE_OVERRIDES[themeTitle];
  if (override) {
    return `${avatarName}, ${override}.`;
  }
  const fragment = SCENE_SCENE_FRAGMENTS[topicKey] ?? SCENE_SCENE_FRAGMENTS.general!;
  return `${avatarName}, ${fragment}.`;
}

export function composeDailyMirrorIdentity(input: {
  entries: SavedBehavioralEntry[];
  mirrorSeed: string;
  cardDate: string;
  personaFamilyId: PersonaFamilyId;
  storyTopicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  microMood?: MicroMoodId;
  intentFingerprint?: string;
}): DailyMirrorIdentityLayer {
  const latestAt = latestEntryAt(input.entries);
  const pickInput: DailyAvatarPickInput = {
    mirrorSeed: input.mirrorSeed,
    cardDate: input.cardDate,
    latestEntryAt: latestAt,
    entryCount: input.entries.length,
    personaFamilyId: input.personaFamilyId,
    storyTopicKey: input.storyTopicKey,
    storyVariant: input.storyVariant,
    microMood: input.microMood,
    intentFingerprint: input.intentFingerprint,
  };

  const avatar = pickDailyAvatar(input.personaFamilyId, pickInput);
  const theme = resolveDailyTheme(input.entries, input.storyTopicKey);

  return {
    behaviorFamilyLabel: getBehaviorFamilyLabel(input.personaFamilyId),
    dailyAvatarId: avatar.id,
    dailyAvatarName: avatar.displayName,
    dailyAvatarEmoji: avatar.emoji,
    dailyAvatarType: avatar.avatarType,
    dailyAvatarArchetypeId: avatar.archetypeId,
    dailyThemeTitle: theme.dailyThemeTitle,
    dailyThemeSubtitle: theme.dailyThemeSubtitle,
    dailySceneConcept: buildSceneFragment(
      avatar.displayName,
      theme.dailyThemeTitle,
      input.storyTopicKey
    ),
  };
}
