"use client";

import { useEffect } from "react";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export default function PerspectivesPage() {
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

  const perspectives = [
    {
      icon: "Cpu",
      title: "Özelleştirilmiş AI Arayüzleri",
      description: "Kurumlara, regülasyon bağlamlarına ve kullanım senaryolarına göre şekillenen yapay zekâ etkileşim arayüzlerinin etik etkileri. Bu perspektif, kuruma özel chatbot ve karar destek arayüzlerinin nasıl gözlemlenebilir ve denetlenebilir hale gelebileceğini ele alır.",
      href: "/perspectives/customized-ai-interfaces",
    },
    {
      icon: "CarFront",
      title: "Otonom Araçlar",
      description: "Fiziksel dünyada karar alan yapay zekâ sistemlerinin etik riskleri, sorumluluk sınırları ve denetlenebilirlik ihtiyacı. Otonom araçların karar anlarında oluşturduğu etik etkilerin nasıl görünür kılınabileceğine dair değerlendirmeler.",
      href: "/perspectives/autonomous-vehicles",
    },
    {
      icon: "Users",
      title: "İnsansı Robotlar",
      description: "İnsan–makine etkileşiminin yoğunlaştığı ortamlarda, dil, niyet ve davranışların etik boyutları. İnsansı robotların toplumsal, psikolojik ve etik etkilerine yönelik gözlem perspektifleri.",
      href: "/perspectives/humanoid-robots",
    },
  ];

  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Gelecek Perspektifleri
            </h1>
            <p className="text-xl text-eza-text-secondary mb-4">
              Henüz regüle edilmemiş, ancak etik etkileri yüksek alanlara dair EZA'nın değerlendirme ve gözlem perspektifleri.
            </p>
            <p className="text-lg text-eza-text-secondary max-w-3xl mx-auto">
              Bu bölüm, EZA'nın bugün aktif ürünlerinden bağımsız olarak; yapay zekâ teknolojilerinin yakın ve orta vadede oluşturacağı etik, toplumsal ve regülasyonel etkileri değerlendirdiği alanları kapsar. Burada sunulan içerikler, bir ürün veya hizmet vaadi değil; etik gözlem, yönetişim ve şeffaflık ihtiyacına dair stratejik bir çerçeve sunar.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white !pt-12 md:!pt-16 lg:!pt-20 !pb-24 md:!pb-32 lg:!pb-40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {perspectives.map((perspective, index) => (
              <FadeIn key={index} delay={index * 100}>
                <Link
                  href={perspective.href}
                  className="block bg-white rounded-xl p-6 border border-gray-200/50 hover:border-eza-blue/30 transition-colors h-full flex flex-col"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={perspective.icon} className="text-eza-blue" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-eza-text mb-3">
                        {perspective.title}
                      </h3>
                      <p className="text-sm text-eza-text-secondary leading-relaxed mb-4">
                        {perspective.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <div className="flex items-center text-eza-blue font-medium text-sm">
                      Perspektifi İncele
                      <Icon name="ArrowRight" size={16} className="ml-1" />
                    </div>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

