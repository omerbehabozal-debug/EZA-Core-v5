/**
 * V4.5 — evidence fusion scene + world layer.
 * Single unified cinematic frame; evidence objects forbidden.
 */

import type { ConversationEvidence } from '@/lib/eza/mirror/conversationMirrorV3/conversationEvidenceLayer';
import { inferStoryTopicFromEvidence } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type EvidenceFusion = {
  heroScene: string;
  evidenceFusionScene: string;
  worldLayer: string;
};

const WORLD_LAYER_RULE = `Strengthen the topic identity inside the same single cinematic scene. World Layer must not create a second scene, collage, inset, panels, or object inventory. World Layer should appear as natural background, material, atmosphere, architectural rhythm, light, or environmental detail.`;

const UNIFIED_FRAME_RULE = `One unified cinematic frame. No collage. No inset images. No separate object panels. No moodboard. No split frame. No secondary image boxes.`;

function evidenceBlob(evidence: readonly ConversationEvidence[]): string {
  return evidence.map((item) => `${item.label} ${item.visualHint}`).join(' ').toLowerCase();
}

function hasHint(blob: string, pattern: RegExp): boolean {
  return pattern.test(blob);
}

const WORLD_LAYER_BY_TOPIC: Record<StoryTopicId, string> = {
  travel:
    'Traditional Japanese wooden facade rhythm lines the street. Wet stone catches lantern reflections. A faint city ridge in background haze. Subtle crimson lantern accents — never tourism props, pagoda checklist, kimono cliché, Mount Fuji, or postcard layout.',
  architecture:
    'Material samples and facade sketches on a ledge in the same light. Light-shadow across the elevation reveals window proportion. Small model detail in periphery — never villa render, real-estate listing, or stock architecture.',
  technology_ai:
    'Open notes, connection lines, and a quiet data schema on the desk in the same lamp pool. Open book and soft screen glow — never robot, neon brain, hologram, or cyberpunk.',
  vehicle:
    'Garage concrete texture, controlled side light, faint highway glow through a distant window. Comparison notes on the same console — never car ad layout or separate product shots.',
  health:
    'Morning window light and ceramic counter texture in one domestic frame — never clinical ad or product catalog.',
  spiritual_reflection:
    'Stone paving, courtyard depth, calligraphy shadow, soft lantern warmth — never mosque postcard or staged pilgrimage poster.',
  finance:
    'Threshold light and paper texture on one desk — never dashboard or stock finance template.',
  food_culture:
    'Warm kitchen atmosphere and recipe paper texture — never food advertisement layout.',
  family:
    'Shared home light and table wood grain — never stock family template.',
  education:
    'Desk lamp pool and paper texture — never classroom stock photo.',
  general_curiosity:
    'Directional light and surface texture around one object of inquiry — never moodboard or object grid.',
};

function fuseTravel(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene =
    'Gion evening street — warm lanterns, narrow pavement, quiet walking route, one continuous documentary frame.';
  const parts: string[] = [
    'A narrow Kyoto evening street in Gion fills the frame as a single uninterrupted environment.',
    'Warm lanterns illuminate the walking route along the pavement.',
  ];
  if (hasHint(blob, /cafe|tea|window|kafe/)) {
    parts.push('A small cafe window glows softly beside the street.');
  }
  if (hasHint(blob, /notebook|map|route|ticket|rota|defter/)) {
    parts.push(
      'A partially opened travel notebook rests on a cafe table; a train ticket peeks from between its pages.'
    );
  }
  if (hasHint(blob, /travel|japan|japonya|atmosphere|rhythm/)) {
    parts.push('Evening light settles over the street with quiet Japanese urban rhythm.');
  }
  parts.push(
    'All conversation traces exist naturally inside the same scene — discovered by the eye, never as separate panels.'
  );
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseArchitecture(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene =
    'Modern facade at editorial scale — material decision, proportion, measured light, one frame.';
  const parts: string[] = [
    'A dramatic modern building facade dominates the frame under controlled editorial light.',
  ];
  if (hasHint(blob, /material|sample|stone|metal|malzeme|texture|doku/)) {
    parts.push(
      'Material samples and surface textures catch side light along the facade plane, integrated into the wall surface.'
    );
  }
  if (hasHint(blob, /sketch|drawing|model|eskiz/)) {
    parts.push('An architectural sketch lies open on a ledge beside the facade, lit by the same source.');
  }
  if (hasHint(blob, /proportion|light|shadow|gölge/)) {
    parts.push('Light and shadow articulate proportion across the elevation in one continuous composition.');
  }
  parts.push('Every detail belongs to one architectural environment — no object catalog, no inset panels.');
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseTechnologyAi(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene =
    'Research desk under one lamp — screen reflection, human inquiry, thinking in one quiet frame.';
  const parts: string[] = [
    'A research workspace fills the frame under a single motivated desk lamp.',
    'Notebooks, diagrams, and a softly glowing screen share the same wooden surface as one thinking environment.',
  ];
  if (hasHint(blob, /diagram|chart|flow|schema/)) {
    parts.push('Hand-drawn diagrams spread across an open page, lit by the same warm source.');
  }
  if (hasHint(blob, /screen|monitor|reflection/)) {
    parts.push('The screen reflection mingles with paper notes in the same shallow depth of field.');
  }
  parts.push('All traces of inquiry exist inside one desk environment — one frame, one light.');
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseVehicle(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene =
    'Dark garage interior — two premium sedan silhouettes, side light, one comparison frame.';
  const parts: string[] = [
    'A quiet garage interior holds the entire frame under controlled side light.',
    'Two premium sedan silhouettes stand side by side in the same space.',
  ];
  if (hasHint(blob, /key|anahtar/)) {
    parts.push('Car keys rest on a console between the vehicles, caught by the same light.');
  }
  if (hasHint(blob, /notebook|note|route|list|karşılaştırma/)) {
    parts.push('A handwritten comparison note lies open on the console, lit from the same source.');
  }
  parts.push('Every detail belongs to one garage environment — no separate product shots.');
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseHealth(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene = 'Calm bathroom counter at morning light — personal ritual in one frame.';
  const parts: string[] = [
    'A calm bathroom counter fills the frame in soft morning light.',
    'Two personal-care products stand side by side on the same surface.',
  ];
  if (hasHint(blob, /brush|sink|tezgâh|counter/)) {
    parts.push('The sink and counter share one quiet domestic plane under natural window light.');
  }
  parts.push('All ritual traces exist in one personal space — no clinical close-up, no product ad layout.');
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseSpiritual(blob: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene =
    'Historic courtyard — stone paving, calligraphy, lantern light, one sacred frame.';
  const parts: string[] = [
    'A historic courtyard fills the frame with stone paving and quiet architecture.',
    'Soft lantern light washes across calligraphy detail on the wall.',
  ];
  if (hasHint(blob, /prayer|mosque|avlu|courtyard/)) {
    parts.push('The courtyard depth recedes naturally — one environment, one contemplative frame.');
  }
  parts.push('Every sacred trace belongs to the same architectural space — no symbolic substitution.');
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

function fuseGeneric(blob: string, selectedTopic: string): Omit<EvidenceFusion, 'worldLayer'> {
  const heroScene = `One focused environment for "${selectedTopic}" — single inquiry, single light.`;
  const parts: string[] = [
    `A single focused environment holds the frame for ${selectedTopic}.`,
    'One concrete object of inquiry sits under directional light on a quiet surface.',
    'All conversation traces belong to this one space — no collage, no inventory layout.',
  ];
  if (hasHint(blob, /desk|masa|notebook|defter/)) {
    parts[1] =
      'An open notebook and a single object of inquiry share one desk surface under directional light.';
  }
  return { heroScene, evidenceFusionScene: parts.join(' ') };
}

const FUSION_BY_TOPIC: Record<
  StoryTopicId,
  (blob: string, selectedTopic: string) => Omit<EvidenceFusion, 'worldLayer'>
> = {
  travel: (blob) => fuseTravel(blob),
  architecture: (blob) => fuseArchitecture(blob),
  technology_ai: (blob) => fuseTechnologyAi(blob),
  vehicle: (blob) => fuseVehicle(blob),
  health: (blob) => fuseHealth(blob),
  spiritual_reflection: (blob) => fuseSpiritual(blob),
  finance: (blob) => fuseGeneric(blob, 'financial planning'),
  food_culture: (blob) => fuseGeneric(blob, 'food culture'),
  family: (blob) => fuseGeneric(blob, 'home life'),
  education: (blob) => fuseGeneric(blob, 'learning'),
  general_curiosity: (blob, selectedTopic) => fuseGeneric(blob, selectedTopic),
};

export function resolveEvidenceFusion(input: {
  evidence: readonly ConversationEvidence[];
  storyTopicId: StoryTopicId;
  selectedTopic: string;
}): EvidenceFusion {
  const topicId = inferStoryTopicFromEvidence(
    input.storyTopicId,
    input.evidence,
    input.selectedTopic
  );
  const blob = evidenceBlob(input.evidence);
  const fuse = FUSION_BY_TOPIC[topicId] ?? FUSION_BY_TOPIC.general_curiosity;
  const core = fuse(blob, input.selectedTopic);
  return {
    ...core,
    worldLayer: WORLD_LAYER_BY_TOPIC[topicId] ?? WORLD_LAYER_BY_TOPIC.general_curiosity,
  };
}

export function formatEvidenceFusionBlock(fusion: EvidenceFusion): string {
  return [
    'Evidence fusion scene (70% — single frame, single environment):',
    fusion.evidenceFusionScene,
    '',
    `Hero anchor: ${fusion.heroScene}`,
    '',
    'World Layer:',
    fusion.worldLayer,
    '',
    'World Layer rule:',
    WORLD_LAYER_RULE,
    '',
    'Unified frame rule:',
    UNIFIED_FRAME_RULE,
    '',
    'Fusion rule: Evidence embedded in one frame — discovered naturally, never as separate panels or object catalogs.',
  ].join('\n');
}

export { WORLD_LAYER_RULE, UNIFIED_FRAME_RULE };
