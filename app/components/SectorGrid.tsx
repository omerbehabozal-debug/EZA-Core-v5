import Link from "next/link";
import { sectors } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function SectorGrid() {
  return (
    <div className="relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,_currentColor_1px,_transparent_0),linear-gradient(-45deg,_currentColor_1px,_transparent_0)] bg-[length:60px_60px]" />
      </div>
      
      <div className="relative z-10">
        <FadeIn>
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-semibold text-eza-text mb-6 tracking-tight">
              Sektör Çözümleri
            </h2>
            <p className="text-2xl text-eza-text-secondary font-light max-w-2xl mx-auto">
              Her sektör için özelleştirilmiş etik çözümler
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectors.map((sector, index) => (
            <FadeIn key={sector.title} delay={index * 50}>
              <Link
                href={sector.href}
                className="group block relative aspect-square bg-white rounded-2xl p-6 border border-gray-200/50 hover:border-gray-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex-shrink-0">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <Icon name={sector.icon} className="text-eza-blue" size={28} />
                    </div>
                  </div>
                  <div className="flex-grow flex flex-col justify-end">
                    <h3 className="text-lg font-semibold text-eza-text mb-2 group-hover:text-eza-blue transition-colors">
                      {sector.title}
                    </h3>
                    <p className="text-xs text-eza-text-secondary leading-relaxed mb-4 line-clamp-3">
                      {sector.description}
                    </p>
                    <div className="flex items-center text-eza-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-xs font-medium mr-1">Detaylar</span>
                      <Icon name="ArrowRight" size={14} />
                    </div>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
