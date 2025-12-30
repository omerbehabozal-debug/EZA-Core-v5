import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Social & Communication Ethics",
  "Sosyal platformlar ve iletişim için etik standartlar. Zararlı etkileşim önleme."
);

export default function SocialCommunicationEthicsPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="MessageCircle" size={16} />
              Ethics Modules
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Social & Communication Ethics
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Sosyal platformlar ve iletişim için etik standartlar. Zararlı etkileşim önleme.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            Social & Communication Ethics, sosyal medya platformları, mesajlaşma uygulamaları 
            ve dijital iletişim araçları için özel olarak tasarlanmış etik modüldür. Kullanıcı 
            etkileşimlerini, mesajları ve içerikleri analiz eder, zararlı veya etik olmayan 
            davranışları tespit eder ve daha saygılı alternatifler önerir.
          </p>
          <p>
            Bu modül, EZA-Core'un çekirdek teknolojisi üzerine inşa edilmiştir ve sosyal 
            psikoloji, iletişim etiği ve dijital etkileşim prensiplerine göre optimize edilmiştir. 
            Siber zorbalık, nefret söylemi, manipülatif iletişim, yanıltıcı bilgi ve zararlı 
            etkileşimleri tespit eder ve platform yöneticilerine, kullanıcılara ve içerik 
            üreticilerine rehberlik sağlar.
          </p>
          <p>
            Social & Communication Ethics, içerikleri yasaklamaz veya sansürlemez. Bunun yerine, 
            iletişimin neden etik olmadığını açıklar ve daha saygılı, dürüst ve yapıcı alternatifler 
            sunar. Bu sayede dijital iletişim, insanlığa karşı daha saygılı ve sorumlu davranır.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-8">Modül Özellikleri</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="MessageCircle" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">İletişim Analizi</h3>
              </div>
                <p className="text-eza-text-secondary">
                Mesajları, yorumları ve etkileşimleri analiz eder, dil tonu, saygı seviyesi ve 
                etik uyumluluğu değerlendirir.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="AlertTriangle" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Zararlı Etkileşim Tespiti</h3>
              </div>
                <p className="text-eza-text-secondary">
                Siber zorbalık, nefret söylemi, manipülatif iletişim ve zararlı davranışları 
                tespit eder ve kategorize eder.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Heart" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Saygılı Alternatifler</h3>
              </div>
                <p className="text-eza-text-secondary">
                Tespit edilen sorunlar için daha saygılı, yapıcı ve etik alternatifler önerir 
                ve iletişim kalitesini artırır.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Users" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Topluluk Yönetimi</h3>
              </div>
                <p className="text-eza-text-secondary">
                Platform yöneticilerine topluluk standartlarını korumak için araçlar ve 
                rehberlik sağlar.
              </p>
            </div>
          </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Tespit Edilen Riskler</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Siber Zorbalık</h3>
                <p className="text-eza-text-secondary">
                Kullanıcıları hedef alan zorbalık içerikleri, tehditler, aşağılama ve 
                psikolojik zarar vermeye yönelik davranışlar.
              </p>
            </div>
            <div className="border-l-4 border-eza-green pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Nefret Söylemi</h3>
                <p className="text-eza-text-secondary">
                Irk, din, cinsiyet, etnik köken veya diğer özelliklere dayalı nefret içeren 
                mesajlar ve ayrımcı dil.
              </p>
            </div>
            <div className="border-l-4 border-eza-gold pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Manipülatif İletişim</h3>
                <p className="text-eza-text-secondary">
                Kullanıcıları yanıltmaya veya zorlamaya yönelik iletişim teknikleri, duygusal 
                manipülasyon ve yanıltıcı bilgiler.
              </p>
            </div>
            <div className="border-l-4 border-eza-text pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Yanıltıcı Bilgi</h3>
                <p className="text-eza-text-secondary">
                Sahte haberler, yanıltıcı bilgiler, komplo teorileri ve doğrulanmamış iddialar.
              </p>
            </div>
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Saygısız Davranış</h3>
                <p className="text-eza-text-secondary">
                Kaba, saygısız veya saldırgan dil kullanımı, kişisel saldırılar ve yıkıcı 
                etkileşimler.
              </p>
            </div>
          </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Kullanım Senaryoları</h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Sosyal Medya Platformları:</strong> Kullanıcı yorumlarını, mesajlarını 
                ve etkileşimlerini analiz edin ve topluluk standartlarını koruyun
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Mesajlaşma Uygulamaları:</strong> Mesaj içeriklerini analiz edin ve 
                zararlı iletişimi tespit edin
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Forum ve Topluluklar:</strong> Forum yazılarını ve tartışmaları analiz 
                edin ve saygılı iletişimi teşvik edin
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Müşteri Hizmetleri:</strong> Müşteri iletişimlerinde etik standartları 
                sağlayın ve saygılı dil kullanımını teşvik edin
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Eğitim Platformları:</strong> Öğrenci etkileşimlerini analiz edin ve 
                güvenli öğrenme ortamı sağlayın
              </span>
            </li>
          </ul>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={500}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">EZA Yaklaşımı</h2>
            <div className="bg-gradient-to-br from-eza-blue/5 to-white rounded-xl p-6 border border-eza-blue/10">
              <p className="text-lg text-eza-text-secondary leading-relaxed mb-4">
              Social & Communication Ethics, EZA'nın temel felsefesini yansıtır: <strong className="text-eza-text">yasaklamaz, 
              ceza vermez; sadece daha iyi bir davranış önerir.</strong>
            </p>
              <p className="text-lg text-eza-text-secondary leading-relaxed">
                Modül, içerikleri engellemez veya sansürlemez. Bunun yerine, iletişimin neden 
                etik olmadığını açıklar ve daha saygılı, yapıcı alternatifler sunar. Platform 
                yöneticilerine ve kullanıcılara karar verme sürecinde rehberlik sağlar. Bu sayede 
                dijital iletişim, insanlığa karşı daha saygılı ve sorumlu davranır.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={600}>
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-gradient-to-br from-eza-blue/5 to-white rounded-2xl p-8 border border-eza-blue/10">
              <h3 className="text-2xl font-semibold text-eza-text mb-4">
                Social & Communication Ethics Modülünü Keşfedin
              </h3>
              <p className="text-eza-text-secondary mb-6">
              EZA-Core platformu üzerinden Social & Communication Ethics modülüne erişebilir ve 
              API entegrasyonu yapabilirsiniz.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="https://ezacore.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
              >
                EZA-Core Platformu
                <Icon name="ExternalLink" size={18} />
              </Link>
              <Link
                href="/#ecosystem"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('homeScrollSection', 'ecosystem');
                  }
                }}
              >
                EZA Ekosistemine Dön
                <Icon name="ArrowLeft" size={18} />
              </Link>
            </div>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

