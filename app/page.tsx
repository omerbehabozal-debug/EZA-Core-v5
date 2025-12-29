import Hero from "./components/Hero";
import Section from "./components/Section";
import TabbedEcosystem from "./components/TabbedEcosystem";
import SectorGrid from "./components/SectorGrid";
import VisionSection from "./components/VisionSection";
import WhyEZA from "./components/WhyEZA";
import Manifesto from "./components/Manifesto";
import FAQ from "./components/FAQ";
import EZACoreIntro from "./components/EZACoreIntro";
import DemoShowcase from "./components/DemoShowcase";

export default function Home() {
  return (
    <>
      {/* Section 1: Hero - EZA Felsefesi ve İlk İzlenim */}
      <Hero 
        showVideo={true}
        videoSrc="/videos/ce313605-5baa-49e2-b91f-951898ff530e_watermark.mp4"
        videoType="video/mp4"
      />

      {/* Section 2: EZA Nedir? */}
      <Section id="about" className="bg-white">
        <VisionSection />
      </Section>

      {/* Section 3: Neden EZA? - Sorun ve Çözüm */}
      <Section id="why-eza" className="bg-eza-gray">
        <WhyEZA />
      </Section>

      {/* Section 4: EZA-Core - Teknolojik Motor (Vision ve WhyEZA'dan sonra mantıklı) */}
      <Section className="bg-white">
        <EZACoreIntro />
      </Section>

      {/* Section 4.5: Premium Demo Videos - EZA-Core'un Nasıl Çalıştığını Göster */}
      <Section className="bg-eza-gray">
        <DemoShowcase />
      </Section>

      {/* Section 5: Ecosystem - Nasıl Çalışıyor, Detaylar */}
      <Section id="ecosystem" className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <TabbedEcosystem />
        </div>
      </Section>

      {/* Section 6: Sector Solutions - Compact Grid */}
      <Section id="solutions" className="bg-white">
        <div className="max-w-7xl mx-auto">
          <SectorGrid />
        </div>
      </Section>

      {/* Section 7: Kurucu Manifestosu */}
      <Section id="manifesto" className="bg-white">
        <Manifesto />
      </Section>

      {/* Section 8: FAQ */}
      <Section id="faq" className="bg-eza-gray">
        <FAQ />
      </Section>
    </>
  );
}
