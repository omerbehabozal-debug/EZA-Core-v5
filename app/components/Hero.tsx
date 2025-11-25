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
    <div className="relative bg-gradient-to-br from-eza-gray via-white to-eza-gray min-h-[700px] flex items-center overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-eza-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-eza-blue/5 rounded-full blur-3xl" />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full relative z-10">
        <FadeIn>
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm mb-8">
              <Icon name="Sparkles" size={16} className="text-eza-blue" />
              <span className="text-sm font-medium text-gray-700">Etik Teknoloji Rehberi</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-eza-dark mb-8 leading-tight">
              EZA – Teknolojinin insanlığa karşı{" "}
              <span className="bg-gradient-to-r from-eza-blue to-eza-blue/70 bg-clip-text text-transparent">
                etik davranmasını
              </span>{" "}
              sağlayan rehber.
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed max-w-3xl mx-auto">
              EZA, insan ve teknoloji arasında etik bir köprü kurar. Yasaklamaz, ceza vermez; sadece daha iyi bir davranış önerir.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleScrollToEcosystem}
                className="group inline-flex items-center gap-2 px-8 py-4 bg-eza-blue text-white rounded-xl font-semibold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                EZA Ekosistemini Keşfet
                <Icon name="ArrowDown" size={20} className="group-hover:translate-y-1 transition-transform" />
              </button>
              <Link
                href="https://ezacore.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-eza-blue border-2 border-eza-blue rounded-xl font-semibold hover:bg-eza-gray transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                EZA Core Platformu
                <Icon name="ExternalLink" size={20} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
