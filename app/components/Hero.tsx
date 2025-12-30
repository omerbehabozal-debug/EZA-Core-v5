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
  return (
    <div className="relative bg-white min-h-screen flex items-center overflow-hidden">
      {/* Premium background visual */}
      <HeroVisual videoSrc={videoSrc} videoType={videoType} showVideo={showVideo} />
      
      {/* Content layer */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-24 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="hero-title text-5xl md:text-6xl lg:text-7xl font-semibold text-eza-text mb-6 leading-tight">
            Yapay zekâ çıktıları için
            <br />
            etik gözlem katmanı
          </h1>
          
          <p className="hero-description text-xl md:text-2xl text-eza-text-secondary mb-12 leading-relaxed max-w-2xl mx-auto">
            EZA, yapay zekâ çıktılarının
            <br />
            etik, toplumsal ve regülasyonel etkilerini
            <br />
            müdahale etmeden görünür kılan
            <br />
            bağımsız bir gözlem altyapısıdır.
          </p>
          
          <div className="hero-buttons flex justify-center items-center">
            <div className="inline-flex items-center gap-2 px-8 py-3 bg-eza-blue text-white rounded-lg text-base font-medium shadow-sm">
              Keşfet
              <div className="animate-bounce-arrow inline-block">
                <Icon name="ArrowDown" size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
