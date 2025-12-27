import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sanayi ve Teknoloji Bakanlığı - AI Ekosistem Gözetim Paneli',
  description: 'Sanayi ve Teknoloji Bakanlığı için AI ekosistem gözetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" translate="no">
      <body className="bg-sanayi-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

