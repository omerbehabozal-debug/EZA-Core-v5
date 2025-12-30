"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function NationalRegulationPage() {
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

  const panels = [
    {
      icon: "Newspaper",
      title: "Medya & Yayın Regülasyon Paneli",
      label: "Yayıncılık ve medya düzenlemeleri",
      description: "Yayıncılık, medya ve içerik üretimi alanında kullanılan yapay zekâ sistemlerinin etik, toplumsal ve regülasyonel etkilerini izlemek için tasarlanmıştır. Yayın öncesi ve sonrası içeriklerin etik etkilerini görünür kılar.",
      buttonText: "RTÜK Paneline Git",
      href: "https://rtuk.ezacore.ai/",
    },
    {
      icon: "Cpu",
      title: "Teknoloji & Yapay Zekâ Regülasyon Paneli",
      label: "Dijital sistemler ve AI düzenlemeleri",
      description: "Teknoloji şirketleri ve yapay zekâ tabanlı sistemlerin ürettiği çıktıları, ulusal yapay zekâ politikaları ve etik çerçeveler doğrultusunda izlemek ve raporlamak için.",
      buttonText: "Tech Paneline Git",
      href: "https://tech.ezacore.ai/",
    },
    {
      icon: "Building2",
      title: "Finans & Bankacılık Regülasyon Paneli",
      label: "Finansal sistemler ve denetim",
      description: "Finansal içerikler, karar destek sistemleri ve otomatik analiz süreçlerinin etik ve regülasyon uyumunu izlemek için tasarlanmış özel regülatör paneli.",
      buttonText: "Finans Paneline Git",
      href: "https://finance.ezacore.ai/",
    },
    {
      icon: "Heart",
      title: "Sağlık Regülasyon Paneli",
      label: "Sağlık sistemleri ve hasta güvenliği",
      description: "Sağlık alanında kullanılan yapay zekâ sistemlerinin etik, toplumsal ve hasta güvenliği etkilerini izlemek ve şeffaflık sağlamak amacıyla.",
      buttonText: "Sağlık Paneline Git",
      href: "https://health.ezacore.ai/",
    },
  ];

  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              EZA Paneller
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Ulusal Regülasyon Panelleri
            </h1>
            <p className="text-xl text-eza-text-secondary mb-4">
              Ulusal düzenleyici kurumlar için, sektöre ve yasal çerçeveye özel tasarlanmış etik gözlem panelleri.
            </p>
            <p className="text-lg text-eza-text-secondary max-w-3xl mx-auto">
              Ulusal Regülasyon Panelleri, her sektörün kendine özgü yasal, etik ve denetim ihtiyaçlarına göre tasarlanmış bağımsız regülatör arayüzleridir. Bu paneller, yapay zekâ sistemlerinden üretilen çıktıları ilgili ulusal regülasyonlar çerçevesinde gözlemlemek, raporlamak ve şeffaflığı sağlamak amacıyla kullanılır.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white !pt-12 md:!pt-16 lg:!pt-20">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4">
                Mevcut Ulusal Regülasyon Panelleri
              </h2>
              <p className="text-lg text-eza-text-secondary">
                Aşağıda, EZA tarafından geliştirilen sektöre özel ulusal regülasyon panelleri yer almaktadır.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {panels.map((panel, index) => (
              <FadeIn key={index} delay={index * 100}>
                <div className="bg-white rounded-xl p-6 border border-gray-200/50 hover:border-eza-blue/30 transition-colors h-full flex flex-col">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={panel.icon} className="text-eza-blue" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-eza-text mb-2">
                        {panel.title}
                      </h3>
                      <p className="text-sm text-eza-blue font-medium mb-3">
                        {panel.label}
                      </p>
                      <p className="text-sm text-eza-text-secondary leading-relaxed mb-4">
                        {panel.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <a
                      href={panel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 text-eza-blue rounded-lg hover:bg-eza-blue/20 transition-colors font-medium text-sm"
                    >
                      {panel.buttonText}
                      <Icon name="ArrowRight" size={16} />
                    </a>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-semibold text-eza-text mb-6">
                Erişim ve Operasyonel Süreç
              </h2>
              <div className="space-y-4 text-eza-text-secondary leading-relaxed mb-6">
                <p>
                  Ulusal Regülasyon Panelleri, ilgili düzenleyici kurumlar ve sektör temsilcileriyle yapılan profesyonel görüşmeler sonucunda EZA tarafından özel olarak yapılandırılır.
                </p>
                <p>
                  Her panel:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>İlgili regülasyon çerçevesine göre özelleştirilir</li>
                  <li>Ayrı domain ve kapalı erişim modeliyle çalışır</li>
                  <li>Yetkilendirme ve kullanıcı tanımlamaları EZA tarafından yönetilir</li>
                </ul>
                <p>
                  Bu panellere doğrudan bireysel başvuru veya açık kayıt bulunmamaktadır.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-eza-blue text-white rounded-lg hover:bg-eza-blue/90 transition-colors font-medium"
                >
                  Regülasyon Süreci Hakkında Bilgi Al
                  <Icon name="ArrowRight" size={18} />
                </Link>
                <Link
                  href="/#ecosystem"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
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
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
