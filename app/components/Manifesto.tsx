import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Manifesto() {
  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto">
        <div className="bg-eza-text rounded-3xl p-16 md:p-24 shadow-2xl relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-semibold text-white mb-6 tracking-tight">
                Kurucu Manifestosu
              </h2>
            </div>
            
            <div className="space-y-10 text-xl text-white/80 leading-relaxed max-w-4xl mx-auto font-light">
              <p>
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
            </div>
            
            <div className="mt-16 pt-8 border-t border-white/10 text-center">
              <p className="font-semibold text-3xl md:text-4xl text-white tracking-tight">
                EZA – Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
