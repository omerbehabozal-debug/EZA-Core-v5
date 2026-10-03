import type { ReactNode } from 'react';
import MirrorLayoutClient from './MirrorLayoutClient';

export default function MirrorLayout({ children }: { children: ReactNode }) {
  return <MirrorLayoutClient>{children}</MirrorLayoutClient>;
}
