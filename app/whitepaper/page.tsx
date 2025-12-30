import Section from "../components/Section";
import Link from "next/link";
import Icon from "../components/Icon";
import FadeIn from "../components/FadeIn";

export const metadata = {
  title: "Whitepaper | EZA - Ethical Observation Infrastructure for AI Systems",
  description: "EZA'nın etik gözlem altyapısı, AI çıktılarında etik etkinin ölçülmesi ve müdahale etmeyen yaklaşımı hakkında teknik ve stratejik bilgiler.",
};

export default function WhitepaperPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="FileText" size={16} />
              Whitepaper
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              EZA — Ethical Observation Infrastructure for AI Systems
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Yapay zekâ sistemlerinin etik etkilerini ölçen ve görünür kılan altyapı
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h2 className="text-3xl font-semibold text-eza-text mb-4">
                AI Çıktılarında Etik Etkinin Ölçülememesi Problemi
              </h2>
              <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  Yapay zekâ sistemleri güvenlikten geçiyor, performansla ölçülüyor. Ancak ürettikleri 
                  çıktılar çoğu zaman etik etkileri açısından ölçülmüyor. Bu durum, AI sistemlerinin 
                  toplumsal, regülasyonel ve etik etkilerinin görünmez kalmasına neden oluyor.
                </p>
                <p>
                  Görünmeyen riskler, en büyük risklerdir. EZA, bu görünmezliği ortadan kaldırmak için 
                  tasarlandı. AI çıktılarının etik, toplumsal ve regülasyonel etkilerini sansürlemeden 
                  analiz eden bir etik gözlem sistemidir.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-eza-text mb-4">
                EZA'nın Otomatik Müdahale Etmeyen Yaklaşımı
              </h2>
              <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  EZA, yapay zekâ sistemlerine otomatik veya zorunlu müdahale etmez. Otomatik olarak 
                  yasaklamaz, zorunlu yönlendirme yapmaz, karar vermez. EZA yalnızca ölçer, skorlar ve 
                  görünür kılar. Çünkü etik, dayatıldığında değil; fark edildiğinde anlamlıdır.
                </p>
                <p>
                  Bu non-interventionist yaklaşım, EZA'yı diğer etik kontrol sistemlerinden ayırır. 
                  EZA bir sansür sistemi değil, bir gözlem sistemidir. İçeriği otomatik olarak engellemez, 
                  sadece etik etkilerini görünür kılar.
                </p>
                <div className="bg-eza-blue/5 border border-eza-blue/20 rounded-xl p-6 mt-4">
                  <p className="text-eza-text font-medium mb-2">
                    Kullanıcı Talep Ettiğinde Öneriler
                  </p>
                  <p className="text-eza-text-secondary leading-relaxed">
                    EZA, kullanıcı açıkça talep ettiğinde etik iyileştirme önerileri sunabilir. Bu öneriler 
                    bağlayıcı değildir ve kullanıcı kararını değiştirmez. Öneriler, bilgilendirme amaçlıdır 
                    ve nihai karar kullanıcıya aittir.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-eza-text mb-4">
                EZA-Core: Skorlama ve Bağlam Motoru
              </h2>
              <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  EZA-Core, EZA'nın teknolojik motorudur. Etik analiz pipeline, skorlama sistemi ve 
                  risk değerlendirme çekirdeğini içerir. EZA-Core, AI çıktılarını bağlam ve niyet 
                  açısından analiz eder, etik skorlar üretir ve risk başlıklarını görünür kılar.
                </p>
                <p>
                  Skorlama sistemi, çıktıların etik, toplumsal ve regülasyonel etkilerini sayısallaştırır. 
                  Bu skorlar, karar vermek için değil, bilgilendirmek için kullanılır. EZA, skorları 
                  üretir ama karar vermez.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-eza-text mb-4">
                Ürün Ayrımı: Standalone / Proxy-Lite / Proxy
              </h2>
              <div className="space-y-6">
                <div className="bg-eza-gray rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Standalone</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    Yapay zekâ ile birebir etkileşim için etik analizli chat deneyimi. Bireysel kullanımda, 
                    soru–cevap sürecinin etik sınırlarını görünür kılar.
                  </p>
                </div>
                <div className="bg-eza-gray rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Proxy-Lite</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    Metin ve içerikler için hızlı ve sade etik analiz aracı. Bireysel kullanıcılar ve 
                    içerik üreticiler için tasarlanmıştır.
                  </p>
                </div>
                <div className="bg-eza-gray rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Proxy</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    Kurumsal sistemler için API tabanlı derin etik analiz çözümü. Organizasyon bazlı 
                    kullanım ve gelişmiş raporlama sunar.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-eza-text mb-4">
                Regülasyon ve Şeffaflık Perspektifi
              </h2>
              <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
                <p>
                  EZA, regülasyon uyumunu sağlamak için değil, regülasyon uyumunu görünür kılmak için 
                  tasarlanmıştır. AI Act, GDPR, KVKK gibi regülasyonlara uyum sağlamak isteyen 
                  kurumlar, EZA ile çıktılarının etik etkilerini ölçebilir ve raporlayabilir.
                </p>
                <p>
                  Şeffaflık, EZA'nın temel değerlerinden biridir. Kurum içi kullanımda kim ne üretti 
                  izlenebilir olmalı. EZA, bu izlenebilirliği sağlar ama içeriğe otomatik veya zorunlu 
                  müdahale etmez.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-semibold text-eza-text mb-4">
                Daha Fazla Bilgi İçin
              </h2>
              <p className="text-eza-text-secondary mb-6">
                EZA hakkında detaylı bilgi almak veya entegrasyon sürecini başlatmak için bizimle iletişime geçin.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-eza-blue text-white rounded-lg hover:bg-eza-blue/90 transition-colors font-medium"
              >
                <span>İletişime Geç</span>
                <Icon name="ArrowRight" size={18} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

