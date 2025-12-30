"use client";

import Icon from "./Icon";
import HeroVisual from "./HeroVisual";

interface HeroProps {
  videoSrc?: string; // Video dosya yolu (örn: "/videos/hero-video.mp4") veya URL
  videoType?: string; // Video formatı (örn: "video/mp4")
  showVideo?: boolean; // Video gösterilsin mi?
}

export default function Hero({ 
  videoSrc = "/videos/hero-video.mp4", 
  videoType = "video/mp4",
  showVideo = false 
}: HeroProps) {
  const handleScrollToEcosystem = () => {
    const element = document.querySelector("#ecosystem");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative bg-white min-h-screen flex items-center overflow-hidden">
      {/* Premium background visual */}
      <HeroVisual videoSrc={videoSrc} videoType={videoType} showVideo={showVideo} />
      
      {/* Content layer */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-24 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <div className="hero-badge mb-4">
            <span className="inline-block px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-medium rounded-full border border-eza-blue/20">
              Etik Zeka Altyapısı
            </span>
          </div>
          <h1 className="hero-title text-5xl md:text-6xl lg:text-7xl font-semibold text-eza-text mb-6 leading-tight">
            Yapay zekâ çıktılarının etik etkisini ölçen bağımsız gözlem altyapısı.
          </h1>
          
          <p className="hero-description text-xl md:text-2xl text-eza-text-secondary mb-12 leading-relaxed max-w-2xl mx-auto">
            EZA, yapay zekâ çıktılarının etik, toplumsal ve regülasyonel etkisini sansürlemeden analiz eder.
            <br />
            Otomatik veya zorunlu müdahale etmez; ölçer, açıklar ve görünür kılar.
          </p>
          
          <div className="hero-buttons flex justify-center items-center">
            <button
              onClick={handleScrollToEcosystem}
              className="inline-flex items-center gap-2 px-8 py-3 bg-eza-blue text-white rounded-lg text-base font-medium hover:bg-[#0077ed] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
            >
              Ekosistemi Keşfet
              <Icon name="ArrowDown" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
