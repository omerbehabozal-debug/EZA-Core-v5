import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Düzenleyici Gözetim Paneli - EZA Core',
  description: 'Sistem davranışını gözlemlemek için salt okunur düzenleyici gözetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" translate="no">
      <body className="bg-regulator-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

