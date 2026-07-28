/**
 * Prints a human-readable Mardin landing-v1 pipeline acceptance report.
 * Run: npx tsx scripts/validate-mardin-landing-v1.ts
 */

import { buildConversationMirrorEntries } from '../lib/eza/mirror/conversationMirrorEntries';
import { buildMirrorPayloadV3 } from '../lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildCuriosityFromInterpretation } from '../lib/eza/mirror-network/buildCuriosityFromInterpretation';
import {
  FORBIDDEN_INTERNAL_LABELS,
  FORBIDDEN_PUBLIC_LANDING_PHRASES,
  hashPublicMirrorLanding,
} from '../lib/eza/mirror-network/publicMirrorLanding';
import { pickMirrorLandingSurface } from '../lib/eza/mirror-network/landingSurface';
import type { MirrorInterpretationV1 } from '../lib/eza/mirror/mirrorInterpretationTypes';

const conversation = [
  {
    id: 'u1',
    text: 'Hiç Mardin’de oldun mu? Sarı taşlı sokaklarda, turistik yerlerden uzak mahallelerde dolaşmak istiyorum.',
    isUser: true,
    userScore: 88,
  },
  {
    id: 'a1',
    text: 'Mardin’de akşamüzeri sarı taş sokaklar ve uzak minare silueti çok sakin bir ritim kurar.',
    isUser: false,
    assistantScore: 91,
  },
  {
    id: 'u2',
    text: 'Tahta sandalyede çay içmek, çamaşır ipleri ve uzaktaki minare… Kalabalıktan uzak, yavaş bir akşam arıyorum.',
    isUser: true,
    userScore: 90,
  },
  {
    id: 'a2',
    text: 'Rota haritadan önce yürüyerek hissedilen bir mahalle akşamına kayabilir.',
    isUser: false,
    assistantScore: 92,
  },
];

const interpretation: MirrorInterpretationV1 = {
  version: 'mirror-interpretation-v1',
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary:
    "Turistik rotalardan uzakta Mardin'in mahalle hissini ve sakin bir çay anını arıyor.",
  rationale: 'Quiet local Mardin evening.',
  imageIntent:
    'Turistik olmayan şehir köşeleri, yerel mahalle atmosferi ve sessiz şehir deneyimleri üzerine konuşmayı sürdür.',
  visualNarrative:
    'Sarı taşlı bir sokakta, çamaşır ipleri ve uzaktaki minareler arasında tahta sandalyede içilen sakin bir çay anı.',
  topicCategory: 'travel',
  atmosphereHint: 'serene and inviting',
  exclusions: ['modern buildings', 'tourist crowds'],
  confidence: 0.92,
};

async function main() {
  const entries = buildConversationMirrorEntries(conversation);
  const payload = buildMirrorPayloadV3(entries, {
    conversationId: 'chat-mardin-landing-v1-acceptance',
    seed: 'mardin-landing-v1-acceptance',
    conversationTexts: conversation.map((m) => m.text),
  });
  const built = buildCuriosityFromInterpretation(interpretation);
  const landing = built.publicLanding;
  const publicLandingHash = await hashPublicMirrorLanding(landing);

  const surface = pickMirrorLandingSurface({
    slug: 'mardin-de-sessiz-bir-aksam-test01',
    shareUrl: 'https://saina.app/m/mardin-de-sessiz-bir-aksam-test01',
    cardTitle: landing.publicTitle,
    cardDate: '2026-07-26',
    sceneImageUrl: 'https://cdn.example/mardin-landing-v1.png',
    coreCuriosity: landing.continuationContext,
    curiosityContext: landing.publicSummary,
    landingContext: landing.publicSummary,
    publicTitle: landing.publicTitle,
    publicSummary: landing.publicSummary,
    continuationContext: landing.continuationContext,
    contractVersion: landing.contractVersion,
    interpretationHash: landing.interpretationHash,
    publicLandingHash,
    seed: { topicCategory: 'travel', mood: 'discovery' },
  });

  const banned = [
    ...FORBIDDEN_INTERNAL_LABELS.filter((x) => landing.publicSummary.includes(x)),
    ...FORBIDDEN_PUBLIC_LANDING_PHRASES.filter((x) =>
      landing.publicSummary.toLowerCase().includes(x)
    ),
  ];

  const report = {
    accepted: banned.length === 0 && /Mardin/i.test(landing.publicTitle),
    stages: {
      conversationTurns: conversation.length,
      entryCount: entries.length,
      cueHints: entries.flatMap((e) => e.mirrorCueHints ?? []),
      evidenceLabels: (payload.conversationEvidence ?? []).map((e) => e.label),
      d2Title: interpretation.title,
      promptAnchor: interpretation.visualNarrative,
      image: 'scene generation uses D2 visualNarrative (URL assigned at generate-scene)',
      publicTitle: landing.publicTitle,
      publicSummary: landing.publicSummary,
      continuationContext: landing.continuationContext,
      discoverCard: {
        title: surface.cardTitle,
        description: surface.publicSummary,
      },
      landingPage: {
        title: surface.cardTitle,
        summary: surface.curiosityContext,
      },
      contractVersion: landing.contractVersion,
      interpretationHash: landing.interpretationHash,
      publicLandingHash,
    },
    bannedHits: banned,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.accepted) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
