import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Autonomous Solutions",
  "Otonom sistemlerde etik yönlendirme. Robotik ve AI karar destek sistemleri için güvenlik."
);

export default function AutonomousPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Autonomous Solutions
          </h1>
          <p className="text-xl text-gray-700">
            Otonom sistemlerde etik yönlendirme. Robotik ve AI karar destek sistemleri için güvenlik.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            Otonom sistemler, robotik ve AI karar destek sistemleri giderek daha yaygın hale geliyor. 
            Bu sistemlerin insanlara karşı etik davranması ve güvenli kararlar vermesi kritik 
            öneme sahiptir.
          </p>
          <p>
            EZA, otonom sistemlerde etik yönlendirme sağlar. Robotik sistemlerin insanlara karşı 
            saygılı davranması, güvenli karar verme ve etik değerlerin korunması konularında 
            rehberlik eder. EZA, otonom sistemlerin insanlığa karşı etik davranmasını sağlar.
          </p>
          <p>
            Otonom sistem geliştiricileri, EZA ile robotik sistemlerin etik davranmasını 
            sağlayabilir, güvenli karar verme mekanizmaları kurabilir ve insan haklarını 
            güvence altına alabilir. EZA, otonom teknolojilerin etik kullanımını yönlendirir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Otonom sistemlerin etik karar vermesi</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>İnsan güvenliğinin önceliklendirilmesi</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Robotik sistemlerde etik değerlerin korunması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Otonom teknolojilerin sorumlu kullanımı</span>
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
              <span>Otonom sistemlerin etik karar vermesini yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Robotik sistemlerde güvenlik önceliği sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>İnsan haklarının korunmasını garanti eder</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Otonom sistemlerde etik davranışı teşvik eder</span>
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

