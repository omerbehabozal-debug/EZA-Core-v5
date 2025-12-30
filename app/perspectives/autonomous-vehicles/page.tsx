"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function AutonomousVehiclesPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const isDirectNavigation = !navEntry || navEntry.type === 'navigate' || navEntry.type === 'reload';
      
      if (isDirectNavigation) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }
  }, []);

  const observations = [
    {
      icon: "Shield",
      title: "Güvenlik Öncelikleri",
      description: "Araç–yaya dengesi, önceliklendirme mantıkları ve olası etik gerilimler açısından sistem kararlarının değerlendirilebilir olduğu alanlar görünür hale getirilebilir.",
    },
    {
      icon: "AlertTriangle",
      title: "Risk ve Yanlış Güven",
      description: "Sistem kararlarının mutlak doğruluk algısı oluşturma ihtimali ve kullanıcı veya kurum tarafında oluşabilecek yanlış güven riskleri analiz edilebilir.",
    },
    {
      icon: "Eye",
      title: "Bağlam ve Varsayımlar",
      description: "Algoritmik varsayımlar, eksik çevresel bağlam ve durumsal belirsizlikler açısından karar süreçlerinin hangi koşullara dayandığı görünür hale getirilebilir.",
    },
  ];

  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Otonom Araçlar — Etik Gözlem Perspektifi
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Otonom araç sistemlerinin karar süreçleri, güvenlik öncelikleri ve bağlam üzerinden etik etkiler üretebilir. Bu sayfa, bu etkilerin nasıl değerlendirilebileceğine dair bir etik gözlem perspektifi sunar.
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
                  Otonom araç sistemleri, fiziksel dünyada gerçek zamanlı karar süreçleri oluşturabilen 
                  yapay zekâ uygulamaları olarak konumlanabilir. Bu sistemler, güvenlik öncelikleri, 
                  önceliklendirme mantıkları ve bağlamsal değerlendirmeler üzerinden etik etkiler üretebilir.
                </p>
                <p>
                  Bu tür sistemler, doğrudan karar verici olarak konumlanmasa da; algoritmik varsayımlar, 
                  güvenlik parametreleri ve durumsal belirsizlikler üzerinden yönlendirici etkiler 
                  oluşturma potansiyeline sahiptir.
                </p>
                <p>
                  EZA, bu tür karar süreçlerine müdahale etmeksizin, etik etkilerin görünür kılınmasına 
                  yönelik bir gözlem yaklaşımı sunmayı amaçlar.
                </p>
              </div>
            </FadeIn>
            
            {/* Premium Image */}
            <FadeIn delay={200}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50">
                <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-purple-500/5 pointer-events-none z-10" />
                <img 
                  src="/videos/Otonom Araçlar.png" 
                  alt="Otonom Araçlar - Etik Gözlem Perspektifi"
                  className="w-full h-auto object-cover relative z-0"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={300}>
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text text-center mb-12">
              Ne Gözlemlenebilir?
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {observations.map((item, index) => (
              <FadeIn key={index} delay={400 + index * 100}>
                <div className="bg-white rounded-xl p-6 border border-gray-200/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={item.icon} className="text-eza-blue" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-eza-text mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-eza-text-secondary leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={600}>
            <h2 className="text-2xl font-semibold text-eza-text mb-6">
              EZA'nın Konumu
            </h2>
            <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                EZA, otonom araç sistemlerinin ürettiği kararları değiştirmez, yönlendirmez veya sınırlandırmaz.
              </p>
              <p className="font-medium text-eza-text">
                EZA'nın yaklaşımı; bu sistemlerin üretebileceği etik etkileri görünür kılmaya odaklanır. 
                Bu çerçevede nihai karar, her zaman kullanıcıya ve ilgili kuruma aittir.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={700}>
            <h2 className="text-2xl font-semibold text-eza-text mb-6">
              Örnek Değerlendirme Yaklaşımı
            </h2>
            <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                Bir otonom araç senaryosunda, sistemin güvenlik öncelikleri, araç–yaya dengesi ve 
                durumsal belirsizlikler açısından karar mantığı etik etki perspektifiyle değerlendirilebilir.
              </p>
              <p>
                Bu yaklaşımda odak noktası, kararın kendisinden ziyade, kararın güvenlik öncelikleri 
                ve etik etkiler açısından nasıl konumlandığıdır.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={800}>
            <h2 className="text-2xl font-semibold text-eza-text mb-6">
              Neden Önemlidir?
            </h2>
            <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                Otonom araç sistemleri, regülasyon öncesi gri alanlar oluşturabilir ve kamu güveni 
                açısından kritik soruları beraberinde getirebilir. Bu durum, kurumsal sorumluluk 
                sınırlarının netleştirilmesi ihtiyacını gündeme getirebilir.
              </p>
              <p>
                Bu nedenle, bu tür sistemlerin etik etkilerinin önceden değerlendirilebilir ve görünür 
                hale getirilebilmesi, kurumsal yönetişim ve kamu güveni açısından kritik bir ihtiyaç 
                olarak ele alınmaktadır.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={900}>
            <div className="bg-white rounded-xl p-6 border border-gray-200/50">
              <h3 className="text-lg font-semibold text-eza-text mb-4">
                Bilgilendirme Notu
              </h3>
              <p className="text-sm text-eza-text-secondary leading-relaxed">
                Bu sayfa, EZA'nın geleceğe yönelik etik değerlendirme perspektifini yansıtır. 
                Burada yer alan içerikler, bir ürün, hizmet veya aktif çözüm sunma ya da taahhüt etme amacı taşımaz.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={1000}>
          <div className="max-w-4xl mx-auto text-center">
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
        </FadeIn>
      </Section>
    </>
  );
}
