import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Children Safety",
  "Çocuk güvenliği odaklı etik modül. Yaşa uygun içerik filtreleme ve koruma."
);

export default function ChildrenSafetyPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="Users" size={16} />
              Ethics Modules
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Children Safety
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Çocuk güvenliği odaklı etik modül. Yaşa uygun içerik filtreleme ve koruma.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            Children Safety, çocukların dijital dünyada güvende kalması için özel olarak 
            tasarlanmış etik modüldür. İçerikleri yaş gruplarına göre analiz eder, uygunsuz 
            veya zararlı içerikleri tespit eder ve çocuklara uygun alternatifler önerir.
          </p>
          <p>
            Bu modül, EZA-Core'un çekirdek teknolojisi üzerine inşa edilmiştir ve çocuk 
            gelişimi, psikoloji ve pedagoji prensiplerine göre optimize edilmiştir. Şiddet, 
            cinsel içerik, zararlı öneriler ve yaşa uygun olmayan dil kullanımını tespit eder 
            ve ebeveynlere, eğitimcilere ve platform yöneticilerine rehberlik sağlar.
          </p>
          <p>
            Children Safety, içerikleri yasaklamaz veya sansürlemez. Bunun yerine, içeriğin 
            neden çocuklar için uygun olmadığını açıklar ve yaşa uygun alternatifler sunar. 
            Bu sayede teknoloji, çocuklara karşı daha sorumlu ve koruyucu davranır.
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
                  <Icon name="Users" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Yaş Gruplarına Göre Analiz</h3>
              </div>
                <p className="text-eza-text-secondary">
                3-6, 7-12, 13-17 yaş gruplarına özel analiz yapar ve her yaş grubuna uygun 
                içerik önerileri sunar.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Shield" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Kapsamlı Koruma</h3>
              </div>
                <p className="text-eza-text-secondary">
                Şiddet, cinsel içerik, zararlı öneriler, siber zorbalık ve manipülatif içerikleri 
                tespit eder.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Heart" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Pedagojik Yaklaşım</h3>
              </div>
                <p className="text-eza-text-secondary">
                Çocuk gelişimi ve pedagoji prensiplerine göre içerikleri değerlendirir ve 
                eğitici alternatifler önerir.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Eye" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Ebeveyn Kontrolü</h3>
              </div>
                <p className="text-eza-text-secondary">
                Ebeveynlere ve eğitimcilere detaylı raporlar sunar ve içerik kararlarında 
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
            <h2 className="text-3xl font-bold text-eza-text mb-6">Koruma Alanları</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Şiddet İçeriği</h3>
                <p className="text-eza-text-secondary">
                Fiziksel veya psikolojik şiddet içeren içerikler, korkutucu senaryolar ve 
                travmatik deneyimler.
              </p>
            </div>
            <div className="border-l-4 border-eza-green pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Cinsel İçerik</h3>
                <p className="text-eza-text-secondary">
                Yaşa uygun olmayan cinsel içerikler, cinsel istismar riski ve uygunsuz 
                davranış önerileri.
              </p>
            </div>
            <div className="border-l-4 border-eza-gold pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Zararlı Öneriler</h3>
                <p className="text-eza-text-secondary">
                Fiziksel zarara yol açabilecek aktiviteler, tehlikeli davranışlar ve riskli 
                deneyimler.
              </p>
            </div>
            <div className="border-l-4 border-eza-text pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Manipülatif İçerik</h3>
                <p className="text-eza-text-secondary">
                Çocukları yanıltmaya veya zorlamaya yönelik içerikler, duygusal manipülasyon 
                ve yanıltıcı bilgiler.
              </p>
            </div>
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Siber Zorbalık</h3>
                <p className="text-eza-text-secondary">
                Zorbalık içeren içerikler, nefret söylemi ve çocuklara yönelik zararlı 
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
                <strong>Eğitim Platformları:</strong> Çocuklara yönelik eğitim içeriklerini 
                analiz edin ve yaşa uygunluğunu kontrol edin
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Oyun ve Eğlence:</strong> Çocuk oyunları ve eğlence içeriklerinde 
                güvenlik kontrolü yapın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Sosyal Medya:</strong> Çocuklara yönelik sosyal medya içeriklerini 
                izleyin ve koruma sağlayın
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Ebeveyn Kontrolü:</strong> Ebeveynlere içerik kararlarında rehberlik 
                sağlayın ve güvenli alternatifler sunun
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Eğitim Kurumları:</strong> Okullar ve eğitim kurumlarında içerik 
                güvenliği sağlayın
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
              Children Safety, EZA'nın temel felsefesini yansıtır: <strong className="text-eza-text">yasaklamaz, 
              ceza vermez; sadece daha iyi bir davranış önerir.</strong>
            </p>
              <p className="text-lg text-eza-text-secondary leading-relaxed">
                Modül, içerikleri engellemez veya sansürlemez. Bunun yerine, içeriğin neden 
                çocuklar için uygun olmadığını açıklar ve yaşa uygun alternatifler sunar. 
                Ebeveynlere ve eğitimcilere karar verme sürecinde rehberlik sağlar. Bu sayede 
                teknoloji, çocuklara karşı daha sorumlu ve koruyucu davranır.
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
                Children Safety Modülünü Keşfedin
              </h3>
              <p className="text-eza-text-secondary mb-6">
              EZA-Core platformu üzerinden Children Safety modülüne erişebilir ve API entegrasyonu 
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

