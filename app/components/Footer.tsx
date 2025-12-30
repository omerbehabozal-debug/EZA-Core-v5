import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-eza-gray border-t border-gray-200/50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        {/* Brand / Meta Section - Grid DIŞI */}
        <div className="mb-12">
          <div className="mb-6">
            <span className="text-xl font-semibold text-eza-text">EZA.global</span>
          </div>
          <p className="text-eza-text-secondary text-sm leading-relaxed font-normal max-w-xs">
            Yapay zekâ çıktılarının etik etkilerini
            otomatik veya zorunlu müdahale etmeden ölçen ve görünür kılan altyapı.
          </p>
        </div>

        {/* Footer Navigation Grid - 4 eşit kolon */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Ürünler */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text mb-4 mt-0">Ürünler</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/products/standalone"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Standalone
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy-lite"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Proxy-Lite
                </Link>
              </li>
              <li>
                <Link
                  href="/products/proxy"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Proxy
                </Link>
              </li>
            </ul>
          </div>

          {/* Paneller */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text mb-4 mt-0">Paneller</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/panels/global-oversight"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Global Ölçekli Paneller
                </Link>
              </li>
              <li>
                <Link
                  href="/panels/national-regulation"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Ulusal Regülasyon Panelleri
                </Link>
              </li>
            </ul>
          </div>

          {/* Kaynaklar */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text-secondary/80 mb-4 mt-0">Kaynaklar</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/documentation"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Dokümantasyon
                </Link>
              </li>
              <li>
                <Link
                  href="/whitepaper"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Whitepaper
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/test-suite"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Test ve Güvenlik Kıyaslamaları
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  İletişim
                </Link>
              </li>
            </ul>
          </div>

          {/* Yasal */}
          <div>
            <h3 className="text-sm font-semibold text-eza-text-secondary/80 mb-4 mt-0">Yasal</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/privacy"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Gizlilik Politikası
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-eza-text-secondary hover:text-eza-text transition-colors text-sm hover:underline"
                >
                  Kullanım Koşulları
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom - Copyright & Meta */}
        <div className="pt-8 border-t border-gray-200/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-eza-text-secondary text-sm">
              &copy; {new Date().getFullYear()} EZA.global. All rights reserved.
            </p>
          </div>
          <div className="mt-3 text-center">
            <p className="text-eza-text-secondary/50 text-[10px] leading-relaxed italic">
              EZA is a non-interventionist ethical observation infrastructure.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
