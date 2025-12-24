import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Regulator Oversight Panel - EZA Core',
  description: 'Read-only regulator oversight panel for system behavior observation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-regulator-background text-gray-900">
        {children}
      </body>
    </html>
  );
}

