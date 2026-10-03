/**
 * Shared BiligN application shell for /standalone/* and /m/*.
 * Route group does not change URLs.
 */

import SainaAppRootLayout from '@/components/saina/SainaAppRootLayout';

export default function BilignAppLayout({ children }: { children: React.ReactNode }) {
  return <SainaAppRootLayout>{children}</SainaAppRootLayout>;
}
