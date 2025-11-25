import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Proxy",
  "API proxy katmanı olarak çalışan etik kontrol sistemi. Tüm istekleri yönlendirir."
);

export default function ProxyPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Proxy
          </h1>
          <p className="text-xl text-gray-700">
            API proxy katmanı olarak çalışan etik kontrol sistemi. Tüm istekleri yönlendirir.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            EZA Proxy, API proxy katmanı olarak çalışan bir etik kontrol sistemidir. Tüm API 
            isteklerini yönlendirir, zararlı içerikleri tespit eder ve daha iyi alternatifler 
            önerir. Bu yaklaşım, sisteminizin tüm trafiğini etik açıdan kontrol etmenizi sağlar.
          </p>
          <p>
            Proxy katmanı, istekleri analiz eder, etik değerlendirmeler yapar ve yönlendirir. 
            İçeriği engellemez veya yasaklamaz; bunun yerine daha iyi alternatifler önerir ve 
            sisteminizin daha etik davranmasını sağlar.
          </p>
          <p>
            EZA Proxy, özellikle API tabanlı sistemler için idealdir. Tüm trafiği merkezi bir 
            noktadan kontrol ederek, sistem genelinde etik standartları sağlar. Bu sayede 
            organizasyonunuzun tüm teknolojik sistemleri etik açıdan yönlendirilir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Merkezi etik kontrol - tüm trafiği yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>API tabanlı sistemler için ideal</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Gerçek zamanlı etik değerlendirme</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Sistem genelinde etik standartlar</span>
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
              <span>Tüm API isteklerini yönlendirir ve etik kontrol yapar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Zararlı içerikleri tespit eder ve daha iyi alternatifler önerir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Merkezi bir noktadan sistem genelinde etik standartlar sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Gerçek zamanlı etik değerlendirme ve yönlendirme sunar</span>
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

