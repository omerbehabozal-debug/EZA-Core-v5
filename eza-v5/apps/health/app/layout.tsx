import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sağlık Bakanlığı - Klinik & Sağlık AI Gözetim Paneli',
  description: 'Sağlık Bakanlığı için klinik AI gözetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" translate="no">
      <body className="bg-health-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

