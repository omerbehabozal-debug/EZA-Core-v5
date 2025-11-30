import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import FadeIn from "@/app/components/FadeIn";
import Icon from "@/app/components/Icon";
import Link from "next/link";

export const metadata = generatePageMetadata(
  "EZA-Core Entegrasyon Kılavuzları",
  "EZA-Core entegrasyon rehberleri. REST API, Python SDK, JavaScript SDK, webhook entegrasyonu ve best practices."
);

const quickStartSteps = [
  {
    step: 1,
    title: "API Key Oluştur",
    description: "Developer Console'dan API key'inizi oluşturun",
    icon: "Key",
  },
  {
    step: 2,
    title: "İlk İsteği Gönder",
    description: "Standalone endpoint'ine test isteği gönderin",
    icon: "Send",
  },
  {
    step: 3,
    title: "Response'u İncele",
    description: "Dönen etik analiz sonuçlarını kontrol edin",
    icon: "CheckCircle",
  },
];

const integrationMethods = [
  {
    title: "REST API",
    description: "HTTP istekleri ile direkt entegrasyon. Tüm diller ve framework'ler için uyumlu.",
    icon: "Globe",
    features: ["HTTP/HTTPS", "JSON format", "Tüm endpoint'ler", "Webhook desteği"],
    codeExample: `curl -X POST https://api.ezacore.ai/api/v1/standalone/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "Your text here"}'`,
  },
  {
    title: "Python SDK",
    description: "Resmi Python SDK ile hızlı entegrasyon. Async/await desteği ile performanslı.",
    icon: "Code",
    features: ["pip install ezacore", "Async/await", "Type hints", "Error handling"],
    codeExample: `from ezacore import EZACore

client = EZACore(api_key="YOUR_API_KEY")
result = await client.standalone.analyze("Your text here")
print(result.score)`,
  },
  {
    title: "JavaScript/TypeScript SDK",
    description: "Node.js ve browser için TypeScript desteği ile modern entegrasyon.",
    icon: "FileCode",
    features: ["npm install @ezacore/sdk", "TypeScript", "Browser/Node.js", "Promise-based"],
    codeExample: `import { EZACore } from '@ezacore/sdk';

const client = new EZACore({ apiKey: 'YOUR_API_KEY' });
const result = await client.standalone.analyze('Your text here');
console.log(result.score);`,
  },
];

const webhookGuide = {
  title: "Webhook Entegrasyonu",
  description: "Gerçek zamanlı olay bildirimleri için webhook endpoint'inizi yapılandırın.",
  steps: [
    {
      title: "Endpoint Oluştur",
      description: "Webhook'ları alacak HTTPS endpoint'inizi hazırlayın",
    },
    {
      title: "Developer Console'da Kaydet",
      description: "Webhook URL'inizi Developer Console'da kaydedin",
    },
    {
      title: "İmza Doğrulama",
      description: "X-EZA-Signature header'ını kullanarak imzayı doğrulayın",
    },
    {
      title: "Event Handling",
      description: "Gelen event'leri işleyin ve sisteminize entegre edin",
    },
  ],
};

const bestPractices = [
  {
    title: "Güvenlik",
    icon: "Shield",
    items: [
      "API key'lerinizi environment variable'larda saklayın",
      "HTTPS kullanın, asla HTTP üzerinden API key göndermeyin",
      "Webhook imzalarını mutlaka doğrulayın",
      "Rate limit'leri aşmamak için retry logic kullanın",
    ],
  },
  {
    title: "Performans",
    icon: "Zap",
    items: [
      "Async/await veya Promise kullanarak non-blocking istekler yapın",
      "Batch işlemler için toplu endpoint'leri kullanın",
      "Connection pooling kullanın",
      "Gereksiz isteklerden kaçının, cache mekanizmaları ekleyin",
    ],
  },
  {
    title: "Hata Yönetimi",
    icon: "AlertCircle",
    items: [
      "Tüm HTTP status kodlarını kontrol edin",
      "429 (Rate Limit) durumunda Retry-After header'ına göre bekleyin",
      "Exponential backoff ile retry mekanizması ekleyin",
      "Hataları loglayın ve monitoring sisteminize entegre edin",
    ],
  },
];

export default function IntegrationGuidePage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
            <Icon name="Plug" size={16} />
            Entegrasyon Kılavuzları
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-eza-dark mb-6">
            EZA-Core Entegrasyon Rehberi
          </h1>
          <p className="text-xl text-eza-text-secondary mb-4">
            REST API, Python SDK, JavaScript SDK ve webhook entegrasyonu için detaylı kılavuzlar.
          </p>
          <p className="text-base text-eza-text-secondary/80">
            5 dakikada entegrasyon yapın, production'a hızlıca geçin.
          </p>
        </div>
      </div>

      <Section className="bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Quick Start */}
          <FadeIn>
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-eza-text mb-6 flex items-center gap-3">
                <div className="h-1 w-12 bg-gradient-to-r from-eza-blue to-blue-400 rounded-full"></div>
                Hızlı Başlangıç
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {quickStartSteps.map((step, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-eza-blue/30 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-eza-blue/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-bold text-eza-blue">{step.step}</span>
                      </div>
                      <Icon name={step.icon} className="text-eza-blue" size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-eza-text mb-2">{step.title}</h3>
                    <p className="text-eza-text-secondary text-sm">{step.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <Icon name="Info" className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">API Key Gerekli</h4>
                    <p className="text-blue-800 text-sm">
                      Başlamak için{" "}
                      <Link href="/panels/developer" className="underline font-semibold">
                        Developer Console
                      </Link>
                      'dan API key oluşturun.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Integration Methods */}
          <FadeIn delay={100}>
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-eza-text mb-6 flex items-center gap-3">
                <div className="h-1 w-12 bg-gradient-to-r from-eza-blue to-blue-400 rounded-full"></div>
                Entegrasyon Yöntemleri
              </h2>
              <div className="space-y-8">
                {integrationMethods.map((method, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-14 h-14 rounded-xl bg-eza-blue/10 flex items-center justify-center flex-shrink-0">
                        <Icon name={method.icon} className="text-eza-blue" size={28} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-eza-text mb-2">{method.title}</h3>
                        <p className="text-eza-text-secondary">{method.description}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-eza-text mb-3">Özellikler</h4>
                        <ul className="space-y-2">
                          {method.features.map((feature, fIndex) => (
                            <li key={fIndex} className="flex items-center gap-2 text-sm text-eza-text-secondary">
                              <Icon name="Check" size={16} className="text-eza-blue flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-eza-text mb-3">Örnek Kod</h4>
                        <pre className="bg-eza-gray/50 rounded-lg p-4 text-xs font-mono text-eza-text overflow-x-auto">
                          <code>{method.codeExample}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Webhook Guide */}
          <FadeIn delay={200}>
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-eza-text mb-6 flex items-center gap-3">
                <div className="h-1 w-12 bg-gradient-to-r from-eza-blue to-blue-400 rounded-full"></div>
                {webhookGuide.title}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <p className="text-eza-text-secondary mb-8">{webhookGuide.description}</p>
                <div className="grid md:grid-cols-2 gap-6">
                  {webhookGuide.steps.map((step, index) => (
                    <div
                      key={index}
                      className="border-l-4 border-eza-blue/30 pl-6 py-4 bg-eza-gray/30 rounded-r-lg"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-eza-blue/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-eza-blue">{index + 1}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-eza-text">{step.title}</h3>
                      </div>
                      <p className="text-eza-text-secondary text-sm ml-11">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Best Practices */}
          <FadeIn delay={300}>
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-eza-text mb-6 flex items-center gap-3">
                <div className="h-1 w-12 bg-gradient-to-r from-eza-blue to-blue-400 rounded-full"></div>
                En İyi Uygulamalar
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {bestPractices.map((practice, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:border-eza-blue/30 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center flex-shrink-0">
                        <Icon name={practice.icon} className="text-eza-blue" size={24} />
                      </div>
                      <h3 className="text-xl font-semibold text-eza-text">{practice.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {practice.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2 text-sm text-eza-text-secondary">
                          <Icon name="Check" size={16} className="text-eza-blue flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Code Examples & Resources */}
          <FadeIn delay={400}>
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-eza-text mb-6 flex items-center gap-3">
                <div className="h-1 w-12 bg-gradient-to-r from-eza-blue to-blue-400 rounded-full"></div>
                Kod Örnekleri & Kaynaklar
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-eza-gray/30 rounded-xl p-6">
                    <h3 className="font-semibold text-eza-text mb-3 flex items-center gap-2">
                      <Icon name="Github" size={20} className="text-eza-text" />
                      GitHub Repository
                    </h3>
                    <p className="text-sm text-eza-text-secondary mb-4">
                      Hazır kod örnekleri, snippet'ler ve entegrasyon template'leri için GitHub repository'mizi ziyaret
                      edin.
                    </p>
                    <a
                      href="https://github.com/ezacore"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-eza-blue font-semibold hover:underline"
                    >
                      Repository'yi Görüntüle
                      <Icon name="ExternalLink" size={16} />
                    </a>
                  </div>
                  <div className="bg-eza-gray/30 rounded-xl p-6">
                    <h3 className="font-semibold text-eza-text mb-3 flex items-center gap-2">
                      <Icon name="BookOpen" size={20} className="text-eza-text" />
                      API Referansı
                    </h3>
                    <p className="text-sm text-eza-text-secondary mb-4">
                      Tüm endpoint'ler, parametreler ve response formatları için detaylı API dokümantasyonu.
                    </p>
                    <Link
                      href="/docs/api"
                      className="inline-flex items-center gap-2 text-eza-blue font-semibold hover:underline"
                    >
                      API Dokümantasyonu
                      <Icon name="ArrowRight" size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* CTA */}
          <FadeIn delay={500}>
            <div className="bg-gradient-to-r from-eza-blue to-blue-600 rounded-2xl p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Sorularınız mı var?</h2>
              <p className="text-xl mb-8 text-blue-100">
                Entegrasyon sürecinde yardıma mı ihtiyacınız var? İletişime geçin.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/contact"
                  className="bg-white text-eza-blue px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                >
                  İletişime Geç
                </Link>
                <Link
                  href="/panels/developer"
                  className="bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors border border-blue-500"
                >
                  Developer Console
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </Section>
    </>
  );
}

