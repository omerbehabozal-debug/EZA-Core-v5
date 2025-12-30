import { generatePageMetadata } from "@/lib/seo";
import Section from "@/app/components/Section";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import FadeIn from "@/app/components/FadeIn";

export const metadata = generatePageMetadata(
  "Select Portal",
  "Kurumlar arası portal. Birden fazla kurumla çalışan holdingler için çok tenantlı yönlendirici portal."
);

export default function SelectPortalPage() {
  return (
    <>
      <div className="bg-gradient-to-br from-eza-gray via-white to-eza-gray py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
              <Icon name="LayoutGrid" size={16} />
              EZA Panels
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-eza-text mb-6">
              Select Portal
            </h1>
            <p className="text-xl text-eza-text-secondary">
              Kurumlar arası portal. Birden fazla kurumla çalışan holdingler için çok tenantlı yönlendirici portal.
            </p>
          </FadeIn>
        </div>
      </div>

      <Section className="bg-white">
        <FadeIn delay={100}>
          <div className="max-w-4xl mx-auto space-y-6 text-lg text-eza-text-secondary leading-relaxed">
          <p>
            Select Portal, birden fazla kurumla çalışan holdingler ve büyük organizasyonlar için 
            özel olarak tasarlanmış çok tenantlı (multi-tenant) bir yönlendirici portaldır. 
            Her kurum, kendi kategorisini seçerek kendi EZA paneline erişebilir.
          </p>
          <p>
            Portal, merkezi bir giriş noktası sağlar ve kullanıcıları kurumlarına özel panellere 
            yönlendirir. Her kurum, kendi etik standartlarını, raporlarını ve izleme sistemlerini 
            bağımsız olarak yönetebilir. Bu sayede holding yapıları, tüm kurumlarını tek bir 
            platform üzerinden yönetebilir.
          </p>
            <p>
            Select Portal, çok tenantlı mimarisi sayesinde her kurumun verilerini ve ayarlarını 
            birbirinden izole tutar. Güvenlik ve gizlilik standartlarını korurken, merkezi yönetim 
            imkanı sunar. Bu sayede büyük organizasyonlar, tüm kurumlarının etik standartlarını 
            tek bir yerden yönetebilir.
          </p>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={200}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-8">Portal Özellikleri</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Layers" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Çok Tenantlı Yapı</h3>
              </div>
                <p className="text-eza-text-secondary">
                Her kurum kendi kategorisini seçerek bağımsız paneline erişir. Veriler ve 
                ayarlar birbirinden izole tutulur.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Navigation" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Merkezi Yönlendirme</h3>
              </div>
                <p className="text-eza-text-secondary">
                Tek bir giriş noktasından tüm kurumlara erişim sağlar. Kullanıcılar kurumlarına 
                özel panellere otomatik yönlendirilir.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="Shield" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Güvenlik ve İzolasyon</h3>
              </div>
                <p className="text-eza-text-secondary">
                Her kurumun verileri ve ayarları birbirinden tamamen izole tutulur. Güvenlik 
                ve gizlilik standartları korunur.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                  <Icon name="BarChart3" className="text-eza-blue" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-eza-text">Merkezi Raporlama</h3>
              </div>
                <p className="text-eza-text-secondary">
                Holding seviyesinde toplu raporlama ve analiz imkanı sunar. Tüm kurumların 
                etik performansını tek bir yerden görüntüleyebilirsiniz.
              </p>
            </div>
          </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-white">
        <FadeIn delay={300}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-eza-text mb-6">Kurum Kategorileri</h2>
          <div className="space-y-6">
            <div className="border-l-4 border-eza-blue pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Corporate</h3>
                <p className="text-eza-text-secondary">
                Kurumsal yönetim panelleri. Organizasyon içi etik uyumluluk ve izleme.
              </p>
            </div>
            <div className="border-l-4 border-eza-green pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Regulator</h3>
                <p className="text-eza-text-secondary">
                Düzenleyici kurum panelleri. Sektör genelinde etik izleme ve raporlama.
              </p>
            </div>
            <div className="border-l-4 border-eza-gold pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Developer</h3>
                <p className="text-eza-text-secondary">
                Geliştirici konsolları. API yönetimi ve entegrasyon araçları.
              </p>
            </div>
            <div className="border-l-4 border-eza-text pl-6">
              <h3 className="text-xl font-semibold text-eza-text mb-2">Özel Kategoriler</h3>
                <p className="text-eza-text-secondary">
                Holding yapınıza özel kategoriler oluşturabilir ve her kurum için özelleştirilmiş 
                paneller yapılandırabilirsiniz.
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
                <strong>Holding Yönetimi:</strong> Birden fazla kurumu olan holdingler, tüm 
                kurumlarını tek bir portaldan yönetebilir
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Kurumsal Ayrım:</strong> Her kurum kendi kategorisini seçerek bağımsız 
                paneline erişir ve kendi etik standartlarını yönetir
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Merkezi Raporlama:</strong> Holding seviyesinde toplu raporlama ve 
                analiz yaparak tüm kurumların performansını izleyin
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-eza-green text-2xl mr-3">✓</span>
              <span>
                <strong>Ölçeklenebilirlik:</strong> Yeni kurumlar ekleyerek sisteminizi 
                büyütebilir ve her kurum için özelleştirilmiş paneller oluşturabilirsiniz
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
              Select Portal, EZA'nın temel felsefesini yansıtır: <strong className="text-eza-text">yasaklamaz, 
              ceza vermez; sadece daha iyi bir davranış önerir.</strong>
            </p>
              <p className="text-lg text-eza-text-secondary leading-relaxed">
                Portal, kurumların bağımsızlığını korurken merkezi yönetim imkanı sunar. Her kurum 
                kendi etik standartlarını yönetebilir, ancak holding seviyesinde toplu görünürlük 
                ve raporlama sağlanır. Bu sayede büyük organizasyonlar, tüm kurumlarının etik 
                standartlarını tek bir yerden yönetebilir.
              </p>
            </div>
          </div>
        </FadeIn>
      </Section>

      <Section className="bg-eza-gray">
        <FadeIn delay={600}>
          <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://select.ezacore.ai/proxy/select-portal"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-lg font-semibold hover:bg-[#0077ed] transition-all shadow-lg hover:shadow-xl"
            >
              Select Portal'a Git
              <Icon name="ExternalLink" size={18} />
            </a>
            <Link
              href="/#ecosystem"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border border-eza-blue rounded-lg font-semibold hover:bg-eza-blue/5 transition-all"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('homeScrollSection', 'ecosystem');
                }
              }}
            >
              EZA Ekosistemine Dön
            </Link>
          </div>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}

