import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Documentation",
  "EZA ve EZA-Core için kapsamlı dokümantasyon. API referansları, entegrasyon kılavuzları ve kullanım örnekleri."
);

const documentationSections = [
  {
    title: "Başlangıç",
    icon: "Rocket",
    items: [
      {
        title: "EZA'ya Giriş",
        description: "EZA nedir, nasıl çalışır ve neden önemlidir?",
        href: "/#vision",
      },
      {
        title: "EZA-Core Platform",
        description: "EZA-Core'un temel özellikleri ve mimarisi",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Hızlı Başlangıç",
        description: "İlk adımlar ve temel kurulum",
        href: "https://ezacore.ai",
        external: true,
      },
    ],
  },
  {
    title: "Ürünler",
    icon: "Package",
    items: [
      {
        title: "Standalone",
        description: "Bağımsız etik değerlendirme platformu",
        href: "/products/standalone",
      },
      {
        title: "Proxy",
        description: "API proxy katmanı ve entegrasyon",
        href: "/products/proxy",
      },
      {
        title: "Proxy-Lite",
        description: "Hafif versiyon proxy çözümü",
        href: "/products/proxy-lite",
      },
      {
        title: "EZA Score Engine",
        description: "Skorlama motoru ve metrikler",
        href: "/products/score-engine",
      },
      {
        title: "Advisor",
        description: "AI destekli danışman modülü",
        href: "/products/advisor",
      },
    ],
  },
  {
    title: "API Dokümantasyonu",
    icon: "Code",
    items: [
      {
        title: "API Referansı",
        description: "Tüm API endpoint'leri ve parametreler",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Authentication",
        description: "API kimlik doğrulama ve güvenlik",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Rate Limits",
        description: "API kullanım limitleri ve kotalar",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Webhooks",
        description: "Olay bildirimleri ve webhook entegrasyonu",
        href: "https://ezacore.ai",
        external: true,
      },
    ],
  },
  {
    title: "Entegrasyon",
    icon: "Plug",
    items: [
      {
        title: "REST API",
        description: "REST API ile entegrasyon kılavuzu",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "SDK'lar",
        description: "Python, JavaScript ve diğer SDK'lar",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Webhook Entegrasyonu",
        description: "Webhook'lar ile gerçek zamanlı bildirimler",
        href: "https://ezacore.ai",
        external: true,
      },
      {
        title: "Örnek Projeler",
        description: "Hazır entegrasyon örnekleri ve kodlar",
        href: "https://ezacore.ai",
        external: true,
      },
    ],
  },
  {
    title: "Modüller",
    icon: "Shield",
    items: [
      {
        title: "LLM Safety",
        description: "Büyük dil modelleri için etik güvenlik",
        href: "/modules/llm-safety",
      },
      {
        title: "Children Safety",
        description: "Çocuk güvenliği odaklı etik modül",
        href: "/modules/children-safety",
      },
      {
        title: "Social & Communication Ethics",
        description: "Sosyal platformlar için etik standartlar",
        href: "/modules/social-communication-ethics",
      },
      {
        title: "Media Safety",
        description: "Medya içeriği için etik kontrol",
        href: "/solutions/media",
      },
      {
        title: "Autonomous Safety",
        description: "Otonom sistemler için etik yönlendirme",
        href: "/solutions/autonomous",
      },
    ],
  },
  {
    title: "Paneller",
    icon: "LayoutDashboard",
    items: [
      {
        title: "Developer Console",
        description: "Geliştiriciler için API yönetim konsolu",
        href: "/panels/developer",
      },
      {
        title: "Corporate Panel",
        description: "Kurumsal yönetim paneli",
        href: "/panels/corporate",
      },
      {
        title: "Regulator Panel",
        description: "Düzenleyici kurumlar için özel panel",
        href: "/panels/regulator",
      },
    ],
  },
];

export default function DocumentationPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
            <Icon name="BookOpen" size={16} />
            Dokümantasyon
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            EZA Dokümantasyonu
          </h1>
          <p className="text-xl text-gray-700 mb-4">
            EZA ve EZA-Core için kapsamlı dokümantasyon. API referansları, entegrasyon kılavuzları ve kullanım örnekleri.
          </p>
          <p className="text-base text-gray-600">
            Detaylı teknik dokümantasyon için EZA-Core Platform'u ziyaret edin.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentationSections.map((section, sectionIndex) => (
              <FadeIn key={section.title} delay={sectionIndex * 50}>
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-eza-blue/30 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={section.icon} className="text-eza-blue" size={20} />
                    </div>
                    <h2 className="text-xl font-semibold text-eza-text">
                      {section.title}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {section.items.map((item) => {
                      const LinkComponent = item.external ? "a" : Link;
                      const linkProps = item.external
                        ? {
                            href: item.href,
                            target: "_blank",
                            rel: "noopener noreferrer",
                          }
                        : { href: item.href };

                      return (
                        <LinkComponent
                          key={item.title}
                          {...linkProps}
                          className="block group"
                        >
                          <div className="p-3 rounded-lg hover:bg-eza-gray/50 transition-colors">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-eza-text group-hover:text-eza-blue transition-colors">
                                {item.title}
                              </h3>
                              {item.external && (
                                <Icon
                                  name="ExternalLink"
                                  size={14}
                                  className="text-eza-text-secondary flex-shrink-0 mt-0.5"
                                />
                              )}
                            </div>
                            <p className="text-xs text-eza-text-secondary leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </LinkComponent>
                      );
                    })}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-8 text-center">
            Hızlı Erişim
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="https://ezacore.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-eza-blue hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center group-hover:bg-eza-blue/20 transition-colors">
                  <Icon name="ExternalLink" className="text-eza-blue" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-eza-text mb-1">
                    EZA-Core Platform
                  </h3>
                  <p className="text-sm text-eza-text-secondary">
                    Detaylı teknik dokümantasyon ve API referansları
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/panels/developer"
              className="bg-white rounded-xl p-6 border border-gray-200 hover:border-eza-blue hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center group-hover:bg-eza-blue/20 transition-colors">
                  <Icon name="Code" className="text-eza-blue" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-eza-text mb-1">
                    Developer Console
                  </h3>
                  <p className="text-sm text-eza-text-secondary">
                    API yönetim konsolu ve test araçları
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-eza-dark mb-6">Sık Sorulan Sorular</h2>
          <div className="space-y-4">
            <div className="bg-eza-gray/50 rounded-lg p-5 border border-gray-200">
              <h3 className="text-lg font-semibold text-eza-text mb-2">
                API anahtarı nasıl alınır?
              </h3>
              <p className="text-gray-700">
                EZA-Core Platform'u ziyaret ederek hesap oluşturabilir ve API anahtarınızı 
                Developer Console'dan alabilirsiniz.
              </p>
            </div>
            <div className="bg-eza-gray/50 rounded-lg p-5 border border-gray-200">
              <h3 className="text-lg font-semibold text-eza-text mb-2">
                Hangi programlama dilleri destekleniyor?
              </h3>
              <p className="text-gray-700">
                EZA-Core REST API kullanarak herhangi bir programlama dilinden erişilebilir. 
                Python, JavaScript, Go ve diğer diller için SDK'lar mevcuttur.
              </p>
            </div>
            <div className="bg-eza-gray/50 rounded-lg p-5 border border-gray-200">
              <h3 className="text-lg font-semibold text-eza-text mb-2">
                Ücretsiz kullanım limiti var mı?
              </h3>
              <p className="text-gray-700">
                EZA-Core Platform'da ücretsiz deneme sürümü mevcuttur. Detaylı bilgi için 
                platformu ziyaret edin.
              </p>
            </div>
            <div className="bg-eza-gray/50 rounded-lg p-5 border border-gray-200">
              <h3 className="text-lg font-semibold text-eza-text mb-2">
                Entegrasyon desteği alabilir miyim?
              </h3>
              <p className="text-gray-700">
                Evet, entegrasyon desteği için EZA-Core Platform üzerinden bizimle iletişime 
                geçebilirsiniz. Ayrıca dokümantasyonda hazır örnekler ve kod parçacıkları bulunmaktadır.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="bg-eza-gray">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-eza-blue/5 to-white rounded-2xl p-8 border border-eza-blue/10">
            <h3 className="text-2xl font-semibold text-eza-text mb-4">
              Daha Fazla Yardıma mı İhtiyacınız Var?
            </h3>
            <p className="text-gray-700 mb-6">
              Detaylı teknik dokümantasyon, API referansları ve örnek kodlar için EZA-Core Platform'u ziyaret edin.
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
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              >
                İletişime Geç
                <Icon name="Mail" size={18} />
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

