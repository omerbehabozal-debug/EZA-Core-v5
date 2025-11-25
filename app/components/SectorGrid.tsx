import Link from "next/link";
import { sectors } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function SectorGrid() {
  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-4">
              Sektör Çözümleri
            </h2>
            <p className="text-xl text-eza-text-secondary max-w-2xl mx-auto">
              Her sektör için özelleştirilmiş etik çözümler
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sectors.map((sector, index) => (
            <FadeIn key={sector.title} delay={index * 30}>
              <Link
                href={sector.href}
                className="block bg-white rounded-lg p-5 border border-gray-200 hover:border-eza-blue hover:shadow-md transition-all h-full"
              >
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-eza-blue/10 mb-3">
                      <Icon name={sector.icon} className="text-eza-blue" size={24} />
                    </div>
                    <h3 className="text-base font-semibold text-eza-text mb-2">
                      {sector.title}
                    </h3>
                    <p className="text-xs text-eza-text-secondary leading-relaxed line-clamp-3">
                      {sector.description}
                    </p>
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
