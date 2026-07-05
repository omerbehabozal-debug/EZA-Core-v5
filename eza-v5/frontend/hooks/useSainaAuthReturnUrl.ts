'use client';

import { usePathname } from 'next/navigation';
import { buildSainaAuthReturnUrl } from '@/lib/eza/sainaIdentity';

/** Current route as auth return URL (pathname + search + hash). */
export function useSainaAuthReturnUrl(): string {
  const pathname = usePathname();
  const path = pathname || '/standalone';

  if (typeof window === 'undefined') {
    return path;
  }

  return buildSainaAuthReturnUrl({
    pathname: path,
    search: window.location.search,
    hash: window.location.hash,
  });
}
