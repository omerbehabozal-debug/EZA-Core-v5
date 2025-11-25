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
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
      
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-32 w-full relative z-10">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-semibold text-eza-text mb-8 leading-[1.05] tracking-tight">
              Teknolojinin insanlığa karşı{" "}
              <span className="text-eza-blue">
                etik davranmasını
              </span>{" "}
              sağlayan rehber.
            </h1>
            <p className="text-2xl md:text-3xl text-eza-text-secondary mb-16 leading-relaxed font-light max-w-3xl mx-auto mt-8">
              EZA, insan ve teknoloji arasında etik bir köprü kurar. Yasaklamaz, ceza vermez; sadece daha iyi bir davranış önerir.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleScrollToEcosystem}
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-eza-blue text-white rounded-full text-lg font-medium hover:bg-[#0077ed] transition-all duration-300 shadow-sm hover:shadow-md"
              >
                Ekosistemi Keşfet
                <Icon name="ArrowDown" size={18} className="group-hover:translate-y-0.5 transition-transform duration-300" />
              </button>
              <Link
                href="https://ezacore.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-transparent text-eza-blue border border-eza-blue/20 rounded-full text-lg font-medium hover:bg-eza-blue/5 hover:border-eza-blue/40 transition-all duration-300"
              >
                EZA Core Platformu
                <Icon name="ExternalLink" size={18} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
