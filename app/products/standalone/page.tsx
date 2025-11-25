import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Standalone",
  "Bağımsız etik değerlendirme platformu. Herhangi bir sistemle entegre olmadan çalışır."
);

export default function StandalonePage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Standalone
          </h1>
          <p className="text-xl text-gray-700">
            Bağımsız etik değerlendirme platformu. Herhangi bir sistemle entegre olmadan çalışır.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            EZA Standalone, bağımsız çalışan bir etik değerlendirme platformudur. Herhangi bir 
            sistemle entegre olmadan, kendi başına etik analiz yapar ve yönlendirmeler sunar. 
            Bu yaklaşım, mevcut sistemlerinize müdahale etmeden etik kontrol sağlar.
          </p>
          <p>
            Standalone platform, içerikleri analiz eder, etik değerlendirmeler yapar ve daha iyi 
            alternatifler önerir. Yasaklamaz, engellemez; sadece rehberlik eder. Bu sayede 
            teknolojinizin daha etik davranmasını sağlarken, sisteminizin bağımsızlığını korursunuz.
          </p>
          <p>
            EZA Standalone, özellikle mevcut sistemlerini değiştirmek istemeyen kurumlar için 
            idealdir. Bağımsız çalışma özelliği sayesinde, herhangi bir entegrasyon gerektirmeden 
            etik kontrol sağlayabilirsiniz.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Bağımsız çalışma - entegrasyon gerektirmez</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Mevcut sistemlere müdahale etmez</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Esnek kullanım ve kolay kurulum</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Etik değerlendirme ve yönlendirme</span>
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
              <span>İçerikleri bağımsız olarak analiz eder ve etik değerlendirme yapar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Daha iyi alternatifler önerir ve yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Mevcut sistemlerinize müdahale etmeden çalışır</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Esnek kullanım ile ihtiyaçlarınıza göre özelleştirilebilir</span>
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

