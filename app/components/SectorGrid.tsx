import Link from "next/link";
import { sectors } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function SectorGrid() {
  return (
    <div>
      <FadeIn>
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
            <Icon name="Briefcase" className="text-eza-blue" size={20} />
            <span className="text-sm font-semibold text-eza-blue">Sektörler</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
            Sektör Çözümleri
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Her sektör için özelleştirilmiş etik çözümler
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sectors.map((sector, index) => (
          <FadeIn key={sector.title} delay={index * 50}>
            <Link
              href={sector.href}
              className="group relative aspect-square bg-gradient-to-br from-white to-eza-gray/50 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Icon name={sector.icon} className="text-eza-blue" size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-eza-dark mb-2 group-hover:text-eza-blue transition-colors">
                    {sector.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                    {sector.description}
                  </p>
                </div>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="ArrowRight" className="text-eza-blue" size={20} />
                </div>
              </div>
            </Link>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

