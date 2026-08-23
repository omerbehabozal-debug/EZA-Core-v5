/**
 * Published Yansı experience paths — Mode A only.
 * Continuation lives at /m/{slug}/sohbet; new chat at /standalone.
 */

export function isPublishedYansiExperiencePath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).split('#')[0] ?? pathname;
  if (!path.startsWith('/m/')) return false;
  if (path.includes('/sohbet') || path.includes('/yansilar')) return false;
  const slug = path.slice(3);
  return slug.length > 0 && !slug.includes('/');
}

export function isYansiContinuationOpeningPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] ?? pathname).split('#')[0] ?? pathname;
  return /^\/m\/[^/]+\/sohbet\/?$/.test(path);
}
