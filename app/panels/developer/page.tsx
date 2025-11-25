import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Developer Console",
  "Geliştiriciler için API yönetim konsolu. Entegrasyon ve test araçları."
);

export default function DeveloperPanelPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Developer Console
          </h1>
          <p className="text-xl text-gray-700">
            Geliştiriciler için API yönetim konsolu. Entegrasyon ve test araçları.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
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
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
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
      </Section>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">EZA Nasıl Yardımcı Olur?</h2>
          <ul className="space-y-4 text-lg text-gray-700">
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
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/#ecosystem"
            className="inline-block px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl"
          >
            EZA Ekosistemine Dön
          </Link>
        </div>
      </Section>
    </>
  );
}

