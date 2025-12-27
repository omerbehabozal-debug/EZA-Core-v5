import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BDDK / SPK - Finansal AI Gözetim Paneli',
  description: 'BDDK ve SPK için finansal AI gözetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" translate="no">
      <body className="bg-finance-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

