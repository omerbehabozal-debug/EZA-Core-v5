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
    <div className="relative bg-white min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-24 w-full">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-eza-text mb-6 leading-tight">
              Teknolojinin insanlığa karşı{" "}
              <span className="text-eza-blue">etik davranmasını</span>{" "}
              sağlayan rehber.
            </h1>
            
            <p className="text-xl md:text-2xl text-eza-text-secondary mb-12 leading-relaxed max-w-2xl mx-auto">
              EZA, insan ve teknoloji arasında etik bir köprü kurar. Yasaklamaz, ceza vermez; sadece daha iyi bir davranış önerir.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleScrollToEcosystem}
                className="inline-flex items-center gap-2 px-8 py-3 bg-eza-blue text-white rounded-lg text-base font-medium hover:bg-[#0077ed] transition-colors"
              >
                Ekosistemi Keşfet
                <Icon name="ArrowDown" size={18} />
              </button>
              <Link
                href="https://ezacore.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 bg-transparent text-eza-blue border border-eza-blue rounded-lg text-base font-medium hover:bg-eza-blue/5 transition-colors"
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
