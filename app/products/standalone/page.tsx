"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";
import HeroVisual from "@/app/components/HeroVisual";

export default function StandalonePage() {
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
      <div className="relative bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20 min-h-[60vh] flex items-center overflow-hidden">
        {/* Video Background */}
        <HeroVisual 
          videoSrc="/videos/8a491491-2330-493d-a26f-5297f32ab0e6_watermark.mp4"
          videoType="video/mp4"
          showVideo={true}
        />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              EZA Ürünler
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
              Standalone
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Bağımsız etik değerlendirme chat arayüzü. Kullanıcı girişlerini analiz eder ve etik yönlendirmeli cevaplar üretir.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  EZA Standalone, bağımsız çalışan bir etik değerlendirme chat arayüzüdür. Kullanıcıların 
                  girişlerini analiz eder ve etik yönlendirmeli cevaplar üretir. Herhangi bir sistemle 
                  entegre olmadan, kendi başına çalışarak etik sohbet deneyimi sunar.
                </p>
                <p>
                  Standalone chat arayüzü, kullanıcı mesajlarını analiz eder, etik değerlendirmeler yapar 
                  ve kullanıcı talep ettiğinde etik iyileştirme önerileri sunar. Otomatik olarak yasaklamaz, 
                  engellemez; sadece gözlem yapar ve görünür kılar. Kullanıcılarla etik bir sohbet ortamı 
                  sağlarken, mevcut sistemlerinize otomatik veya zorunlu müdahale etmez.
                </p>
                <p>
                  EZA Standalone, özellikle chat tabanlı uygulamalar ve müşteri hizmetleri için idealdir. 
                  Bağımsız çalışma özelliği sayesinde, herhangi bir entegrasyon gerektirmeden etik 
                  sohbet deneyimi sağlayabilirsiniz.
                </p>
              </div>
            </FadeIn>
            
            {/* Premium Image */}
            <FadeIn delay={200}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50">
                <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-purple-500/5 pointer-events-none z-10" />
                <img 
                  src="/videos/standalone.png" 
                  alt="EZA Standalone - Etik Değerlendirme Chat Arayüzü"
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
              href="https://standalone.ezacore.ai/standalone"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Standalone Chat'a Git
              <Icon name="ExternalLink" size={18} />
            </a>
            <Link
              href="/#ecosystem"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              onClick={() => {
                // EZA Ekosistemi bölümünün pozisyonunu kaydet
                if (typeof window !== 'undefined') {
                  // Anasayfaya yönlendir ve EZA Ekosistemi bölümünün pozisyonunu kaydet
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

