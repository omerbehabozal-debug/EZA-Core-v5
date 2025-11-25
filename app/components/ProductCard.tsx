import Link from "next/link";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

interface ProductCardProps {
  title: string;
  description: string;
  href: string;
  icon: string;
}

export default function ProductCard({
  title,
  description,
  href,
  icon,
}: ProductCardProps) {
  return (
    <FadeIn>
      <div className="group bg-white rounded-2xl p-10 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 relative overflow-hidden h-full">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-eza-blue/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-6 group-hover:scale-110 transition-transform duration-300">
            <Icon name={icon} className="text-eza-blue" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-eza-dark mb-4 group-hover:text-eza-blue transition-colors">
            {title}
          </h3>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {description}
          </p>
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-6 py-3 bg-eza-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg group-hover:gap-3"
          >
            Detayları Gör
            <Icon name="ArrowRight" size={18} />
          </Link>
        </div>
      </div>
    </FadeIn>
  );
}
