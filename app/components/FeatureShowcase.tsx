import Link from "next/link";
import FadeIn from "./FadeIn";
import Icon from "./Icon";

interface FeatureShowcaseProps {
  title: string;
  subtitle: string;
  items: Array<{
    title: string;
    description: string;
    href: string;
    icon: string;
  }>;
  badge?: string;
  badgeIcon?: string;
}

export default function FeatureShowcase({
  title,
  subtitle,
  items,
  badge,
  badgeIcon,
}: FeatureShowcaseProps) {
  return (
    <div>
      <FadeIn>
        <div className="text-center mb-16">
          {badge && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-eza-blue/10 rounded-full mb-6">
              {badgeIcon && <Icon name={badgeIcon} className="text-eza-blue" size={20} />}
              <span className="text-sm font-semibold text-eza-blue">{badge}</span>
            </div>
          )}
          <h2 className="text-4xl md:text-5xl font-bold text-eza-dark mb-4">
            {title}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {items.map((item, index) => (
          <FadeIn key={item.title} delay={index * 150}>
            <Link
              href={item.href}
              className="group block bg-gradient-to-br from-white to-eza-gray/30 rounded-2xl p-10 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 relative overflow-hidden h-full"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-eza-blue/10 to-eza-blue/5 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <Icon name={item.icon} className="text-eza-blue" size={40} />
                </div>
                <h3 className="text-2xl font-bold text-eza-dark mb-4 group-hover:text-eza-blue transition-colors">
                  {item.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {item.description}
                </p>
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-eza-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg group-hover:gap-3">
                  Keşfet
                  <Icon name="ArrowRight" size={18} />
                </div>
              </div>
            </Link>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

