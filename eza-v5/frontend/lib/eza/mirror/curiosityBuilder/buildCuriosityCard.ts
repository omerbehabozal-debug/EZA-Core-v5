/**
 * Mirror V6 — Curiosity Builder
 *
 * Semantic Anchors → Curiosity Builder → Public Landing
 *
 * Inputs: D2 interpretation + Semantic Anchors only.
 * Never: V3 curiosity, CATEGORY labels, cluster names, headline fallback, storySummary.
 *
 * Output: publicTitle, publicSummary, continuationContext
 * Then Click Test; one alternate regenerate on fail.
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import { runCuriosityClickTest } from '@/lib/eza/mirror/curiosityBuilder/clickTest';
import type {
  CuriosityBuilderLocale,
  CuriosityBuilderOutput,
} from '@/lib/eza/mirror/curiosityBuilder/types';
import { MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION } from '@/lib/eza/mirror/curiosityBuilder/types';

export type BuildCuriosityCardInput = {
  anchors: MirrorSemanticAnchorsV1;
  /** D2 only — used sparingly when anchors are sparse; never V3 fields. */
  interpretation?: Pick<
    MirrorInterpretationV1,
    'title' | 'interpretationSummary' | 'imageIntent' | 'atmosphereHint'
  > | null;
  locale?: string | null;
};

function resolveLocale(locale?: string | null): CuriosityBuilderLocale {
  const raw = (locale || 'tr').trim().toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ar')) return 'ar';
  return 'tr';
}

function clean(text: string, max = 280): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function ensurePeriod(text: string): string {
  const t = clean(text, 320);
  if (!t) return t;
  if (/[.!?…]$/.test(t)) return t;
  return `${t}.`;
}

function titleWordClamp(title: string, maxWords = 8): string {
  const words = clean(title, 80).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

function criteriaPhrase(criteria: string[], locale: CuriosityBuilderLocale): string {
  const list = criteria.slice(0, 3);
  if (!list.length) return locale === 'en' ? 'feel and comfort' : 'his ve konfor';
  if (locale === 'en') return list.join(', ');
  return list.join(', ');
}

type Draft = {
  publicTitle: string;
  publicSummary: string;
  continuationContext: string;
};

function draftVehicleCompare(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft | null {
  const topic = (anchors.topic || '').toLowerCase();
  const blob = [
    anchors.topic,
    anchors.userIntent,
    anchors.question,
    ...anchors.decisionCriteria,
    ...anchors.scene,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isSuv =
    /bmw|x3|mercedes|glc/.test(topic) || /bmw|x3|mercedes|glc/.test(blob);
  if (!isSuv) return null;

  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);

  if (locale === 'en') {
    if (variant === 0) {
      return {
        publicTitle: titleWordClamp('BMW X3 or Mercedes GLC?'),
        publicSummary: ensurePeriod(
          `Between two family SUVs, the real split is ${criteria} — not the brochure numbers`
        ),
        continuationContext: clean(
          `Stay with the X3 vs GLC dilemma through ${criteria}; keep asking which cabin feels calmer on a long road.`,
          280
        ),
      };
    }
    return {
      publicTitle: titleWordClamp('Sporty feel or quiet ride?'),
      publicSummary: ensurePeriod(
        `The choice turns on which cabin feels more at peace — ${criteria} over specs`
      ),
      continuationContext: clean(
        `Continue the family SUV fork: chase the quieter, more settled drive rather than a catalog duel.`,
        280
      ),
    };
  }

  // tr / ar (tr editorial for now)
  if (variant === 0) {
    return {
      publicTitle: titleWordClamp('BMW X3 mü Mercedes GLC mi?'),
      publicSummary: ensurePeriod(
        `Aile SUV’sinde asıl ayrım ${criteria}; teknik listeden çok hangi kabinin daha huzurlu hissettirdiği konuşuluyor`
      ),
      continuationContext: clean(
        `X3 ile GLC ikileminde ${criteria} üzerinden devam et; katalog düellosu yerine uzun yolda hangi kabinin daha sakin kaldığını sor.`,
        280
      ),
    };
  }
  return {
    publicTitle: titleWordClamp('Sportif his mi huzurlu sürüş mü?'),
    publicSummary: ensurePeriod(
      `Kararı motor değil his veriyor — ${criteria} hangisinde daha doğru hissediliyor`
    ),
    continuationContext: clean(
      `Aynı aile SUV ikileminde kal; sessizlik ve konfor üzerinden hangi aracın daha huzurlu sürdüğünü aç.`,
      280
    ),
  };
}

function draftPlaceEvening(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft | null {
  const place = anchors.place?.trim();
  if (!place) return null;

  const emotion = anchors.emotion.slice(0, 2).join(', ') || (locale === 'en' ? 'quiet' : 'sessiz');
  const localCue =
    anchors.scene.find((s) => /çay|sandalye|sokak|mahalle|chair|tea|street/i.test(s)) ||
    (locale === 'en' ? 'local street' : 'yerel sokak');

  if (locale === 'en') {
    if (variant === 0) {
      return {
        publicTitle: titleWordClamp(`${place}: tourist route or local dusk?`),
        publicSummary: ensurePeriod(
          `The pull is a ${emotion} evening on a real street — ${localCue} — not a postcard itinerary`
        ),
        continuationContext: clean(
          `Stay with ${place}’s local pace; keep asking what a quiet dusk feels like away from tourist routes.`,
          280
        ),
      };
    }
    return {
      publicTitle: titleWordClamp(`Why does ${place} feel this quiet?`),
      publicSummary: ensurePeriod(
        `Curiosity sits in the small pause — ${localCue} — where the city turns local instead of scenic`
      ),
      continuationContext: clean(
        `Continue the ${place} evening without postcard language; chase the lived neighborhood hush.`,
        280
      ),
    };
  }

  if (variant === 0) {
    return {
      publicTitle: titleWordClamp(`${place}'de turist mi yerel akşam mı?`),
      publicSummary: ensurePeriod(
        `Merak, kartpostal rota değil; ${emotion} bir mahalle anında — ${localCue} — şehrin nasıl yaşandığında`
      ),
      continuationContext: clean(
        `${place}’in yerel temposunda kal; turistik klişelerden uzak, sakin bir akşamın nasıl hissedildiğini sor.`,
        280
      ),
    };
  }
  return {
    publicTitle: titleWordClamp(`${place}'de neden bu kadar sessiz?`),
    publicSummary: ensurePeriod(
      `Asıl çekim, manzara listesi değil; ${localCue} ile açılan küçük bir durak — şehrin yerel hali`
    ),
    continuationContext: clean(
      `${place} akşamını kartpostal dilinden uzak tut; mahallenin kendi temposunu merak etmeye devam et.`,
      280
    ),
  };
}

function draftFromQuestion(
  anchors: MirrorSemanticAnchorsV1,
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft | null {
  const q = clean(anchors.question || '', 72);
  if (!q) return null;
  const title = titleWordClamp(q.includes('?') ? q : `${q}?`);
  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);
  const intent = clean(anchors.userIntent || anchors.topic || '', 100);

  if (locale === 'en') {
    const summary =
      variant === 0
        ? ensurePeriod(
            intent
              ? `${intent} — the interesting part is what actually decides it: ${criteria}`
              : `The open question is what pulls you in; ${criteria} sets the stakes`
          )
        : ensurePeriod(
            `Same fork, sharper stakes: ${criteria} decide more than a neat answer`
          );
    return {
      publicTitle: title,
      publicSummary: summary,
      continuationContext: clean(
        `Stay with “${clean(q, 60)}”; keep pressure on ${criteria}.`,
        280
      ),
    };
  }

  const summary =
    variant === 0
      ? ensurePeriod(
          intent
            ? `${intent} — asıl merak, kararı neyin belirlediği: ${criteria}`
            : `Açık soru içeri çeker; ${criteria} bahsi yükseltir`
        )
      : ensurePeriod(
          `Aynı ikilem, daha net bahis: ${criteria} düzgün bir cevaptan daha çok belirler`
        );
  return {
    publicTitle: title,
    publicSummary: summary,
    continuationContext: clean(
      `“${clean(q, 60)}” sorusunda kal; ${criteria} üzerinden derinleştir.`,
      280
    ),
  };
}

function draftFromTopicOrIntent(
  anchors: MirrorSemanticAnchorsV1,
  interpretation: BuildCuriosityCardInput['interpretation'],
  locale: CuriosityBuilderLocale,
  variant: 0 | 1
): Draft {
  const topic = clean(anchors.topic || interpretation?.title || '', 64);
  const intent = clean(anchors.userIntent || interpretation?.interpretationSummary || '', 120);
  const criteria = criteriaPhrase(anchors.decisionCriteria, locale);
  const emotion = anchors.emotion[0] || (locale === 'en' ? 'quiet' : 'sessiz');

  if (locale === 'en') {
    const title = titleWordClamp(
      variant === 0
        ? topic
          ? `${topic}?`
          : `What actually settles this?`
        : intent
          ? `${intent.split(/\s+/).slice(0, 6).join(' ')}?`
          : `Where does the real tension sit?`
    );
    return {
      publicTitle: title,
      publicSummary: ensurePeriod(
        intent
          ? `${intent} — interesting because ${criteria} outweigh a tidy label`
          : `The pull is ${emotion} stakes around ${criteria}, not a category label`
      ),
      continuationContext: clean(
        `Continue the same curiosity: ${topic || intent || criteria}; stay human, not catalog.`,
        280
      ),
    };
  }

  const title = titleWordClamp(
    variant === 0
      ? topic
        ? topic.includes('?')
          ? topic
          : `${topic}?`
        : 'Asıl gerilim nerede?'
      : intent
        ? `${intent.split(/\s+/).slice(0, 6).join(' ')}?`
        : 'Kararı ne belirliyor?'
  );
  return {
    publicTitle: title,
    publicSummary: ensurePeriod(
      intent
        ? `${intent} — ilginç tarafı, ${criteria}nin düzgün bir etiketten daha ağır basması`
        : `Çekim, kategori değil; ${emotion} bir bahiste ${criteria}`
    ),
    continuationContext: clean(
      `Aynı merakı sürdür: ${topic || intent || criteria}; katalog dili değil, insanî gerilim.`,
      280
    ),
  };
}

function buildDraft(
  input: BuildCuriosityCardInput,
  variant: 0 | 1
): Draft {
  const locale = resolveLocale(input.locale);
  const anchors = input.anchors;

  return (
    draftVehicleCompare(anchors, locale, variant) ||
    draftPlaceEvening(anchors, locale, variant) ||
    draftFromQuestion(anchors, locale, variant) ||
    draftFromTopicOrIntent(anchors, input.interpretation, locale, variant)
  );
}

/**
 * Build editorial discover card from Semantic Anchors (+ optional D2 fields).
 * Runs Click Test; regenerates once on failure.
 */
export function buildCuriosityCard(input: BuildCuriosityCardInput): CuriosityBuilderOutput {
  const primary = buildDraft(input, 0);
  const primaryTest = runCuriosityClickTest(primary);

  if (primaryTest.passed) {
    return {
      contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
      ...primary,
      variant: 0,
      clickTestPassed: true,
      clickTestFailures: [],
    };
  }

  const alternate = buildDraft(input, 1);
  const altTest = runCuriosityClickTest(alternate);

  // Prefer alternate if it passes; otherwise keep primary but surface failures.
  if (altTest.passed) {
    return {
      contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
      ...alternate,
      variant: 1,
      clickTestPassed: true,
      clickTestFailures: primaryTest.failures,
    };
  }

  // Both failed — return alternate (often sharper) with failures for diagnostics.
  return {
    contractVersion: MIRROR_CURIOSITY_BUILDER_CONTRACT_VERSION,
    ...alternate,
    variant: 1,
    clickTestPassed: false,
    clickTestFailures: Array.from(
      new Set([...primaryTest.failures, ...altTest.failures])
    ),
  };
}

/** Same anchors → same curiosity card (deterministic). */
export function curiosityCardFingerprint(card: CuriosityBuilderOutput): string {
  return `${card.publicTitle}||${card.publicSummary}||${card.continuationContext}`;
}
