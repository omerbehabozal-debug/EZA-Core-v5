import Section from "../components/Section";
import FadeIn from "../components/FadeIn";
import Icon from "../components/Icon";

export const metadata = {
  title: "Kullanım Koşulları | EZA",
  description: "EZA'nın rolünü, sınırlarını ve kullanıcı sorumluluklarını açıkça tanımlar. EZA, müdahale etmeyen ancak etik farkındalık sunan bir gözlem altyapısıdır.",
};

export default function TermsPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Kullanım Koşulları
            </h1>
            <p className="text-xl text-eza-text-secondary mb-3">
              EZA'nın rolünü, sınırlarını ve kullanıcı sorumluluklarını açıkça tanımlar.
            </p>
            <p className="text-sm text-eza-text-secondary/70 italic">
              EZA, müdahale etmeyen ancak etik farkındalık sunan bir gözlem altyapısıdır.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Section 1: EZA'nın Temel Rolü */}
      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={100}>
            <div className="text-center mb-12">
              <p className="text-lg text-eza-text-secondary max-w-3xl mx-auto leading-relaxed">
                EZA, yapay zekâ sistemleri tarafından üretilen çıktıları etik etkileri açısından ölçmek ve 
                görünür kılmak amacıyla tasarlanmıştır. Bu sistemin ne yaptığı kadar, ne yapmadığı da 
                açıkça tanımlanmalıdır.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FadeIn delay={200}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="Eye" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Etik Gözlem</h3>
                  <p className="text-eza-text-secondary leading-relaxed text-sm">
                    EZA, yapay zekâ çıktılarının etik, toplumsal ve regülasyonel etkilerini analiz eder ve 
                    görünür kılar.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={300}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="Ban" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Zorlayıcı Müdahale Yapmaz</h3>
                  <p className="text-eza-text-secondary leading-relaxed text-sm">
                    EZA, içerik üretim süreçlerine otomatik, zorlayıcı veya bağlayıcı biçimde müdahale etmez. 
                    Kullanıcının açık talebi olmadan çıktıları değiştirmez, sansürlemez veya engellemez.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={400}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="Lightbulb" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Kullanıcı Talebiyle Etik Öneri</h3>
                  <p className="text-eza-text-secondary leading-relaxed text-sm">
                    EZA, kullanıcı talep ettiğinde; mevcut bağlamı koruyarak, etik farkındalığı artırmaya 
                    yönelik öneriler sunabilir. Bu öneriler bağlayıcı değildir.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={500}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="User" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Nihai Karar Kullanıcıdadır</h3>
                  <p className="text-eza-text-secondary leading-relaxed text-sm">
                    EZA tarafından sunulan analiz ve öneriler, karar mekanizması değildir. Nihai sorumluluk 
                    kullanıcıya aittir.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      {/* Section 2: Ürün Bazlı Kullanım Farkları */}
      <Section className="bg-eza-gray">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-8 text-center">
              Ürün Bazlı Kullanım Farkları
            </h2>
            
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-semibold text-eza-text mb-4">Standalone</h3>
                <p className="text-lg text-eza-text-secondary leading-relaxed">
                  EZA'nın bireysel kullanım modudur. Kullanıcı, yapay zekâ ile yazışırken etik etkiyi anlık 
                  olarak gözlemleyebilir. Güvenli yazışma ifadesi, otomatik sansür değil; etik farkındalık 
                  ve isteğe bağlı bilgilendirmeyi ifade eder.
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-semibold text-eza-text mb-4">Proxy-Lite</h3>
                <p className="text-lg text-eza-text-secondary leading-relaxed">
                  Hafif analiz gerektiren bireysel içerikler için tasarlanmıştır. Kullanıcı talep ederse, 
                  içerik bağlamı korunarak etik iyileştirme önerileri sunulabilir.
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                <h3 className="text-2xl font-semibold text-eza-text mb-4">Proxy</h3>
                <p className="text-lg text-eza-text-secondary leading-relaxed">
                  Kurumsal sistemler için API tabanlı derin analiz çözümüdür. Etik değerlendirme, raporlama 
                  ve kullanıcı talebiyle öneri üretimi sağlar. Otomatik içerik müdahalesi yapmaz.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Section 3: Etik Skorların Doğası */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Etik Skorların Bilgilendirici Niteliği
            </h2>
            <p className="text-lg text-eza-text-secondary mb-6 text-center leading-relaxed">
              EZA tarafından üretilen etik skorlar bağlayıcı değildir. Bu skorlar, karar vermek için değil; 
              etik etkiyi ölçmek ve görünür kılmak amacıyla sunulur.
            </p>
            
            <div className="bg-eza-blue/5 border border-eza-blue/20 rounded-xl p-6 mb-6">
              <p className="text-eza-text font-medium text-center text-lg">
                Skorlar rehberlik eder, karar vermez.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      {/* Section 4: Sorumluluk Sınırları */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Nihai Sorumluluk
            </h2>
            <p className="text-lg text-eza-text-secondary leading-relaxed text-center">
              EZA, kullanıcıların aldığı kararlar, ürettiği içerikler veya bu içeriklerin sonuçlarından 
              sorumlu değildir. Sistem yalnızca etik gözlem ve isteğe bağlı öneri sunar.
            </p>
          </FadeIn>
        </div>
      </Section>

      {/* Section 5: Hizmetin Kullanımı */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Hizmetin Kullanımı
            </h2>
            <p className="text-lg text-eza-text-secondary leading-relaxed text-center">
              EZA hizmetlerini kullanan kullanıcılar, sistemin zorlayıcı müdahalede bulunmadığını ve 
              etik önerilerin kullanıcı talebiyle çalıştığını kabul etmiş sayılır.
            </p>
          </FadeIn>
        </div>
      </Section>

      {/* Section 6: İletişim */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              İletişim
            </h2>
            <p className="text-lg text-eza-text-secondary leading-relaxed text-center">
              Kullanım koşullarıyla ilgili sorularınız için bizimle iletişime geçebilirsiniz.
            </p>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}
