'use client';

import type { ReactNode } from 'react';

/** Mirror sub-routes use SainaAppRootLayout transitions; no extra fade here. */
export default function MirrorTemplate({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
