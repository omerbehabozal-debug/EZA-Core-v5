/**
 * Stage 2A — unavailable / restricted mirror (404).
 */

export default function MirrorLandingNotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0c0b0a] px-6 text-center text-[#f4f0e8]">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9bba8]">SAINA Mirror</p>
      <h1 className="mt-4 font-serif text-2xl font-medium text-[#faf6ee]">Bu Mirror bulunamadı</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#a89f92]">
        Bağlantı süresi dolmuş, kaldırılmış veya henüz paylaşılmamış olabilir.
      </p>
    </main>
  );
}
