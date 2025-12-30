"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function ProxyLitePage() {
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
              <Icon name="Zap" size={16} />
              EZA-Core Products
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Proxy-Lite
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Yapay Zekâ ve Dijital İçerikler İçin Hızlı Etik Kontrol
            </p>
            <p className="text-lg text-eza-text-secondary mt-4 max-w-3xl mx-auto">
              EZA Proxy Lite, yapay zekâdan üretilen içerikler başta olmak üzere makale, reklam, influencer ve sosyal medya metinlerini kullanmadan veya paylaşmadan önce etik ve risk açısından hızlıca analiz eden hafif kontrol aracıdır.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-eza-blue/10 border border-eza-blue/20 rounded-lg">
              <Icon name="Zap" size={20} className="text-eza-blue" />
              <span className="text-eza-blue font-semibold">Uygulama yok. Kurulum yok. Karmaşa yok.</span>
            </div>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            EZA Proxy Lite, yapay zekâdan üretilen içerikler başta olmak üzere makale, reklam, 
            influencer ve sosyal medya metinlerini kullanmadan veya paylaşmadan önce etik ve risk 
            açısından hızlıca analiz eden hafif kontrol aracıdır.
          </p>
          <p className="text-xl font-semibold text-eza-text text-center py-4 px-6 bg-eza-blue/5 rounded-lg border border-eza-blue/20">
            "AI'den gelsin ya da insan yazmış olsun, paylaşmadan önce kontrol et."
          </p>
          <p>
            Proxy Lite şu içerik türlerini analiz edebilir: yapay zekâ cevapları, makale & blog 
            yazıları, reklam metinleri, influencer paylaşımları, ürün açıklamaları, kampanya ve 
            e-posta metinleri. Kaynağı fark etmez. Önemli olan metindir.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Neleri Kontrol Eder?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: "Brain", title: "Yapay zekâ cevapları", desc: "AI'den gelen tüm metin içerikleri" },
                { icon: "FileText", title: "Makale & blog yazıları", desc: "Yayınlanmadan önce etik kontrol" },
                { icon: "Volume2", title: "Reklam metinleri", desc: "Reklam kampanyaları için risk analizi" },
                { icon: "Users", title: "Influencer paylaşımları", desc: "Sosyal medya içerikleri için kontrol" },
                { icon: "ShoppingBag", title: "Ürün açıklamaları", desc: "E-ticaret ve pazarlama metinleri" },
                { icon: "Mail", title: "Kampanya ve e-posta metinleri", desc: "İletişim içerikleri için analiz" },
              ].map((item, index) => (
                <FadeIn key={index} delay={index * 50}>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                        <Icon name={item.icon} className="text-eza-blue" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-eza-text text-base mb-1">{item.title}</h3>
                        <p className="text-sm text-eza-text-secondary leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
            <p className="text-center text-eza-text-secondary mt-6 italic">
              Kaynağı fark etmez. Önemli olan metindir.
            </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Kimler İçin?</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                "İçerik üreticileri",
                "Influencer'lar",
                "Ajanslar",
                "Freelancer'lar",
                "Küçük işletmeler",
                "AI kullanan herkes",
              ].map((audience, index) => (
                <FadeIn key={index} delay={index * 50}>
                  <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Icon name="CheckCircle" className="text-eza-blue" size={20} />
                    </div>
                    <p className="text-sm font-medium text-eza-text">{audience}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://proxy-lite.ezacore.ai/proxy-lite"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Proxy-Lite Platform'a Git
              <Icon name="ExternalLink" size={18} />
            </a>
            <Link
              href="/#ecosystem"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              onClick={() => {
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

