"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function ProxyPage() {
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
              EZA Ürünler
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Proxy
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Kurumsal Yapay Zekâ Etik ve Güvenlik Katmanı
            </p>
            <p className="text-lg text-eza-text-secondary mt-4 max-w-3xl mx-auto">
              EZA Proxy, kurumların yapay zekâ sistemlerini gerçek zamanlı olarak izleyen, analiz eden ve etik riskleri görünür kılan profesyonel bir kontrol altyapısıdır.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            EZA Proxy, ChatGPT, Claude, Gemini, Llama gibi büyük dil modellerinin üstünde çalışan 
            bağımsız bir etik zekâ katmanıdır. Yapay zekâ cevaplarını üretmeden önce veya sonra, 
            etik, hukuki ve güvenlik açısından değerlendirir — otomatik veya zorunlu müdahale etmeden, 
            şeffaf ve denetlenebilir şekilde.
          </p>
          <p>
            EZA Proxy içeriğe sansür uygulamaz, cevap üretmez, manipüle etmez. Sadece şunu yapar: 
            "Bu yapay zekâ cevabı kurumun için güvenli mi?" Bu soruyu sorarak, kurumların yapay 
            zekâ sistemlerini gerçek zamanlı olarak izler, analiz eder ve etik riskleri görünür kılar.
          </p>
          <p>
            Kurumsal yapılar için tasarlanan bu kontrol altyapısı, tüm LLM çıktılarını merkezi bir 
            noktadan değerlendirerek, sistem genelinde etik standartları görünür kılar. Otomatik veya 
            zorunlu müdahale etmeden, sadece görünürlük ve denetlenebilirlik sunar. Kullanıcı talep 
            ettiğinde, etik iyileştirme önerileri sunabilir; ancak bu öneriler bağlayıcı değildir.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Özellikler</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Gerçek zamanlı izleme ve analiz — yapay zekâ sistemlerini sürekli gözetir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Etik, hukuki ve güvenlik değerlendirmesi — çok boyutlu risk analizi</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Otomatik müdahale etmez — sadece görünürlük ve denetlenebilirlik sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>ChatGPT, Claude, Gemini, Llama gibi tüm büyük dil modelleri ile uyumlu</span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">EZA Proxy Ne Yapmaz?</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">✗</span>
              <span>İçeriğe sansür uygulamaz — yasaklamaz, engellemez</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">✗</span>
              <span>Cevap üretmez — LLM'lerin yerine geçmez</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">✗</span>
              <span>Manipüle etmez — içeriği değiştirmez veya düzenlemez</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">✓</span>
              <span>Sadece şunu yapar: "Bu yapay zekâ cevabı kurumun için güvenli mi?"</span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://proxy.ezacore.ai/proxy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Proxy Platform'a Git
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

