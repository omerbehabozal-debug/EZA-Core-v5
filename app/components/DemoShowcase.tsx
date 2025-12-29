"use client";

import { useState } from "react";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

const demos = [
  {
    id: "standalone",
    title: "Standalone Demo",
    description: "Kullanıcının EZA'ya soru sorup, etik olarak skorlandırılmış cevap aldığı demo",
    videoSrc: "/demos/standalone-demo.mp4", // Video eklendiğinde güncellenecek
    badge: "Standalone",
    icon: "Shield",
  },
  {
    id: "proxy",
    title: "Proxy Demo",
    description: "EZA'nın başka AI'ların cevaplarını etik açıdan değerlendirip iyileştirmesi",
    videoSrc: "/demos/proxy-demo.mp4", // Video eklendiğinde güncellenecek
    badge: "Proxy",
    icon: "Globe",
  },
  {
    id: "panel",
    title: "Panel Demo",
    description: "Regulator ve kurumsal paneller için etik analiz ve risk değerlendirme",
    videoSrc: "/demos/panel-demo.mp4", // Video eklendiğinde güncellenecek
    badge: "Panel",
    icon: "LayoutGrid",
  },
];

export default function DemoShowcase() {
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  return (
    <FadeIn>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-eza-blue/10 text-eza-blue text-sm font-semibold rounded-full border border-eza-blue/20 mb-4">
            <Icon name="Play" size={14} />
            Premium Demos
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-4">
            EZA-Core Nasıl Çalışır?
          </h2>
          <p className="text-xl text-eza-text-secondary max-w-2xl mx-auto mb-2">
            EZA-Core'un gücünü 8-12 saniyede görün
          </p>
          <p className="text-sm text-eza-text-secondary/70 max-w-xl mx-auto">
            Powered by EZA-Core
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {demos.map((demo, index) => (
            <FadeIn key={demo.id} delay={index * 100}>
              <div
                className="group relative bg-white rounded-2xl overflow-hidden border border-gray-200/50 shadow-lg hover:shadow-xl transition-all duration-500 hover:border-eza-blue/30"
                onMouseEnter={() => setHoveredVideo(demo.id)}
                onMouseLeave={() => setHoveredVideo(null)}
              >
                {/* Video Container */}
                <div className="relative aspect-video bg-gradient-to-br from-eza-blue/5 via-eza-blue/3 to-eza-gray overflow-hidden">
                  <video
                    src={demo.videoSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      hoveredVideo === demo.id ? "scale-105" : "scale-100"
                    }`}
                    onError={(e) => {
                      // Video yüklenemezse placeholder göster
                      try {
                        const target = e.target as HTMLVideoElement;
                        if (target) {
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }
                      } catch (error) {
                        // Hata yakalama - sessizce devam et
                      }
                    }}
                  />
                  
                  {/* Placeholder - Video yoksa gösterilir */}
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                    <div className="w-16 h-16 rounded-full bg-eza-blue/10 flex items-center justify-center">
                      <Icon name={demo.icon} size={32} className="text-eza-blue" />
                    </div>
                    <p className="text-sm text-eza-text-secondary font-medium">
                      Demo video yakında
                    </p>
                  </div>
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  {/* Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 backdrop-blur-sm text-eza-blue text-xs font-semibold rounded-full border border-eza-blue/20 shadow-sm">
                      <Icon name={demo.icon} size={12} />
                      {demo.badge}
                    </span>
                  </div>

                  {/* Play indicator (subtle) */}
                  <div className="absolute bottom-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <Icon name="Play" size={14} className="text-eza-blue" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-eza-text mb-2">
                    {demo.title}
                  </h3>
                  <p className="text-sm text-eza-text-secondary leading-relaxed">
                    {demo.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-eza-text-secondary/70">
            Tüm demolar EZA-Core tarafından çalıştırılmaktadır
          </p>
        </div>
      </div>
    </FadeIn>
  );
}

