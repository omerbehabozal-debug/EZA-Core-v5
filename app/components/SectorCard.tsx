import Link from "next/link";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

interface SectorCardProps {
  title: string;
  description: string;
  href: string;
  icon: string;
}

export default function SectorCard({
  title,
  description,
  href,
  icon,
}: SectorCardProps) {
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
          <p className="text-gray-600 mb-4 leading-relaxed text-sm">
            {description}
          </p>
          <span className="inline-flex items-center text-eza-blue font-semibold text-sm group-hover:gap-2 gap-1 transition-all">
            Çözümü İncele
            <Icon name="ArrowRight" size={16} />
          </span>
        </div>
      </Link>
    </FadeIn>
  );
}
