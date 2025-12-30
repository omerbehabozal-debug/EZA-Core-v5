"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function GlobalOversightPage() {
  useEffect(() => {
    // Sadece doğrudan navigasyonda (link tıklama) scroll'u en üste al
    // Geri dönüşlerde tarayıcının scroll restoration'ına izin ver
    if (typeof window !== 'undefined') {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const isDirectNavigation = !navEntry || navEntry.type === 'navigate' || navEntry.type === 'reload';
      
      if (isDirectNavigation) {
        // Sadece yeni sayfa yüklemesinde scroll'u en üste al
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }
  }, []);

  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20" id="top">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="Globe" size={16} />
              EZA Panels
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Global Ölçekli Paneller
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Çok uluslu kurumlar ve global operasyonlar için etik izleme ve raporlama panelleri.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
            <p>
              Global Ölçekli Paneller, çok uluslu kurumlar ve global operasyonlar için tasarlanmış 
              etik izleme ve raporlama çözümleridir. Farklı ülkelerdeki operasyonlarınızı tek bir 
              platformdan izleyebilir, sektör genelinde etik uyumluluğu yönetebilirsiniz.
            </p>
            <p>
              Bu paneller, uluslararası regülasyonlara uyum sağlamanıza yardımcı olur ve farklı 
              coğrafyalardaki etik standartları görünür kılar. Çok uluslu kurumlar, bu paneller 
              aracılığıyla global operasyonlarını etik açıdan izleyebilir ve raporlayabilir.
            </p>
            <p>
              Global Ölçekli Paneller, özellikle birden fazla ülkede operasyonu olan kurumlar için 
              idealdir. Merkezi bir platformdan tüm operasyonlarınızı izleyebilir, etik uyumluluğu 
              yönetebilir ve raporlayabilirsiniz.
            </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-semibold text-eza-text mb-4">
                Regulator Panel'e Erişim
              </h2>
              <p className="text-eza-text-secondary mb-6">
                Global ölçekli panel özelliklerini kullanmak için Regulator Panel'e yönlendirileceksiniz.
              </p>
              <Link
                href="/panels/regulator"
                className="inline-flex items-center gap-2 px-6 py-3 bg-eza-blue text-white rounded-lg hover:bg-eza-blue/90 transition-colors font-medium"
              >
                <span>Regulator Panel'e Git</span>
                <Icon name="ArrowRight" size={18} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

