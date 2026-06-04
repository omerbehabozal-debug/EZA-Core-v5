/**
 * P3 — Daily Mirror viral share copy & identity-based export filenames.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

export const MIRROR_SHARE_HASHTAG = '#EZAİlişkiAynası';

export const MIRROR_SHARE_CURIOSITY_LINE = 'Seninki ne çıkacak?';

const FALLBACK_SHARE_TEXT = `Bugünkü AI ilişki aynama baktım ✨\n\n${MIRROR_SHARE_CURIOSITY_LINE}\n\n${MIRROR_SHARE_HASHTAG}`;

const TR_ASCII: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

const MAX_SLUG_PART_LEN = 36;
const MAX_FILENAME_LEN = 120;

/**
 * Güvenli dosya adı parçası — Türkçe karakterleri ASCII'ye çevirir.
 */
export function slugifyForFilename(value: string, maxLen = MAX_SLUG_PART_LEN): string {
  let s = value.trim();
  for (const [tr, ascii] of Object.entries(TR_ASCII)) {
    s = s.split(tr).join(ascii);
  }
  s = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s) return '';
  return s.length <= maxLen ? s : s.slice(0, maxLen).replace(/-+$/g, '');
}

function resolveCardDateIso(card: DailyMirrorCardModel, dateIso?: string): string {
  return card.date?.slice(0, 10) ?? dateIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

function resolveAvatarName(card: DailyMirrorCardModel): string {
  return card.dailyAvatarName?.trim() || card.characterName?.trim() || '';
}

function resolveThemeTitle(card: DailyMirrorCardModel): string {
  return card.dailyThemeTitle?.trim() || '';
}

function resolveMirrorMomentLine(card: DailyMirrorCardModel): string {
  const moment = card.mirrorMoment?.trim();
  if (moment) {
    const core = moment.endsWith('.') ? moment.slice(0, -1) : moment;
    return /^[“"']/.test(moment) ? moment : `“${core}.”`;
  }
  const tension = card.storyTensionTitle?.trim();
  if (!tension) return '';
  const core = tension.endsWith('.') ? tension.slice(0, -1) : tension;
  return `“${core}.”`;
}

function resolveBehaviorFamily(card: DailyMirrorCardModel): string {
  return card.behaviorFamilyLabel?.trim() || '';
}

/**
 * Viral paylaşım metni — günlük avatar + tema odaklı (mesaj içeriği yok).
 */
export function buildDailyMirrorShareText(card: DailyMirrorCardModel): string {
  const avatarName = resolveAvatarName(card);
  const themeTitle = resolveThemeTitle(card);
  const behaviorFamily = resolveBehaviorFamily(card);

  const momentLine = resolveMirrorMomentLine(card);

  if (avatarName && themeTitle) {
    const modeLine = `${avatarName} modundaydı ✨`;
    const lines = [
      'Bugün AI ile ilişkim:',
      modeLine,
      '',
      ...(momentLine ? [momentLine, ''] : []),
      MIRROR_SHARE_CURIOSITY_LINE,
      '',
      MIRROR_SHARE_HASHTAG,
    ];
    return lines.join('\n');
  }

  if (avatarName && behaviorFamily) {
    return [
      'Bugün ben:',
      avatarName,
      '',
      'AI ile ilişkim bugün',
      `${behaviorFamily}'nde şekillendi.`,
      '',
      MIRROR_SHARE_CURIOSITY_LINE,
      '',
      MIRROR_SHARE_HASHTAG,
    ].join('\n');
  }

  if (avatarName) {
    return [
      'Bugün ben:',
      avatarName,
      '',
      MIRROR_SHARE_CURIOSITY_LINE,
      '',
      MIRROR_SHARE_HASHTAG,
    ].join('\n');
  }

  return FALLBACK_SHARE_TEXT;
}

/**
 * Identity + tarih slug — örn. eza-yol-bulucu-semerkant-yolculugu-2026-06-04.png
 */
export function buildDailyMirrorExportFilename(
  card?: DailyMirrorCardModel | null,
  dateIso?: string
): string {
  const day = card ? resolveCardDateIso(card, dateIso) : dateIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  if (!card) {
    return `eza-daily-mirror-${day}.png`;
  }

  const avatarSlug = slugifyForFilename(resolveAvatarName(card));
  const themeSlug = slugifyForFilename(resolveThemeTitle(card));

  let base: string;
  if (avatarSlug && themeSlug) {
    base = `eza-${avatarSlug}-${themeSlug}-${day}.png`;
  } else if (avatarSlug) {
    base = `eza-${avatarSlug}-${day}.png`;
  } else {
    base = `eza-daily-mirror-${day}.png`;
  }

  if (base.length <= MAX_FILENAME_LEN) {
    return base;
  }

  const suffix = `-${day}.png`;
  const budget = MAX_FILENAME_LEN - suffix.length;
  const trimmed = base.slice(0, budget).replace(/-+$/g, '');
  return `${trimmed}${suffix}`;
}
