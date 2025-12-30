import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Developer Console",
  "Geliştiriciler için API yönetim konsolu. Entegrasyon ve test araçları."
);

export default function DeveloperPanelPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="Code" size={16} />
              EZA Panels
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Developer Console
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Geliştiriciler için API yönetim konsolu. Entegrasyon ve test araçları.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            EZA Developer Console, geliştiriciler için özel olarak tasarlanmış bir API yönetim 
            konsoludur. Entegrasyon, test ve izleme araçları sunar. Bu konsol, geliştiricilerin 
            EZA'yı sistemlerine entegre etmesini ve test etmesini kolaylaştırır.
          </p>
          <p>
            Developer Console, API anahtarlarını yönetir, entegrasyonları test eder ve sistem 
            performansını izler. Geliştiriciler, bu konsol aracılığıyla EZA'yı kolayca entegre 
            edebilir, test edebilir ve izleyebilir.
          </p>
          <p>
            EZA Developer Console, özellikle EZA'yı sistemlerine entegre etmek isteyen 
            geliştiriciler için idealdir. Kapsamlı dokümantasyon, test araçları ve izleme 
            özellikleri ile geliştirme sürecini destekler.
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
              <span>API yönetimi ve entegrasyon araçları</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Test ve geliştirme ortamları</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Kapsamlı dokümantasyon ve örnekler</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Performans izleme ve analiz</span>
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
              <span>API anahtarlarını yönetir ve güvenliği sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Entegrasyonları test eder ve doğrular</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Kapsamlı dokümantasyon ve örnekler sunar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Performans izleme ve analiz araçları sağlar</span>
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
              href="https://admin.ezacore.ai/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Developer Console'a Git
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

