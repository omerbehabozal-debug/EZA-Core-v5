const SHOWN_PREFIX = 'saina_mirror_birth_shown:';
const DISMISSED_PREFIX = 'saina_mirror_birth_dismissed:';
const CREATED_PREFIX = 'saina_mirror_birth_created:';

export function markMirrorBirthShown(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${SHOWN_PREFIX}${chatId}`, '1');
}

export function isMirrorBirthShown(chatId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`${SHOWN_PREFIX}${chatId}`) === '1';
}

export function markMirrorBirthDismissed(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${DISMISSED_PREFIX}${chatId}`, '1');
}

export function isMirrorBirthDismissed(chatId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`${DISMISSED_PREFIX}${chatId}`) === '1';
}

export function markMirrorBirthMirrorCreated(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${CREATED_PREFIX}${chatId}`, '1');
}

export function isMirrorBirthMirrorCreated(chatId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`${CREATED_PREFIX}${chatId}`) === '1';
}

export function clearMirrorBirthSession(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${SHOWN_PREFIX}${chatId}`);
  sessionStorage.removeItem(`${DISMISSED_PREFIX}${chatId}`);
  sessionStorage.removeItem(`${CREATED_PREFIX}${chatId}`);
}
