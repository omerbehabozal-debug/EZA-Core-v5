/**
 * Standalone route — persistent SAINA shell for chat ↔ pattern transitions.
 */

import SainaAppRootLayout from './SainaAppRootLayout';

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return <SainaAppRootLayout>{children}</SainaAppRootLayout>;
}
