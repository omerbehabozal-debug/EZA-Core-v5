"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";

export default function MediaPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Media Solutions
          </h1>
          <p className="text-xl text-gray-700">
            Medya ve içerik üretiminde etik AI. Deepfake tespiti ve sorumlu içerik oluşturma.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            Medya sektöründe AI kullanımı, içerik üretiminden görsel işlemeye kadar birçok 
            alanda yaygınlaşıyor. Ancak deepfake teknolojileri ve manipülatif içerikler 
            etik sorunlar yaratıyor.
          </p>
          <p>
            EZA, medya ve içerik üretiminde etik AI kullanımını sağlar. Deepfake tespiti, 
            sorumlu içerik oluşturma ve medya güvenilirliği konularında rehberlik eder. 
            EZA, medya teknolojilerinin topluma karşı etik davranmasını sağlar.
          </p>
          <p>
            Medya kuruluşları, EZA ile deepfake içerikleri tespit edebilir, sorumlu içerik 
            oluşturma standartları kurabilir ve medya güvenilirliğini artırabilir. EZA, 
            medya teknolojilerinin etik kullanımını yönlendirir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Deepfake ve manipülatif içerik tespiti</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Sorumlu içerik oluşturma standartları</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Medya güvenilirliğinin artırılması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Medya teknolojilerinin etik kullanımı</span>
            </li>
          </ul>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">EZA Nasıl Yardımcı Olur?</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Deepfake içerikleri tespit eder ve yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Sorumlu içerik oluşturma için rehberlik eder</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Medya güvenilirliğini artırır</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Medya sistemlerinde etik davranışı teşvik eder</span>
            </li>
          </ul>
        </div>
      </Section>

      <Section className="bg-eza-gray">
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
      </Section>
    </>
  );
}

