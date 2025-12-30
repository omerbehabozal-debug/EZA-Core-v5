import Section from "../components/Section";
import FadeIn from "../components/FadeIn";

export const metadata = {
  title: "Hakkımızda | EZA",
  description: "EZA'nın varlık nedeni, yaklaşımı ve etik duruşu.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-5xl md:text-6xl font-semibold text-eza-text mb-6">
              Hakkımızda
            </h1>
            <p className="text-2xl text-eza-text-secondary mb-4">
              EZA'nın varlık nedeni, yaklaşımı ve etik duruşu.
            </p>
            <p className="text-sm text-eza-text-secondary/70 italic">
              EZA bir ürün değil, bir gözlem yaklaşımıdır.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Vizyon */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-8">
              Vizyon
            </h2>
            <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                EZA, teknolojinin hızla geliştiği bir dünyada, etik etkinin görünür olmasını amaçlar.
              </p>
              <p>
                Kararların, içeriklerin ve otomatik sistemlerin etkileri çoğu zaman ölçülmeden ilerler.
              </p>
              <p>
                EZA'nın vizyonu, bu görünmez alanı şeffaf ve izlenebilir hale getirmektir.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Manifesto */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Manifesto
            </h2>
            <p className="text-lg text-eza-text-secondary mb-12">
              EZA aşağıdaki ilkelere dayanır:
            </p>
            
            <div className="space-y-8">
              <div className="border-l-4 border-eza-blue pl-6 py-2">
                <p className="text-xl font-semibold text-eza-text mb-2">
                  EZA, müdahale etmez.
                </p>
                <p className="text-base text-eza-text-secondary">
                  Zorlayıcı, otomatik veya bağlayıcı kararlar üretmez.
                </p>
              </div>

              <div className="border-l-4 border-eza-blue pl-6 py-2">
                <p className="text-xl font-semibold text-eza-text mb-2">
                  EZA, yasaklamaz.
                </p>
                <p className="text-base text-eza-text-secondary">
                  İçeriği değiştirmez, sansürlemez.
                </p>
              </div>

              <div className="border-l-4 border-eza-blue pl-6 py-2">
                <p className="text-xl font-semibold text-eza-text mb-2">
                  EZA, ölçer.
                </p>
                <p className="text-base text-eza-text-secondary">
                  Etik etkiyi bağlamı içinde değerlendirir.
                </p>
              </div>

              <div className="border-l-4 border-eza-blue pl-6 py-2">
                <p className="text-xl font-semibold text-eza-text mb-2">
                  EZA, görünür kılar.
                </p>
                <p className="text-base text-eza-text-secondary">
                  Kararları değil, etkileri şeffaflaştırır.
                </p>
              </div>

              <div className="border-l-4 border-eza-blue pl-6 py-2">
                <p className="text-xl font-semibold text-eza-text mb-2">
                  EZA, sorumluluğu devralmaz.
                </p>
                <p className="text-base text-eza-text-secondary">
                  Nihai karar her zaman insana aittir.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* EZA'nın İlkeleri */}
      <Section className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-12 text-center">
              EZA'nın İlkeleri
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FadeIn delay={100}>
                <div className="bg-white rounded-lg p-8 border border-gray-200 h-full">
                  <h3 className="text-2xl font-semibold text-eza-text mb-4">
                    Tarafsızlık
                  </h3>
                  <p className="text-base text-eza-text-secondary leading-relaxed">
                    EZA, herhangi bir ideoloji, kurum veya çıkar grubu adına pozisyon almaz.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={200}>
                <div className="bg-white rounded-lg p-8 border border-gray-200 h-full">
                  <h3 className="text-2xl font-semibold text-eza-text mb-4">
                    Şeffaflık
                  </h3>
                  <p className="text-base text-eza-text-secondary leading-relaxed">
                    Analiz süreçleri ve skorlar izlenebilir ve açıklanabilir şekilde sunulur.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="bg-white rounded-lg p-8 border border-gray-200 h-full">
                  <h3 className="text-2xl font-semibold text-eza-text mb-4">
                    Kullanıcı Kontrolü
                  </h3>
                  <p className="text-base text-eza-text-secondary leading-relaxed">
                    Etik değerlendirme ve öneriler yalnızca kullanıcı talebiyle sunulur.
                  </p>
                </div>
              </FadeIn>

              <FadeIn delay={400}>
                <div className="bg-white rounded-lg p-8 border border-gray-200 h-full">
                  <h3 className="text-2xl font-semibold text-eza-text mb-4">
                    Kamu Yararı
                  </h3>
                  <p className="text-base text-eza-text-secondary leading-relaxed">
                    EZA, etik farkındalığın kamusal bir değer olduğuna inanır.
                  </p>
                </div>
              </FadeIn>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Ne Yapmadığımız */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-12">
              Ne Yapmadığımız
            </h2>
            
            <ul className="space-y-4 text-lg text-eza-text-secondary">
              <li className="flex items-start">
                <span className="text-eza-blue text-xl mr-4 mt-1">•</span>
                <span>Karar vermeyiz</span>
              </li>
              <li className="flex items-start">
                <span className="text-eza-blue text-xl mr-4 mt-1">•</span>
                <span>Müdahale etmeyiz</span>
              </li>
              <li className="flex items-start">
                <span className="text-eza-blue text-xl mr-4 mt-1">•</span>
                <span>Zorunlu yönlendirme yapmayız</span>
              </li>
              <li className="flex items-start">
                <span className="text-eza-blue text-xl mr-4 mt-1">•</span>
                <span>Otomatik sansür uygulamayız</span>
              </li>
              <li className="flex items-start">
                <span className="text-eza-blue text-xl mr-4 mt-1">•</span>
                <span>Kullanıcı adına sorumluluk üstlenmeyiz</span>
              </li>
            </ul>
          </FadeIn>
        </div>
      </Section>

      {/* Footnote */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <p className="text-sm text-eza-text-secondary/70 italic">
              EZA, etik farkındalığı artırmayı amaçlayan bir gözlem altyapısıdır.
            </p>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}
