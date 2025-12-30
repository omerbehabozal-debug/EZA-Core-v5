import Section from "../components/Section";
import FadeIn from "../components/FadeIn";

export const metadata = {
  title: "Gizlilik Politikası | EZA",
  description: "EZA gizlilik politikası. Veri kullanımı, analiz ve anonimleştirme hakkında bilgiler.",
};

export default function PrivacyPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Gizlilik Politikası
            </h1>
            <p className="text-xl text-eza-text-secondary">
              EZA veri kullanımı ve gizlilik prensipleri
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
            <div>
              <h2 className="text-2xl font-semibold text-eza-text mb-4">
                EZA'nın Temel Prensipleri
              </h2>
              <p>
                EZA, yapay zekâ çıktılarının etik etkilerini ölçen ve görünür kılan bir etik gözlem 
                altyapısıdır. EZA'nın temel prensipleri şunlardır:
              </p>
            </div>

            <div className="bg-eza-gray rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-2">
                  EZA İçerik Üretmez
                </h3>
                <p>
                  EZA, yapay zekâ sistemlerinin ürettiği çıktıları analiz eder. Kendi başına içerik 
                  üretmez veya içeriği değiştirmez.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-2">
                  EZA İçeriğe Otomatik Müdahale Etmez
                </h3>
                <p>
                  EZA, analiz ettiği içeriğe otomatik veya zorunlu müdahale etmez. İçeriği otomatik olarak 
                  engellemez, sansürlemez veya değiştirmez. Sadece etik etkilerini ölçer ve görünür kılar. 
                  Ancak kullanıcı açıkça talep ettiğinde, etik iyileştirme önerileri sunabilir.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-2">
                  Veriler Sadece Analiz Amaçlı Kullanılır
                </h3>
                <p>
                  EZA tarafından analiz edilen veriler, sadece etik skorlama ve risk değerlendirme 
                  amaçlı kullanılır. Veriler, analiz dışında başka bir amaç için kullanılmaz.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-2">
                  Model Eğitimi Yapılmaz
                </h3>
                <p>
                  EZA, analiz ettiği verileri kullanarak model eğitimi yapmaz. Veriler, sadece 
                  anlık analiz ve skorlama için kullanılır.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-2">
                  Regülatör Panellerinde Veriler Anonimleştirilir
                </h3>
                <p>
                  Regülatör panellerinde görüntülenen veriler, anonimleştirilmiş formatta sunulur. 
                  Kişisel veya kurumsal bilgiler, gizlilik prensipleri gereği korunur.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-eza-text mb-4">
                Veri Güvenliği
              </h2>
              <p>
                EZA, veri güvenliğine önem verir. Analiz edilen veriler, güvenli bir şekilde 
                işlenir ve saklanır. Veri güvenliği, EZA'nın temel önceliklerinden biridir.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-eza-text mb-4">
                İletişim
              </h2>
              <p>
                Gizlilik politikası hakkında sorularınız için lütfen bizimle iletişime geçin.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

