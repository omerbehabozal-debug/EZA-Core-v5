"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function EducationPage() {
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
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="BookOpen" size={16} />
              Sector Solutions
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Education Solutions
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Eğitim teknolojilerinde etik kullanım. Öğrenci verilerinin korunması ve adil AI kullanımı.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            Eğitim sektöründe teknoloji kullanımı hızla artıyor. AI destekli öğrenme platformları, 
            otomatik değerlendirme sistemleri ve kişiselleştirilmiş eğitim araçları yaygınlaşıyor. 
            Ancak bu teknolojilerin öğrencilere karşı etik davranması kritik bir konudur.
          </p>
          <p>
            EZA, eğitim teknolojilerinde etik kullanımı sağlar. Öğrenci verilerinin korunması, 
            adil değerlendirme sistemleri ve öğrencilerin gizliliğinin korunması konularında 
            rehberlik eder. EZA, eğitim teknolojilerinin öğrencilere karşı saygılı ve adil 
            davranmasını sağlar.
          </p>
          <p>
            Eğitim kurumları, EZA ile öğrenci verilerini koruyabilir, adil AI kullanımını 
            sağlayabilir ve öğrencilerin gizliliğini güvence altına alabilir. EZA, eğitim 
            teknolojilerinin etik kullanımını yönlendirir ve daha iyi alternatifler önerir.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Faydalar</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Öğrenci verilerinin korunması ve gizliliğin sağlanması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Adil değerlendirme sistemleri ve önyargı önleme</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Yaşa uygun içerik filtreleme ve çocuk güvenliği</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Eğitim teknolojilerinin etik kullanımı için rehberlik</span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">EZA Nasıl Yardımcı Olur?</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Öğrenci verilerinin etik kullanımını yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>AI değerlendirme sistemlerinde adalet sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Çocuk güvenliği modülü ile yaşa uygun içerik sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Eğitim platformlarında etik davranışı teşvik eder</span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/#ecosystem"
            className="inline-block px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl"
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('homeScrollSection', 'ecosystem');
              }
            }}
          >
            EZA Ekosistemine Dön
          </Link>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

