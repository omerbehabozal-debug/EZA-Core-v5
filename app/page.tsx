import Hero from "./components/Hero";
import Section from "./components/Section";
import EcosystemMap from "./components/EcosystemMap";
import ProductCard from "./components/ProductCard";
import PanelCard from "./components/PanelCard";
import SectorCard from "./components/SectorCard";
import Manifesto from "./components/Manifesto";
import FAQ from "./components/FAQ";
import { products, panels, sectors } from "@/lib/constants";
import Icon from "./components/Icon";

export default function Home() {
  return (
    <>
      {/* Section 1: Hero */}
      <Hero />

      {/* Section 2: EZA Vizyonu */}
      <Section id="vision" className="bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
              <Icon name="Target" className="text-eza-blue" size={20} />
              <span className="text-sm font-semibold text-eza-blue">Vizyonumuz</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              EZA Vizyonu
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Teknolojinin etik gelişimi için rehberlik
            </p>
          </div>
          <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
            <p>
              Teknoloji hızla gelişiyor. Her gün yeni AI modelleri, yeni platformlar, 
              yeni sistemler ortaya çıkıyor. Ancak bu hızlı gelişimin yanında, 
              teknolojinin insanlığa karşı nasıl davranması gerektiği konusunda bir boşluk var.
            </p>
            <p>
              EZA, bu boşluğu doldurmak için kuruldu. EZA, teknolojinin hızlı gelişimine 
              karşı etik bir rehber olarak çalışır. Teknolojinin insanlığa karşı etik 
              davranmasını sağlamak için yönlendirici bir felsefe sunar.
            </p>
            <p>
              EZA, kural koyucu değil, rehberdir. Yasaklamaz, ceza vermez; sadece daha iyi 
              bir davranış önerir. Teknoloji ile insan arasında etik bir köprü kurar ve 
              teknolojinin daha sorumlu bir şekilde kullanılmasını sağlar.
            </p>
          </div>
        </div>
      </Section>

      {/* Section 3: Ecosystem Map */}
      <Section id="ecosystem" className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <EcosystemMap />
        </div>
      </Section>

      {/* Section 4: Product Cards */}
      <Section id="products" className="bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
              <Icon name="Package" className="text-eza-blue" size={20} />
              <span className="text-sm font-semibold text-eza-blue">Ürünlerimiz</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              EZA Ürünleri
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Etik teknoloji için kapsamlı çözümler
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <ProductCard key={product.title} {...product} />
            ))}
          </div>
        </div>
      </Section>

      {/* Section 5: Panel Cards */}
      <Section id="panels" className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
              <Icon name="LayoutDashboard" className="text-eza-blue" size={20} />
              <span className="text-sm font-semibold text-eza-blue">Paneller</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              EZA Panelleri
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Özel yönetim panelleri ve konsollar
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {panels.map((panel) => (
              <PanelCard key={panel.title} {...panel} />
            ))}
          </div>
        </div>
      </Section>

      {/* Section 6: Sector Solutions */}
      <Section id="solutions" className="bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
              <Icon name="Briefcase" className="text-eza-blue" size={20} />
              <span className="text-sm font-semibold text-eza-blue">Sektörler</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              Sektör Çözümleri
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Her sektör için özelleştirilmiş etik çözümler
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <SectorCard key={sector.title} {...sector} />
            ))}
          </div>
        </div>
      </Section>

      {/* Section 7: Kurucu Manifestosu */}
      <Section id="manifesto" className="bg-eza-gray">
        <Manifesto />
      </Section>

      {/* Section 8: FAQ */}
      <Section id="faq" className="bg-white">
        <FAQ />
      </Section>
    </>
  );
}
