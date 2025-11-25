import Link from "next/link";
import { ecosystemItems } from "@/lib/constants";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

interface EcosystemCardProps {
  title: string;
  description: string;
  href: string;
  icon: string;
}

function EcosystemCard({ title, description, href, icon }: EcosystemCardProps) {
  return (
    <FadeIn>
      <Link
        href={href}
        className="group block bg-white rounded-2xl p-8 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 h-full relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-eza-blue/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-6 group-hover:scale-110 transition-transform duration-300">
            <Icon name={icon} className="text-eza-blue" size={32} />
          </div>
          <h3 className="text-xl font-bold text-eza-dark mb-3 group-hover:text-eza-blue transition-colors">
            {title}
          </h3>
          <p className="text-gray-600 mb-6 leading-relaxed text-sm">
            {description}
          </p>
          <span className="inline-flex items-center text-eza-blue font-semibold text-sm group-hover:gap-2 gap-1 transition-all">
            Daha fazla bilgi
            <Icon name="ArrowRight" size={16} />
          </span>
        </div>
      </Link>
    </FadeIn>
  );
}

export default function EcosystemMap() {
  return (
    <div className="space-y-20">
      {/* EZA Core Platform */}
      <div>
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              EZA Core Platform
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Temel etik değerlendirme ve yönlendirme platformları
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ecosystemItems.core.map((item) => (
            <EcosystemCard key={item.title} {...item} />
          ))}
        </div>
      </div>

      {/* Panels */}
      <div>
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              Panels
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Özel yönetim panelleri ve konsollar
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ecosystemItems.panels.map((item) => (
            <EcosystemCard key={item.title} {...item} />
          ))}
        </div>
      </div>

      {/* Ethics Modules */}
      <div>
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
              Ethics Modules
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Sektöre özel etik modüller ve güvenlik çözümleri
            </p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ecosystemItems.modules.map((item) => (
            <EcosystemCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
