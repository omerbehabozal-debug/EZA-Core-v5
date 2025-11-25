import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Banking Solutions",
  "Finansal hizmetlerde etik AI. Kredi kararlarında adalet ve şeffaflık."
);

export default function BankingPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Banking Solutions
          </h1>
          <p className="text-xl text-gray-700">
            Finansal hizmetlerde etik AI. Kredi kararlarında adalet ve şeffaflık.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            Bankacılık sektöründe AI kullanımı, kredi değerlendirmelerinden dolandırıcılık 
            tespitine kadar birçok alanda yaygınlaşıyor. Ancak bu sistemlerin adil ve 
            şeffaf olması kritik bir konudur.
          </p>
          <p>
            EZA, finansal hizmetlerde etik AI kullanımını sağlar. Kredi kararlarında adalet, 
            müşteri verilerinin korunması ve şeffaflık konularında rehberlik eder. EZA, 
            bankacılık sistemlerinin müşterilere karşı etik davranmasını sağlar.
          </p>
          <p>
            Finansal kurumlar, EZA ile kredi değerlendirme sistemlerinde adalet sağlayabilir, 
            müşteri verilerini koruyabilir ve şeffaf AI kullanımını garanti edebilir. EZA, 
            finansal teknolojilerin etik kullanımını yönlendirir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Kredi kararlarında adalet ve önyargı önleme</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Müşteri verilerinin korunması ve gizlilik</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Şeffaf AI karar süreçleri</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Finansal teknolojilerin etik kullanımı</span>
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
              <span>Kredi değerlendirme sistemlerinde adalet sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Müşteri verilerinin etik kullanımını yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>AI karar süreçlerinde şeffaflık sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Finansal sistemlerde etik davranışı teşvik eder</span>
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

