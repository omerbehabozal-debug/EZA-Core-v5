"use client";

import Link from "next/link";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Hero() {
  const handleScrollToEcosystem = () => {
    const element = document.querySelector("#ecosystem");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative bg-white min-h-screen flex items-center overflow-hidden">
      {/* Premium background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large gradient orbs */}
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-eza-blue/10 via-eza-blue/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-[800px] h-[800px] bg-gradient-to-br from-eza-blue/5 via-transparent to-eza-blue/10 rounded-full blur-3xl" />
      </div>
      
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-32 w-full relative z-10">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center">
            {/* Premium badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-eza-gray/80 backdrop-blur-sm rounded-full border border-gray-200/50 shadow-sm mb-10">
              <div className="w-2 h-2 rounded-full bg-eza-blue animate-pulse" />
              <span className="text-sm font-medium text-eza-text-secondary">Etik Teknoloji Rehberi</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-semibold text-eza-text mb-10 leading-[1.05] tracking-tight">
              Teknolojinin insanlığa karşı{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-eza-blue">etik davranmasını</span>
                <span className="absolute bottom-2 left-0 right-0 h-3 bg-eza-blue/10 -z-0" />
              </span>{" "}
              sağlayan rehber.
            </h1>
            
            <p className="text-2xl md:text-3xl text-eza-text-secondary mb-16 leading-relaxed font-light max-w-3xl mx-auto mt-8">
              EZA, insan ve teknoloji arasında etik bir köprü kurar. Yasaklamaz, ceza vermez; sadece daha iyi bir davranış önerir.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleScrollToEcosystem}
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-eza-blue text-white rounded-full text-lg font-medium hover:bg-[#0077ed] transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105"
              >
                Ekosistemi Keşfet
                <Icon name="ArrowDown" size={18} className="group-hover:translate-y-0.5 transition-transform duration-300" />
              </button>
              <Link
                href="https://ezacore.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-transparent text-eza-blue border border-eza-blue/20 rounded-full text-lg font-medium hover:bg-eza-blue/5 hover:border-eza-blue/40 transition-all duration-300 hover:scale-105"
              >
                EZA Core Platformu
                <Icon name="ExternalLink" size={18} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <Icon name="ChevronDown" className="text-eza-text-secondary" size={24} />
      </div>
    </div>
  );
}
