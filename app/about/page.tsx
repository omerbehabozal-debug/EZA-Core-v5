import Section from "../components/Section";
import VisionSection from "../components/VisionSection";

export const metadata = {
  title: "Hakkımızda | EZA",
  description: "EZA hakkında bilgi edinin. Etik gözlem sistemi ve yapay zekâ çıktılarının analizi.",
};

export default function AboutPage() {
  return (
    <>
      <Section className="bg-white">
        <VisionSection 
          title="EZA Vizyonu"
          subtitle="Teknolojinin etik gelişimi için sistem"
        />
      </Section>
    </>
  );
}

