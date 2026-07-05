export function resolveSainaUserDisplayName(email?: string | null): string {
  if (!email?.trim()) return 'Misafir';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'Misafir';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function resolveSainaUserInitial(email?: string | null): string {
  if (!email?.trim()) return '·';
  const local = email.split('@')[0]?.trim();
  if (!local) return '·';
  return local.charAt(0).toUpperCase();
}

export function resolveSainaPlanLabel(planTier: string): string | null {
  if (planTier === 'premium') return 'SAINA Premium ✦';
  if (planTier === 'free') return 'SAINA Free';
  return null;
}

export function isSainaAuthReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return returnPath.startsWith('/standalone') || returnPath.startsWith('/m/');
}
