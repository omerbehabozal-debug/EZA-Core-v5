/**
 * Phase 3 live prepare closure (frontend layers).
 *
 * 1) Case A vs B scoped client identity (same confirmed 8; B source has Rome+SECRET).
 * 2) Consumes the live-prepare fixture produced by the real backend D2 path
 *    (`tests/helpers/journey_scoped_live_prepare_runner.py` + reflective LLM mock).
 *    Backend pytest regenerates/asserts that fixture on every run.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReview8DraftFromWindow,
  clearAllReview8Drafts,
  confirmReview8Draft,
  extractQaPairs,
  resolveScopedJourneyMeaning,
  saveReview8Draft,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import { buildSemanticAnchors } from '@/lib/eza/mirror/semanticAnchors';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import { extractHardClaims } from '@/lib/eza/mirror/narrativeAlignment/extractHardClaims';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

const ROME_RE =
  /roma\b|roman\s+empire|imparatorlu[gğ]u|caesar|senato|antik\s+tarih|ancient\s+history|colosseum|augustus/i;
const SECRET = 'SECRET_PERSON_42';
const BMW_RE = /bmw|x3|mercedes|glc|suv|aile/i;

function msg(
  id: string,
  text: string,
  opts: Partial<JourneyMessageLike> = {}
): JourneyMessageLike {
  return { id, text, role: opts.role, isUser: opts.isUser };
}

function bmwPairs(): JourneyMessageLike[] {
  const qa: Array<[string, string]> = [
    [
      'BMW X3 ve Mercedes GLC aile SUV olarak nasıl karşılaştırılır?',
      'X3 daha sportif sürüş, GLC daha konfor odaklı bir aile SUV hissi verir.',
    ],
    [
      'Aile için bagaj hacmi ve arka koltuk konforu hangisinde daha iyi?',
      'GLC bagaj ve arka sıra konforunda genelde bir adım önde; X3 daha sürücü odaklı.',
    ],
    [
      'Şehir içi kullanımda X3 mü GLC mi daha pratik?',
      'İkisi de şehirde kullanılabilir; X3 dönüş çapı ve çeviklikle öne çıkabilir.',
    ],
    [
      'Uzun yolda sessizlik ve konfor kriterim var, ne önerirsin?',
      'Uzun yol konforu için GLC daha sakin bir aile SUV tercihi olabilir.',
    ],
    [
      'Güvenlik donanımları açısından aile SUV seçiminde nelere bakmalıyım?',
      'Aktif güvenlik paketleri, ISOFIX ve görüş yardımcıları her iki modelde de kritik.',
    ],
    [
      'Yakıt tüketimi aile bütçesi için ne kadar fark eder?',
      'Sürüş tarzına bağlı; şehir içi yoğun kullanımda fark daha belirgin olabilir.',
    ],
    [
      'İkinci el değerini de düşünerek BMW X3 mi Mercedes GLC mi?',
      'Segmentte ikisi de güçlü; bakım maliyeti ve donanım paketi kararını etkiler.',
    ],
    [
      'Son karar: aile SUV olarak hangisini seçmeliyim?',
      'Konfor öncelikliyse GLC, dinamik sürüş istiyorsan X3 mantıklı bir kapanış.',
    ],
  ];
  const out: JourneyMessageLike[] = [];
  qa.forEach(([q, a], i) => {
    const n = i + 1;
    out.push(msg(`u${n}`, q, { role: 'user' }));
    out.push(msg(`a${n}`, a, { role: 'assistant' }));
  });
  return out;
}

function romePairs(start = 9): JourneyMessageLike[] {
  const topics = [
    'Roma İmparatorluğu tarihi nasıl başladı?',
    'Caesar ve senato ilişkisi neydi?',
    'Antik tarih ve Colosseum dönemi hakkında ne bilinir?',
    'Augustus reformları nelerdi?',
    'Roman Empire expansion nasıl ilerledi?',
    'Ancient history kaynakları neler?',
    `${SECRET} hakkında özel bir not var mı?`,
    'Senato ve imparatorluk dengesi nasıl bozuldu?',
  ];
  const out: JourneyMessageLike[] = [];
  topics.forEach((q, i) => {
    const n = start + i;
    out.push(msg(`u${n}`, q, { role: 'user' }));
    out.push(
      msg(`a${n}`, `Roma / ancient history cevap ${n}.`, { role: 'assistant' })
    );
  });
  return out;
}

function confirmWindow(
  pairs: ReturnType<typeof extractQaPairs>,
  journeyId: string,
  draftKey: string
) {
  const slice = pairs.slice(0, 8);
  const built = buildReview8DraftFromWindow({
    ownerUserId: 'user-live',
    sourceConversationId: 'conv-live-scoped',
    windowIndex: 0,
    pairs: slice,
    draftKey,
    titleSeed: journeyId,
  });
  const confirmed = confirmReview8Draft({ ...built, journeyId });
  if (!confirmed.ok) throw new Error('confirm failed');
  saveReview8Draft(confirmed.draft);
  return confirmed.draft;
}

type LivePreparePayload = {
  windowHash: string;
  scopedInputHash: string;
  contentHash: string | null;
  interpretationSource: string | null;
  finalInterpretation: MirrorInterpretationV1;
  mappedPrompt: { prompt: string; title: string } | null;
  scopedMessages: Array<{ role: string; text: string }>;
  journeyId: string;
};

function loadLivePrepareFixture(): LivePreparePayload {
  const fixturePath = path.resolve(
    __dirname,
    '../../backend/tests/fixtures/journey_scoped_live_prepare_b.json'
  );
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as LivePreparePayload;
}

describe('Journey Phase 3 live prepare closure', () => {
  beforeEach(() => clearAllReview8Drafts());
  afterEach(() => clearAllReview8Drafts());

  it('A≡B scoped prepare identity + live D2 isolation for landing/prompt/anchors/claims', () => {
    const draftA = confirmWindow(
      extractQaPairs(bmwPairs()),
      'journey-bmw-live',
      'win-live-a'
    );
    const draftB = confirmWindow(
      extractQaPairs([...bmwPairs(), ...romePairs(9)]),
      'journey-bmw-live',
      'win-live-b'
    );

    const scopedA = resolveScopedJourneyMeaning(draftA);
    const scopedB = resolveScopedJourneyMeaning(draftB);
    expect(scopedA.ok && scopedB.ok).toBe(true);
    if (!scopedA.ok || !scopedB.ok) return;

    expect(scopedA.messages).toEqual(scopedB.messages);
    expect(scopedA.windowHash).toBe(scopedB.windowHash);
    expect(scopedA.scopedInputHash).toBe(scopedB.scopedInputHash);
    const scopedBlob = scopedB.messages.map((m) => m.text).join('\n');
    expect(scopedBlob).toMatch(BMW_RE);
    expect(scopedBlob).not.toMatch(ROME_RE);
    expect(scopedBlob).not.toContain(SECRET);

    const live = loadLivePrepareFixture();
    expect(live.interpretationSource).toBe('d2_llm');
    expect(live.finalInterpretation).toBeTruthy();
    expect(live.mappedPrompt?.prompt).toBeTruthy();

    const liveUser = live.scopedMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.text);
    const clientUser = scopedB.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.text);
    expect(liveUser).toEqual(clientUser);

    const interp = live.finalInterpretation;
    const evidence = scopedB.messages
      .filter((m) => m.role === 'user')
      .map((m) => ({
        text: m.text,
        epistemic: 'user_stated' as const,
        kind: 'question',
        speaker: 'user',
      }));
    const anchors = buildSemanticAnchors({
      interpretation: interp,
      evidence,
      journeyProvenance: {
        journeyId: scopedB.scope.journeyId,
        windowHash: scopedB.windowHash,
      },
    });
    const landing = buildPublicMirrorLandingFromInterpretation(interp, {
      semanticAnchors: anchors,
      evidence,
      journeyProvenance: {
        journeyId: scopedB.scope.journeyId,
        windowHash: scopedB.windowHash,
      },
    });
    const claims = extractHardClaims({
      anchors,
      interpretation: interp,
      landing,
    });

    const d2Blob = JSON.stringify(interp);
    const landingBlob = `${landing.publicTitle} ${landing.publicSummary} ${landing.continuationContext}`;
    const promptBlob = `${live.mappedPrompt?.title ?? ''} ${live.mappedPrompt?.prompt ?? ''}`;
    const anchorsBlob = JSON.stringify(anchors);
    const claimsBlob = JSON.stringify(claims);

    for (const [label, blob] of [
      ['D2', d2Blob],
      ['landing', landingBlob],
      ['mappedPrompt', promptBlob],
      ['anchors', anchorsBlob],
      ['claims', claimsBlob],
    ] as const) {
      expect(blob, label).toMatch(BMW_RE);
      expect(blob, label).not.toMatch(ROME_RE);
      expect(blob, label).not.toContain(SECRET);
    }

    expect(anchors.anchorsScope).toBe('journey_window_v1');
    expect(landing.semanticAnchors?.anchorsScope).toBe('journey_window_v1');
  });
});
