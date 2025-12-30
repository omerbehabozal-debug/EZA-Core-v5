"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";

export default function HumanoidRobotsPage() {
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
            Humanoid Robots Solutions
          </h1>
          <p className="text-xl text-gray-700">
            İnsansı robotlar ile insanlığın etik iletişimi. Saygılı, anlaşılır ve güvenli etkileşim ortamı.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            İnsansı robotlar, günlük hayatımızda giderek daha fazla yer almaya başlıyor. 
            Bu robotların insanlarla etkileşiminde saygılı, anlaşılır ve güvenli bir iletişim 
            ortamı sağlanması kritik öneme sahiptir.
          </p>
          <p>
            EZA, insansı robotlar ile insanlığın etik iletişimini sağlar. Robotların insanlara karşı 
            saygılı davranması, anlaşılır iletişim kurması ve güvenli etkileşim ortamı yaratması 
            konularında rehberlik eder. EZA, insansı robotların insanlığa karşı etik davranmasını sağlar.
          </p>
          <p>
            İnsansı robot üreticileri, EZA ile robotların etik davranmasını sağlayabilir, 
            saygılı iletişim mekanizmaları kurabilir ve insan haklarını güvence altına alabilir. 
            EZA, insansı robot teknolojilerinin etik kullanımını yönlendirir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>İnsansı robotların etik iletişim kurması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Saygılı ve anlaşılır etkileşim ortamı</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>İnsan haklarının korunması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Güvenli ve sorumlu robot-insan etkileşimi</span>
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
              <span>İnsansı robotların etik iletişim kurmasını yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Saygılı ve anlaşılır etkileşim ortamı sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>İnsan haklarının korunmasını garanti eder</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Robot-insan etkileşiminde etik davranışı teşvik eder</span>
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

