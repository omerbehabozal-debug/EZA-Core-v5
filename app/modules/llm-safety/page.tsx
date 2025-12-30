import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "LLM Safety",
  "Büyük dil modelleri için etik güvenlik modülü. Zararlı içerik tespiti ve yönlendirme."
);

export default function LLMSafetyPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="Shield" size={16} />
              Ethics Modules
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              LLM Safety
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Büyük dil modelleri için etik güvenlik modülü. Zararlı içerik tespiti ve yönlendirme.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            LLM Safety, büyük dil modelleri (Large Language Models) için özel olarak tasarlanmış 
            etik güvenlik modülüdür. GPT, Claude, Gemini gibi büyük dil modellerinin ürettiği 
            içerikleri analiz eder, zararlı veya etik olmayan içerikleri tespit eder ve daha iyi 
            alternatifler önerir.
          </p>
          <p>
            Bu modül, EZA-Core'un çekirdek teknolojisi üzerine inşa edilmiştir ve LLM'lerin 
            özel yapısına göre optimize edilmiştir. Manipülatif dil, zararlı öneriler, ayrımcı 
            içerik ve etik olmayan yönlendirmeleri tespit eder ve kullanıcıya daha güvenli 
            alternatifler sunar.
          </p>
          <p>
            LLM Safety, yasaklama veya sansürleme yapmaz. Bunun yerine, içeriğin neden etik 
            olmadığını açıklar ve daha iyi bir yaklaşım önerir. Bu sayede teknoloji, insanlığa 
            karşı daha saygılı ve sorumlu davranır.
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
                  <Icon name="Brain" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">LLM Özel Analiz</h3>
              </div>
                <p className="text-eza-text-secondary">
                Büyük dil modellerinin üretim kalıplarını anlayarak, zararlı içerikleri ve 
                manipülatif teknikleri tespit eder.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="AlertTriangle" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Zararlı İçerik Tespiti</h3>
              </div>
                <p className="text-eza-text-secondary">
                Manipülatif dil, yanıltıcı bilgi, ayrımcı içerik ve etik olmayan önerileri 
                tespit eder ve kategorize eder.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Lightbulb" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Yapıcı Yönlendirme</h3>
              </div>
                <p className="text-eza-text-secondary">
                Tespit edilen sorunlar için daha etik alternatifler önerir ve neden daha iyi 
                olduğunu açıklar.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Zap" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Gerçek Zamanlı</h3>
              </div>
                <p className="text-eza-text-secondary">
                LLM çıktılarını gerçek zamanlı olarak analiz eder ve anında geri bildirim sağlar.
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
              <h3 className="text-xl font-semibold text-eza-text mb-2">Manipülatif Dil</h3>
                <p className="text-eza-text-secondary">
                Kullanıcıyı yanıltmaya veya zorlamaya yönelik dil kalıpları, duygusal manipülasyon 
                ve yanıltıcı retorik teknikler.
              </p>
            </div>
            <div className="border-l-4 border-eza-green pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Zararlı Öneriler</h3>
                <p className="text-eza-text-secondary">
                Fiziksel, psikolojik veya finansal zarara yol açabilecek öneriler, tehlikeli 
                aktiviteler ve riskli davranışlar.
              </p>
            </div>
            <div className="border-l-4 border-eza-gold pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Ayrımcı İçerik</h3>
                <p className="text-eza-text-secondary">
                Irk, cinsiyet, din, yaş veya diğer özelliklere dayalı ayrımcılık içeren içerikler 
                ve önyargılı yönlendirmeler.
              </p>
            </div>
            <div className="border-l-4 border-eza-text pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Etik Olmayan Yönlendirmeler</h3>
                <p className="text-eza-text-secondary">
                Saygısız, dürüst olmayan veya sorumsuz davranışları teşvik eden içerikler ve 
                yönlendirmeler.
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
                <strong>LLM Çıktı Kontrolü:</strong> Büyük dil modellerinin ürettiği içerikleri 
                yayınlamadan önce analiz edin ve etik kontrol yapın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>API Entegrasyonu:</strong> LLM API'lerinize entegre ederek otomatik 
                etik kontrol sağlayın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Geliştirme Desteği:</strong> LLM uygulamalarınızı geliştirirken etik 
                standartları sağlayın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Kalite Güvencesi:</strong> Üretilen içeriklerin kalitesini ve etik 
                uyumluluğunu sürekli izleyin
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
              LLM Safety, EZA'nın temel felsefesini yansıtır: <strong className="text-eza-text">yasaklamaz, 
              ceza vermez; sadece daha iyi bir davranış önerir.</strong>
            </p>
              <p className="text-lg text-eza-text-secondary leading-relaxed">
                Modül, LLM çıktılarını engellemez veya sansürlemez. Bunun yerine, içeriğin neden 
                etik olmadığını açıklar ve daha iyi alternatifler sunar. Bu sayede büyük dil 
                modelleri, insanlığa karşı daha saygılı ve sorumlu davranır.
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
                LLM Safety Modülünü Keşfedin
              </h3>
              <p className="text-eza-text-secondary mb-6">
                EZA-Core platformu üzerinden LLM Safety modülüne erişebilir ve API entegrasyonu 
                yapabilirsiniz.
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

