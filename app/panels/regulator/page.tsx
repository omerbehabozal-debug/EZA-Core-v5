import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Regulator Oversight Panel",
  "Küresel ölçekte yapay zekâ sistemleri için içeriksiz, müdahalesiz ve denetlenebilir etik gözetim arayüzü."
);

export default function RegulatorPanelPage() {
  return (
    <>
      {/* 1️⃣ HERO SECTION */}
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="Building2" size={16} />
              EZA Panels
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Regulator Oversight Panel
            </h1>
            <p className="text-xl text-eza-text-secondary mb-4">
              Küresel ölçekte yapay zekâ sistemleri için içeriksiz, müdahalesiz ve denetlenebilir etik gözetim arayüzü.
            </p>
            <p className="text-lg text-eza-text-secondary/80 max-w-2xl mx-auto">
              EZA Regulator Panel, düzenleyici kurumların yapay zekâ sistemlerinin davranışlarını, risk desenlerini ve etik değerlendirme süreçlerini içerik görmeden gözlemleyebilmesini sağlar.
            </p>
            <p className="text-base text-eza-text-secondary/70 max-w-2xl mx-auto mt-4">
              Bu panel, editoryal karar vermez, içeriğe müdahale etmez ve sansür aracı değildir.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* 2️⃣ BU PANEL NEDİR? */}
      <Section className="bg-white">
        <FadeIn>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Bu Panel Nedir?
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                EZA Regulator Panel, düzenleyici kurumlar ve bağımsız gözetim yapıları için tasarlanmış audit-grade bir gözlem arayüzüdür.
              </p>
              <p>
                Panel, yapay zekâ sistemlerinin:
              </p>
              <ul className="space-y-3 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Hangi etik politika setleriyle çalıştığını</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Risk değerlendirmelerinin nasıl üretildiğini</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Sistematik risk yoğunluklarının oluşup oluşmadığını</span>
                </li>
              </ul>
              <p className="mt-4">
                içerik seviyesine inmeden görünür kılar.
              </p>
              <p>
                Bu yaklaşım sayesinde regülatörler:
              </p>
              <ul className="space-y-3 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Sistem davranışlarını izler</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Süreç bütünlüğünü denetler</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Şeffaflık ve hesap verebilirlik kazanır</span>
                </li>
              </ul>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 3️⃣ BU PANEL NE DEĞİLDİR? */}
      <Section className="bg-eza-gray">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Bu Panel Ne Değildir?
            </h2>
            <ul className="space-y-4 text-lg text-eza-text-secondary">
              <li className="flex items-start">
                <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={20} />
                <span>İçerik denetim aracı değildir</span>
              </li>
              <li className="flex items-start">
                <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={20} />
                <span>Sansür veya engelleme mekanizması değildir</span>
              </li>
              <li className="flex items-start">
                <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={20} />
                <span>Editoryal karar vermez</span>
              </li>
              <li className="flex items-start">
                <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={20} />
                <span>Kullanıcı davranışına müdahale etmez</span>
              </li>
              <li className="flex items-start">
                <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={20} />
                <span>Hukuki yaptırım veya enforcement sistemi değildir</span>
              </li>
            </ul>
            <div className="mt-8 p-6 bg-white rounded-xl border border-eza-blue/20">
              <p className="text-lg font-semibold text-eza-text">
                Regülatör paneli, yapay zekâ çıktılarının kendisini değil, bu çıktıları değerlendiren sistemin davranışını izler.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 4️⃣ KİMLER İÇİN TASARLANDI? */}
      <Section className="bg-white">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Kimler İçin Tasarlandı?
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                Regulator Oversight Panel, farklı ülkelerde ve sektörlerde görev yapan düzenleyici ve gözetim kurumları için tek bir standart arayüz sunar.
              </p>
              <div>
                <h3 className="text-xl font-semibold text-eza-text mb-4">Örnek kullanıcı grupları:</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start">
                    <Icon name="Tv" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Medya ve yayıncılık düzenleyicileri</span>
                  </div>
                  <div className="flex items-start">
                    <Icon name="Shield" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Veri koruma ve gizlilik otoriteleri</span>
                  </div>
                  <div className="flex items-start">
                    <Icon name="TrendingUp" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Finansal piyasa düzenleyicileri</span>
                  </div>
                  <div className="flex items-start">
                    <Icon name="Heart" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Sağlık ve klinik teknoloji denetim birimleri</span>
                  </div>
                  <div className="flex items-start">
                    <Icon name="BookOpen" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Akademik ve bağımsız etik kurullar</span>
                  </div>
                  <div className="flex items-start">
                    <Icon name="Globe" className="text-eza-blue mr-3 mt-1 flex-shrink-0" size={20} />
                    <span>Uluslararası gözlemci kuruluşlar</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-base text-eza-text-secondary/80">
                Panelin mimarisi ülkeye veya kuruma özel değildir. Aynı yapı, farklı regülasyon çerçevelerinde kullanılabilir.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 5️⃣ NASIL ÇALIŞIR? */}
      <Section className="bg-eza-gray">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Nasıl Çalışır?
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-eza-blue font-bold mr-4 text-xl">1.</span>
                  <span>Yapay zekâ sistemleri EZA etik altyapısı üzerinden değerlendirilir</span>
                </div>
                <div className="flex items-start">
                  <span className="text-eza-blue font-bold mr-4 text-xl">2.</span>
                  <span>Tüm değerlendirmeler audit log'lara kaydedilir</span>
                </div>
                <div className="flex items-start">
                  <span className="text-eza-blue font-bold mr-4 text-xl">3.</span>
                  <span>Regulator Panel bu kayıtları salt okunur şekilde sunar</span>
                </div>
              </div>
              <p>
                Veriler:
              </p>
              <ul className="space-y-2 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Toplulaştırılmış</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Maskelenmiş</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>İçerikten arındırılmıştır</span>
                </li>
              </ul>
              <div className="mt-6 p-6 bg-white rounded-xl border border-eza-blue/20">
                <p className="font-semibold text-eza-text mb-3">Regülatörler:</p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={18} />
                    <span>İçeriği görmez</span>
                  </li>
                  <li className="flex items-start">
                    <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={18} />
                    <span>Analiz tetiklemez</span>
                  </li>
                  <li className="flex items-start">
                    <Icon name="X" className="text-red-500 mr-3 mt-1 flex-shrink-0" size={18} />
                    <span>Sisteme müdahale etmez</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 6️⃣ GLOBAL GOVERNANCE ALIGNMENT */}
      <Section className="bg-white">
        <FadeIn delay={400}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Küresel Yönetişim Çerçevesi ile Uyum
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                EZA Regulator Panel, uluslararası kabul görmüş yapay zekâ yönetişim prensipleri ile uyumlu olacak şekilde tasarlanmıştır.
              </p>
              <p>
                Panel, aşağıdaki çerçevelerin öngördüğü:
              </p>
              <ul className="space-y-2 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Şeffaflık</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>İnsan gözetimi</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Denetlenebilirlik</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Müdahalesiz izleme</span>
                </li>
              </ul>
              <p className="mt-4">
                ilkelerini destekler.
              </p>
              <div className="mt-8 space-y-4">
                <div className="p-6 bg-eza-gray rounded-xl border border-eza-blue/10">
                  <h3 className="font-semibold text-eza-text mb-2">EU AI Act</h3>
                  <p className="text-base text-eza-text-secondary">
                    Risk bazlı yönetişim, kayıt tutma ve insan gözetimi yaklaşımı
                  </p>
                </div>
                <div className="p-6 bg-eza-gray rounded-xl border border-eza-blue/10">
                  <h3 className="font-semibold text-eza-text mb-2">OECD AI Principles</h3>
                  <p className="text-base text-eza-text-secondary">
                    Şeffaflık, hesap verebilirlik ve sistem dayanıklılığı
                  </p>
                </div>
                <div className="p-6 bg-eza-gray rounded-xl border border-eza-blue/10">
                  <h3 className="font-semibold text-eza-text mb-2">UNESCO AI Ethics Recommendation</h3>
                  <p className="text-base text-eza-text-secondary">
                    İnsan merkezli, müdahalesiz ve etik izleme yaklaşımı
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm text-eza-text-secondary/70 italic">
                Bu panel, hukuki yorum veya sertifikasyon sağlamaz. Regülasyonlara uyum değerlendirmesi ilgili kurumların yetkisindedir.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 7️⃣ NEDEN İÇERİK GÖSTERMEZ? */}
      <Section className="bg-eza-gray">
        <FadeIn delay={500}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Neden İçerik Göstermez?
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                İçerik gösterimi, regülatörleri:
              </p>
              <ul className="space-y-3 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Editoryal sorumluluğa</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Hukuki risklere</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Müdahale baskısına</span>
                </li>
              </ul>
              <p className="mt-4">
                maruz bırakabilir.
              </p>
              <p>
                EZA Regulator Panel, bu riskleri bilinçli olarak dışarıda bırakır ve regülatörleri yalnızca sistem davranışını gözlemleyen taraf olarak konumlandırır.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 8️⃣ GÜVENLİK VE ERİŞİM MODELİ */}
      <Section className="bg-white">
        <FadeIn delay={600}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-semibold text-eza-text mb-6">
              Güvenli ve Bağımsız Erişim
            </h2>
            <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
              <p>
                Regulator Panel:
              </p>
              <ul className="space-y-3 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Ayrı bir arayüzdür</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Ayrı bir erişim modeline sahiptir</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Sadece yetkilendirilmiş Regulator Account'lar tarafından kullanılır</span>
                </li>
              </ul>
              <p className="mt-4">
                Bu hesaplar:
              </p>
              <ul className="space-y-3 ml-6">
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Platform kullanıcılarından bağımsızdır</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Organizasyon veya müşteri yönetmez</span>
                </li>
                <li className="flex items-start">
                  <span className="text-eza-blue mr-3">•</span>
                  <span>Salt okunur erişime sahiptir</span>
                </li>
              </ul>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* 9️⃣ KAPANIŞ CÜMLESİ */}
      <Section className="bg-gradient-to-br from-eza-blue/5 via-white to-purple-500/5">
        <FadeIn delay={700}>
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-semibold text-eza-text leading-relaxed">
              EZA Regulator Panel,<br />
              yapay zekâ sistemleri için küresel ölçekte şeffaflık sağlayan,<br />
              müdahale etmeyen ve<br />
              etik yönetişimi mümkün kılan bir gözlem arayüzüdür.
            </p>
          </div>
        </FadeIn>
      </Section>

      {/* 🔟 OPSİYONEL CTA */}
      <Section className="bg-white">
        <FadeIn delay={800}>
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <p className="text-lg text-eza-text-secondary">
              Daha fazla bilgi için bizimle iletişime geçin
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
              >
                İletişime Geç
                <Icon name="Mail" size={18} />
              </Link>
              <Link
                href="/documentation"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              >
                Teknik Dokümantasyon
                <Icon name="FileText" size={18} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
