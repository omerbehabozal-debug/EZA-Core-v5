/**
 * Standalone route — tam yükseklik canvas (beyaz ekran / flex çöküşü önleme)
 */

export default function StandaloneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">{children}</div>
  );
}
