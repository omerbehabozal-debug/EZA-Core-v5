import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "Education Solutions",
  "Eğitim teknolojilerinde etik kullanım. Öğrenci verilerinin korunması ve adil AI kullanımı."
);

export default function EducationPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            Education Solutions
          </h1>
          <p className="text-xl text-gray-700">
            Eğitim teknolojilerinde etik kullanım. Öğrenci verilerinin korunması ve adil AI kullanımı.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            Eğitim sektöründe teknoloji kullanımı hızla artıyor. AI destekli öğrenme platformları, 
            otomatik değerlendirme sistemleri ve kişiselleştirilmiş eğitim araçları yaygınlaşıyor. 
            Ancak bu teknolojilerin öğrencilere karşı etik davranması kritik bir konudur.
          </p>
          <p>
            EZA, eğitim teknolojilerinde etik kullanımı sağlar. Öğrenci verilerinin korunması, 
            adil değerlendirme sistemleri ve öğrencilerin gizliliğinin korunması konularında 
            rehberlik eder. EZA, eğitim teknolojilerinin öğrencilere karşı saygılı ve adil 
            davranmasını sağlar.
          </p>
          <p>
            Eğitim kurumları, EZA ile öğrenci verilerini koruyabilir, adil AI kullanımını 
            sağlayabilir ve öğrencilerin gizliliğini güvence altına alabilir. EZA, eğitim 
            teknolojilerinin etik kullanımını yönlendirir ve daha iyi alternatifler önerir.
          </p>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Faydalar</h2>
          <ul className="space-y-4 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Öğrenci verilerinin korunması ve gizliliğin sağlanması</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Adil değerlendirme sistemleri ve önyargı önleme</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Yaşa uygun içerik filtreleme ve çocuk güvenliği</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>Eğitim teknolojilerinin etik kullanımı için rehberlik</span>
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
              <span>Öğrenci verilerinin etik kullanımını yönlendirir</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>AI değerlendirme sistemlerinde adalet sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Çocuk güvenliği modülü ile yaşa uygun içerik sağlar</span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-blue text-xl mr-3">•</span>
              <span>Eğitim platformlarında etik davranışı teşvik eder</span>
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

