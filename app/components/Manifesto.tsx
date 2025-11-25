import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Manifesto() {
  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto">
        <div className="bg-eza-text rounded-3xl p-16 md:p-24 shadow-2xl relative overflow-hidden">
          {/* Premium background pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_3px_3px,_white_1px,_transparent_0)] bg-[length:50px_50px]" />
          </div>
          
          {/* Gradient orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                <Icon name="Sparkles" className="text-white" size={32} />
              </div>
              <h2 className="text-5xl md:text-6xl font-semibold text-white mb-6 tracking-tight">
                Kurucu Manifestosu
              </h2>
            </div>
            
            <div className="space-y-10 text-xl text-white/90 leading-relaxed max-w-4xl mx-auto font-light">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <p className="text-white">
                  EZA, teknolojinin hızla büyüdüğü ama etiğin aynı hızda büyümediği bir dünyada doğdu. 
                  Her gün yeni bir AI modeli, yeni bir platform, yeni bir teknoloji ortaya çıkıyor. 
                  Ancak bu teknolojilerin insanlığa karşı nasıl davrandığı konusunda yeterli rehberlik yok.
                </p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <p>
                  EZA, bu boşluğu doldurmak için kuruldu. Biz bir ceza kesen etik polisi değiliz. 
                  Biz, teknolojinin daha iyi davranmasını sağlayan bir rehberiz. Yasaklamaz, engellemez, 
                  cezalandırmaz; sadece daha iyi alternatifler önerir ve yönlendirir.
                </p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
                <p>
                  Teknolojinin insanlığa karşı etik davranmasını sağlamak, sadece güvenlik sorunu değildir. 
                  Bu, teknolojinin kendisinin değerlerini ve davranışlarını şekillendirme meselesidir. 
                  EZA, bu değerleri ve davranışları yönlendirerek, teknoloji ile insan arasında etik bir köprü kurar.
                </p>
              </div>
            </div>
            
            <div className="mt-16 pt-8 border-t border-white/10 text-center">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <Icon name="Sparkles" className="text-white" size={32} />
                <p className="font-semibold text-2xl md:text-3xl text-white tracking-tight">
                  EZA – Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
