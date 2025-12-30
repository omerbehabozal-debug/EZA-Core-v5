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
    title: "API Dokümantasyonu",
    icon: "Code",
    description: "Detaylı API referansları, authentication, rate limits ve webhook dokümantasyonu",
    href: "/docs/api",
    external: false,
  },
  {
    title: "Entegrasyon Kılavuzları",
    icon: "Plug",
    description: "REST API, Python SDK, JavaScript SDK ve webhook entegrasyon rehberleri",
    href: "/docs/integration",
    external: false,
  },
  {
    title: "Test & Safety Benchmarks",
    icon: "CheckCircle",
    description: "EZA test sonuçları, regülasyon uyumluluğu matrisi ve güvenlik metrikleri",
    href: "/docs/test-suite",
    external: false,
  },
];

export default function DocumentationPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-slate-200 via-blue-100/80 to-slate-100 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
            <Icon name="BookOpen" size={16} />
            Dokümantasyon
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            EZA Dokümantasyonu
          </h1>
          <p className="text-xl text-eza-text-secondary mb-4">
            EZA-Core için teknik dokümantasyon. API referansları, entegrasyon kılavuzları ve geliştirici araçları.
          </p>
          <p className="text-base text-eza-text-secondary/80">
            Geliştiriciler için detaylı teknik rehberler ve referanslar.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {documentationSections.map((section, sectionIndex) => {
              const LinkComponent = section.external ? "a" : Link;
              const linkProps = section.external
                ? {
                    href: section.href,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  }
                : { href: section.href };

              return (
                <FadeIn key={section.title} delay={sectionIndex * 100}>
                  <LinkComponent
                    {...linkProps}
                    className="block group"
                  >
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:border-eza-blue/30 hover:shadow-xl transition-all duration-300 h-full">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-eza-blue/10 flex items-center justify-center group-hover:bg-eza-blue/20 transition-colors flex-shrink-0">
                          <Icon name={section.icon} className="text-eza-blue" size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-xl font-bold text-eza-text group-hover:text-eza-blue transition-colors">
                              {section.title}
                            </h2>
                            {section.external && (
                              <Icon
                                name="ExternalLink"
                                size={18}
                                className="text-eza-text-secondary group-hover:text-eza-blue transition-colors flex-shrink-0"
                              />
                            )}
                          </div>
                          <p className="text-sm text-eza-text-secondary leading-relaxed">
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </LinkComponent>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </Section>

    </>
  );
}

