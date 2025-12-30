"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function EUAIActPanelPage() {
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
              <Icon name="Scale" size={16} />
              EZA Panels
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              EU AI Act Compliance Panel
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Avrupa Birliği Yapay Zekâ Yasasına uyum sağlamak isteyen şirketler için özel panel.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            EU AI Act Compliance Panel, Avrupa Birliği Yapay Zekâ Yasası (EU AI Act) gerekliliklerine 
            uyum sağlamak isteyen şirketler için özel olarak tasarlanmış bir yönetim panelidir. 
            AB AI ACT'in tüm gerekliliklerini karşılayacak yapı ve araçlar sunar.
          </p>
          <p>
            Panel, AI sistemlerinizin risk kategorilerini sınıflandırır, uyum raporları oluşturur 
            ve explainability (açıklanabilirlik) modülü ile sistemlerinizin nasıl çalıştığını 
            şeffaf bir şekilde gösterir. Bu sayede AB AI Act gerekliliklerini karşılayarak, 
            Avrupa Birliği pazarında sorunsuz çalışabilirsiniz.
          </p>
          <p>
            EZA, yasaklama veya cezalandırma yapmaz; sadece daha iyi bir davranış önerir. 
            EU AI Act Compliance Panel de aynı felsefeyi yansıtır: sistemlerinizi yasaklamaz, 
            sadece AB standartlarına uygun hale getirmenize yardımcı olur.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-8">Panel Özellikleri</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Layers" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Kategori Sınıflandırması</h3>
              </div>
                <p className="text-eza-text-secondary">
                AI sistemlerinizi AB AI Act'e göre risk kategorilerine (Minimal Risk, Limited Risk, 
                High Risk, Prohibited) sınıflandırır ve uygun gereklilikleri belirler.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="FileText" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Uyum Raporları</h3>
              </div>
                <p className="text-eza-text-secondary">
                AB AI Act gerekliliklerine uyumluluğunuzu gösteren detaylı raporlar oluşturur. 
                Eksiklikleri tespit eder ve iyileştirme önerileri sunar.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Eye" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Explainability Modülü</h3>
              </div>
                <p className="text-eza-text-secondary">
                AI sistemlerinizin nasıl çalıştığını açıklayan, şeffaf ve anlaşılabilir raporlar 
                sunar. AB AI Act'in açıklanabilirlik gerekliliklerini karşılar.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="CheckCircle" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Sürekli İzleme</h3>
              </div>
                <p className="text-eza-text-secondary">
                Sistemlerinizin AB AI Act uyumluluğunu sürekli izler, değişiklikleri takip eder 
                ve güncel gereklilikleri karşıladığınızdan emin olur.
              </p>
            </div>
          </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">AB AI Act Risk Kategorileri</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-eza-green pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Minimal Risk</h3>
                <p className="text-eza-text-secondary">
                Çoğu AI sistemi bu kategoridedir. Genel şeffaflık gereklilikleri uygulanır.
              </p>
            </div>
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Limited Risk</h3>
                <p className="text-eza-text-secondary">
                Kullanıcıların AI ile etkileşimde olduğunu bilmeleri gereken sistemler. 
                Şeffaflık yükümlülükleri vardır.
              </p>
            </div>
            <div className="border-l-4 border-eza-gold pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">High Risk</h3>
                <p className="text-eza-text-secondary">
                Sağlık, eğitim, işe alım gibi kritik alanlarda kullanılan sistemler. 
                Kapsamlı uyumluluk gereklilikleri vardır.
              </p>
            </div>
            <div className="border-l-4 border-eza-text pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Prohibited</h3>
                <p className="text-eza-text-secondary">
                Manipülatif veya zararlı kullanımlar. Bu kategorideki sistemler yasaklanmıştır.
              </p>
            </div>
          </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Kullanım Senaryoları</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Risk Değerlendirmesi:</strong> AI sistemlerinizin AB AI Act'e göre risk 
                kategorisini belirleyin ve uygun gereklilikleri karşılayın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Uyumluluk Raporlama:</strong> Düzenleyici kurumlara sunmak için detaylı 
                uyumluluk raporları oluşturun
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Açıklanabilirlik:</strong> AI sistemlerinizin nasıl çalıştığını şeffaf 
                bir şekilde gösterin ve açıklayın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Sürekli İzleme:</strong> Sistemlerinizin AB AI Act uyumluluğunu sürekli 
                izleyin ve güncel tutun
              </span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={500}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">EZA Yaklaşımı</h2>
            <div className="bg-gradient-to-br from-eza-blue/5 to-white rounded-xl p-6 border border-eza-blue/10">
              <p className="text-lg text-eza-text-secondary leading-relaxed mb-4">
              EU AI Act Compliance Panel, EZA'nın temel felsefesini yansıtır: <strong className="text-eza-text">yasaklamaz, 
              ceza vermez; sadece daha iyi bir davranış önerir.</strong>
            </p>
              <p className="text-lg text-eza-text-secondary leading-relaxed">
                Panel, sistemlerinizi engellemez veya yasaklamaz. Bunun yerine, AB AI Act gerekliliklerine 
                nasıl uyum sağlayacağınızı gösterir ve sistemlerinizi iyileştirmenize yardımcı olur. 
                Bu sayede Avrupa Birliği pazarında sorunsuz çalışabilir ve etik standartları karşılayabilirsiniz.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={600}>
          <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://eu-ai.ezacore.ai/proxy/eu-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              EU AI Act Panel'e Git
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

