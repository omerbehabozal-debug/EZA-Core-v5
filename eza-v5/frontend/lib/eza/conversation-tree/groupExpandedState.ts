const STORAGE_PREFIX = 'saina_group_expanded:';

export function readGroupExpanded(groupId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${groupId}`);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function writeGroupExpanded(groupId: string, expanded: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${groupId}`, expanded ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function rememberActiveGroupExpanded(groupId: string | null | undefined): void {
  if (!groupId) return;
  writeGroupExpanded(groupId, true);
}
