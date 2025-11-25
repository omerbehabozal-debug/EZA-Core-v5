import FadeIn from "./FadeIn";
import Icon from "./Icon";

const features = [
  {
    icon: "Target",
    title: "Rehberlik",
    description: "Kural koyucu değil, teknolojiye rehberlik eden bir sistem",
  },
  {
    icon: "Shield",
    title: "Etik Odaklı",
    description: "Teknolojinin insanlığa karşı etik davranmasını sağlar",
  },
  {
    icon: "Link",
    title: "Köprü",
    description: "İnsan ve teknoloji arasında etik bir köprü kurar",
  },
];

export default function VisionSection() {
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
      <FadeIn>
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-4">
            EZA Vizyonu
          </h2>
          <p className="text-xl text-eza-text-secondary max-w-2xl mx-auto">
            Teknolojinin etik gelişimi için rehberlik
          </p>
        </div>
      </FadeIn>

      <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
        <FadeIn>
          <div className="space-y-6 text-lg text-eza-text-secondary leading-relaxed">
            <p>
              Teknoloji hızla gelişiyor. Her gün yeni AI modelleri, yeni platformlar, 
              yeni sistemler ortaya çıkıyor. Ancak bu hızlı gelişimin yanında, 
              teknolojinin insanlığa karşı nasıl davranması gerektiği konusunda bir boşluk var.
            </p>
            <p>
              EZA, bu boşluğu doldurmak için kuruldu. EZA, teknolojinin hızlı gelişimine 
              karşı etik bir rehber olarak çalışır. Teknolojinin insanlığa karşı etik 
              davranmasını sağlamak için yönlendirici bir felsefe sunar.
            </p>
            <p>
              EZA, kural koyucu değil, rehberdir. Yasaklamaz, ceza vermez; sadece daha iyi 
              bir davranış önerir. Teknoloji ile insan arasında etik bir köprü kurar ve 
              teknolojinin daha sorumlu bir şekilde kullanılmasını sağlar.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="grid grid-cols-1 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-lg p-6 border border-gray-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                    <Icon name={feature.icon} className="text-eza-blue" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-eza-text text-lg mb-1">{feature.title}</h3>
                    <p className="text-eza-text-secondary text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
