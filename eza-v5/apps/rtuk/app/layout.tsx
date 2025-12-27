import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RTÜK Medya Gözetim Paneli - EZA Core',
  description: 'RTÜK için medya odaklı gözlemsel gözetim paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" translate="no">
      <body className="bg-rtuk-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

