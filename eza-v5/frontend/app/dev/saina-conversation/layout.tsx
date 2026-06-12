import { Cormorant_Garamond } from 'next/font/google';
import '@/styles/saina-mirror.css';

const sainaSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-saina-serif',
  display: 'swap',
});

export default function SainaConversationDevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={sainaSerif.variable}>{children}</div>;
}
