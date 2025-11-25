import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Regulator Panel",
  "Düzenleyici kurumlar için özel panel. Sektör genelinde etik izleme ve raporlama."
);

export default function RegulatorPanelPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Regulator Panel
          </h1>
          <p className="text-xl text-gray-700">
            Düzenleyici kurumlar için özel panel. Sektör genelinde etik izleme ve raporlama.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            EZA Regulator Panel, düzenleyici kurumlar için özel olarak tasarlanmış bir yönetim 
            panelidir. Sektör genelinde etik izleme, raporlama ve uyumluluk yönetimi sağlar. 
            Bu panel, düzenleyici kurumların teknoloji sektöründeki etik standartları izlemesini 
            ve yönetmesini sağlar.
          </p>
          <p>
            Regulator Panel, sektör genelinde etik davranışları izler, raporlar ve analiz eder. 
            Düzenleyici kurumlar, bu panel aracılığıyla sektördeki etik uyumluluğu takip edebilir, 
            sorunlu alanları tespit edebilir ve gerekli önlemleri alabilir.
          </p>
          <p>
            EZA Regulator Panel, özellikle teknoloji sektörünü düzenleyen kurumlar için idealdir. 
            Sektör genelinde etik standartları izleyerek, teknolojinin insanlığa karşı etik 
            davranmasını sağlar.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Sektör genelinde etik izleme ve raporlama</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Uyumluluk yönetimi ve takip</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Detaylı analiz ve raporlama araçları</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Düzenleyici kurumlar için özel tasarım</span>
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
              <span>Sektör genelinde etik davranışları izler ve raporlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Uyumluluk durumunu takip eder ve analiz eder</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Detaylı raporlama araçları sunar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Düzenleyici kurumların etik standartları yönetmesini sağlar</span>
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

