import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Manifesto() {
  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-eza-dark via-eza-blue to-eza-dark rounded-3xl p-12 md:p-20 shadow-2xl relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-4 mb-12">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Icon name="Sparkles" className="text-white" size={32} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white">
                Kurucu Manifestosu
              </h2>
            </div>
            
            <div className="space-y-8 text-lg md:text-xl text-white/90 leading-relaxed max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <p className="text-white">
                  EZA, teknolojinin hızla büyüdüğü ama etiğin aynı hızda büyümediği bir dünyada doğdu. 
                  Her gün yeni bir AI modeli, yeni bir platform, yeni bir teknoloji ortaya çıkıyor. 
                  Ancak bu teknolojilerin insanlığa karşı nasıl davrandığı konusunda yeterli rehberlik yok.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <p>
                  EZA, bu boşluğu doldurmak için kuruldu. Biz bir ceza kesen etik polisi değiliz. 
                  Biz, teknolojinin daha iyi davranmasını sağlayan bir rehberiz. Yasaklamaz, engellemez, 
                  cezalandırmaz; sadece daha iyi alternatifler önerir ve yönlendirir.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <p>
                  Teknolojinin insanlığa karşı etik davranmasını sağlamak, sadece güvenlik sorunu değildir. 
                  Bu, teknolojinin kendisinin değerlerini ve davranışlarını şekillendirme meselesidir. 
                  EZA, bu değerleri ve davranışları yönlendirerek, teknoloji ile insan arasında etik bir köprü kurar.
                </p>
              </div>
            </div>
            
            <div className="mt-12 pt-8 border-t border-white/20 text-center">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                <Icon name="Sparkles" className="text-white" size={32} />
                <p className="font-bold text-2xl md:text-3xl text-white">
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
