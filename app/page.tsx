import Hero from "./components/Hero";
import Section from "./components/Section";
import TabbedEcosystem from "./components/TabbedEcosystem";
import SectorGrid from "./components/SectorGrid";
import VisionSection from "./components/VisionSection";
import WhyEZA from "./components/WhyEZA";
import Manifesto from "./components/Manifesto";
import FAQ from "./components/FAQ";

export default function Home() {
  return (
    <>
      {/* Section 1: Hero */}
      <Hero />

      {/* Section 2: EZA Vizyonu */}
      <Section id="vision" className="bg-white">
        <VisionSection />
      </Section>

      {/* Section 2.5: Neden EZA? */}
      <Section id="why-eza" className="bg-eza-gray">
        <WhyEZA />
      </Section>

      {/* Section 3: Ecosystem - Tabbed (Products, Panels, Modules dahil) */}
      <Section id="ecosystem" className="bg-white">
        <div className="max-w-7xl mx-auto">
          <TabbedEcosystem />
        </div>
      </Section>

      {/* Section 4: Sector Solutions - Compact Grid */}
      <Section id="solutions" className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <SectorGrid />
        </div>
      </Section>

      {/* Section 5: Kurucu Manifestosu */}
      <Section id="manifesto" className="bg-white">
        <Manifesto />
      </Section>

      {/* Section 6: FAQ */}
      <Section id="faq" className="bg-eza-gray">
        <FAQ />
      </Section>
    </>
  );
}
