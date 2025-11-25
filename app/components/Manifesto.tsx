import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Manifesto() {
  return (
    <FadeIn>
      <div className="max-w-5xl mx-auto bg-gradient-to-br from-white via-eza-gray/30 to-white rounded-3xl p-10 md:p-16 shadow-xl border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-eza-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-eza-blue/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-eza-blue to-eza-blue/70 flex items-center justify-center">
              <Icon name="Quote" className="text-white" size={24} />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-eza-dark">
              Kurucu Manifestosu
            </h2>
          </div>
          <div className="space-y-6 text-lg md:text-xl text-gray-700 leading-relaxed">
            <p className="text-gray-800">
              EZA, teknolojinin hızla büyüdüğü ama etiğin aynı hızda büyümediği bir dünyada doğdu. 
              Her gün yeni bir AI modeli, yeni bir platform, yeni bir teknoloji ortaya çıkıyor. 
              Ancak bu teknolojilerin insanlığa karşı nasıl davrandığı konusunda yeterli rehberlik yok.
            </p>
            <p>
              EZA, bu boşluğu doldurmak için kuruldu. Biz bir ceza kesen etik polisi değiliz. 
              Biz, teknolojinin daha iyi davranmasını sağlayan bir rehberiz. Yasaklamaz, engellemez, 
              cezalandırmaz; sadece daha iyi alternatifler önerir ve yönlendirir.
            </p>
            <p>
              Teknolojinin insanlığa karşı etik davranmasını sağlamak, sadece güvenlik sorunu değildir. 
              Bu, teknolojinin kendisinin değerlerini ve davranışlarını şekillendirme meselesidir. 
              EZA, bu değerleri ve davranışları yönlendirerek, teknoloji ile insan arasında etik bir köprü kurar.
            </p>
            <div className="pt-6 border-t border-gray-200">
              <p className="font-bold text-2xl text-eza-dark">
                EZA – Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
