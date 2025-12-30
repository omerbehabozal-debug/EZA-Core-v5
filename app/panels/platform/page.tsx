"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function PlatformPanelPage() {
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
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              EZA Paneller
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Platform Panel
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Tüm EZA ürünlerini ve sistemlerini tek merkezden yöneten kurumsal gözlem paneli.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white !pt-12 md:!pt-16 lg:!pt-20 !pb-24 md:!pb-32 lg:!pb-40">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  Platform Panel, kurumların birden fazla sistem ve üründe üretilen çıktıları tek bir 
                  merkezden izlemesini, etik etkilerini değerlendirmesini ve raporlamasını sağlayan 
                  merkezi bir yönetim arayüzüdür.
                </p>
                <p>
                  Platform Panel, özellikle birden fazla yapay zekâ sistemi, ürün veya ekip kullanan 
                  kurumlar için tasarlanmıştır. Kurumlar, tüm operasyonlarını tek merkezden izleyebilir; 
                  etik uyumluluğu yönetebilir ve denetlenebilir raporlar üretebilir.
                </p>
              </div>
            </FadeIn>
            
            {/* Premium Image */}
            <FadeIn delay={200}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50">
                <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-purple-500/5 pointer-events-none z-10" />
                <img 
                  src="/videos/platform panel.png" 
                  alt="EZA Platform Panel - Kurumsal Gözlem Paneli"
                  className="w-full h-auto object-cover relative z-0"
                  style={{
                    maxHeight: '600px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://platform.ezacore.ai/platform/login"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Platform Panel'e Git
              <Icon name="ExternalLink" size={18} />
            </a>
            <Link
              href="/#ecosystem"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              onClick={() => {
                // EZA Ekosistemi bölümünün pozisyonunu kaydet
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('homeScrollSection', 'ecosystem');
                }
              }}
            >
              EZA Ekosistemine Dön
            </Link>
          </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

