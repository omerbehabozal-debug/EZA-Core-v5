export const YANSI_EXPERIENCE_TYPES = [
  'knowledge',
  'fun',
  'story',
  'discussion',
  'life',
] as const;

export const YANSI_CONTENT_NATURES = ['real', 'fiction', 'mixed'] as const;

export type YansiExperienceType = (typeof YANSI_EXPERIENCE_TYPES)[number];
export type YansiContentNature = (typeof YANSI_CONTENT_NATURES)[number];

export type YansiContentIdentity = {
  experienceType?: YansiExperienceType;
  contentNature?: YansiContentNature;
};

const EXPERIENCE_LABELS: Record<YansiExperienceType, string> = {
  knowledge: 'Bilgi',
  fun: 'Eğlence',
  story: 'Hikâye',
  discussion: 'Tartışma',
  life: 'Günlük yaşam',
};

const NATURE_LABELS: Record<YansiContentNature, string> = {
  real: 'Gerçek anlatım',
  fiction: 'Kurmaca',
  mixed: 'Karma',
};

export function parseExperienceType(value: unknown): YansiExperienceType | null {
  return typeof value === 'string' &&
    (YANSI_EXPERIENCE_TYPES as readonly string[]).includes(value)
    ? (value as YansiExperienceType)
    : null;
}

export function parseContentNature(value: unknown): YansiContentNature | null {
  return typeof value === 'string' &&
    (YANSI_CONTENT_NATURES as readonly string[]).includes(value)
    ? (value as YansiContentNature)
    : null;
}

export function experienceTypeLabel(value: unknown): string | null {
  const parsed = parseExperienceType(value);
  return parsed ? EXPERIENCE_LABELS[parsed] : null;
}

export function contentNatureLabel(value: unknown): string | null {
  const parsed = parseContentNature(value);
  return parsed ? NATURE_LABELS[parsed] : null;
}

/** Shown when the Yansı was published but this response did not confirm the labels. */
export const YANSI_IDENTITY_UNCONFIRMED_MESSAGE =
  'Yansı yayınlandı. Seçilen etiket bu yanıtta doğrulanamadı; mevcut mühür değiştirilmedi.';

export type ContentIdentityEcho = 'absent' | 'confirmed' | 'unconfirmed';

/**
 * A successful publish response may omit labels. That is not a failed publish.
 * Missing or different labels mean the seal was not updated in this response.
 */
export function classifyContentIdentityEcho(
  wanted: YansiContentIdentity | null | undefined,
  echoed: { experienceType?: string | null; contentNature?: string | null } | null | undefined
): ContentIdentityEcho {
  const experienceType = parseExperienceType(wanted?.experienceType);
  const contentNature = parseContentNature(wanted?.contentNature);
  if (!experienceType && !contentNature) return 'absent';
  const echoType = parseExperienceType(echoed?.experienceType);
  const echoNature = parseContentNature(echoed?.contentNature);
  if (experienceType && echoType !== experienceType) return 'unconfirmed';
  if (contentNature && echoNature !== contentNature) return 'unconfirmed';
  return 'confirmed';
}

export function contentIdentityRequestFields(
  identity?: YansiContentIdentity | null
): { experienceType?: YansiExperienceType; contentNature?: YansiContentNature } {
  const experienceType = parseExperienceType(identity?.experienceType);
  const contentNature = parseContentNature(identity?.contentNature);
  return {
    ...(experienceType ? { experienceType } : {}),
    ...(contentNature ? { contentNature } : {}),
  };
}
