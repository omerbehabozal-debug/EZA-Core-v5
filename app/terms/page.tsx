import Section from "../components/Section";
import FadeIn from "../components/FadeIn";
import Icon from "../components/Icon";

export const metadata = {
  title: "Kullanım Koşulları | EZA",
  description: "EZA'nın rolünü, sınırlarını ve kullanıcı sorumluluklarını açıkça tanımlar. EZA, müdahale etmeyen bir etik gözlem altyapısıdır.",
};

export default function TermsPage() {
  return (
    <>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Kullanım Koşulları
            </h1>
            <p className="text-xl text-eza-text-secondary mb-3">
              EZA'nın rolünü, sınırlarını ve kullanıcı sorumluluklarını açıkça tanımlar.
            </p>
            <p className="text-sm text-eza-text-secondary/70 italic">
              EZA, otomatik veya zorunlu müdahale yapmayan bir etik gözlem altyapısıdır.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Section 1: EZA'nın Rolü */}
      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeIn delay={100}>
            <div className="text-center mb-12">
              <p className="text-lg text-eza-text-secondary max-w-3xl mx-auto leading-relaxed">
                EZA, yapay zekâ çıktılarının etik etkilerini ölçmek ve görünür kılmak için tasarlanmıştır. 
                Bu sistemin ne yaptığı kadar, ne yapmadığı da açıkça tanımlanmalıdır.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FadeIn delay={200}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="Eye" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Gözlem</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    EZA, yapay zekâ sistemleri tarafından üretilen çıktıları etik, toplumsal ve regülasyonel 
                    etkiler açısından analiz eder ve görünür kılar.
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
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Karar Vermez</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    EZA, hiçbir içerik hakkında onay, ret veya yönlendirme kararı vermez. Üretilen skorlar 
                    bilgilendirici niteliktedir.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={400}>
              <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-xl bg-eza-blue/10 flex items-center justify-center mb-4">
                    <Icon name="Shield" className="text-eza-blue" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-eza-text mb-3">Otomatik Müdahale Etmez</h3>
                  <p className="text-eza-text-secondary leading-relaxed">
                    EZA, içerik üretim süreçlerine otomatik veya zorunlu müdahale etmez. Sansürlemez, 
                    engellemez ve çıktıları değiştirmez. Ancak kullanıcı açıkça talep ettiğinde, 
                    etik iyileştirme önerileri sunabilir.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </Section>

      {/* Section 2: Etik Skorların Doğası */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Etik Skorların Anlamı
            </h2>
            <p className="text-lg text-eza-text-secondary mb-6 text-center leading-relaxed">
              EZA tarafından üretilen etik skorlar, karar almak için değil; etik etkiyi ölçmek ve 
              farkındalık yaratmak için tasarlanmıştır.
            </p>
            
            <div className="bg-eza-blue/5 border border-eza-blue/20 rounded-xl p-6 mb-6">
              <p className="text-eza-text font-medium text-center">
                Bu skorlar bağlamsal değerlendirmelerdir ve bağlayıcı değildir.
              </p>
            </div>

            <p className="text-lg text-eza-text-secondary leading-relaxed text-center">
              Skorlar; niyet, bağlam, etik etki ve risk bileşenlerini dikkate alarak oluşturulur. 
              Ancak bu skorlar tek başına karar mekanizması olarak kullanılmamalıdır.
            </p>
          </FadeIn>
        </div>
      </Section>

      {/* Section 3: Sorumluluk ve Kullanım */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Kullanıcı Sorumluluğu
            </h2>
            <p className="text-lg text-eza-text-secondary mb-6 leading-relaxed text-center">
              EZA tarafından sağlanan analizler ve skorlar bilgilendirme amaçlıdır. Bu bilgiler doğrultusunda 
              alınacak tüm kararların sorumluluğu kullanıcıya aittir.
            </p>
            <p className="text-lg text-eza-text-secondary leading-relaxed text-center">
              EZA, kullanıcıların aldığı kararlar, ürettiği içerikler veya bu içeriklerin sonuçlarından 
              sorumlu tutulamaz.
            </p>
          </FadeIn>
        </div>
      </Section>

      {/* Section 4: Hizmetin Kullanımı */}
      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6 text-center">
              Hizmetin Kullanımı
            </h2>
            <p className="text-lg text-eza-text-secondary mb-4 leading-relaxed text-center">
              EZA hizmetlerini kullanan kullanıcıların, sistemin otomatik veya zorunlu müdahale yapmayan 
              yapısını ve etik gözlem yaklaşımını kabul ettiği varsayılır.
            </p>
            <div className="bg-eza-blue/5 border border-eza-blue/20 rounded-xl p-6 mb-4">
              <p className="text-eza-text font-medium text-center mb-2">
                Kullanıcı Talep Ettiğinde Öneriler
              </p>
              <p className="text-base text-eza-text-secondary text-center leading-relaxed">
                EZA, kullanıcı açıkça talep ettiğinde etik iyileştirme önerileri sunabilir. Bu öneriler 
                bağlayıcı değildir ve kullanıcı kararını değiştirmez.
              </p>
            </div>
            <p className="text-base text-eza-text-secondary/80 italic text-center">
              EZA, etik farkındalık yaratmayı amaçlayan bir altyapıdır; otomatik yönlendirici veya yaptırım 
              uygulayan bir otorite değildir.
            </p>
          </FadeIn>
        </div>
      </Section>

      {/* Section 5: İletişim */}
      <Section className="bg-white">
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
