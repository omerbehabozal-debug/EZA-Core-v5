import Link from "next/link";
import { sectors } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function SectorGrid() {
  return (
    <div>
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
              className="group block relative aspect-square bg-white rounded-2xl p-6 border border-gray-200/50 hover:border-gray-300 hover:shadow-md transition-all duration-300 overflow-hidden"
            >
              <div className="h-full flex flex-col justify-between">
                <div className="flex-shrink-0">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-eza-gray mb-4 group-hover:bg-eza-gray/80 transition-colors duration-300">
                    <Icon name={sector.icon} className="text-eza-text" size={24} />
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
  );
}
