import FadeIn from "./FadeIn";
import Icon from "./Icon";

export default function Manifesto() {
  return (
    <FadeIn>
      <div className="max-w-6xl mx-auto">
        <div className="rounded-3xl p-16 md:p-24 shadow-2xl relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #0a1929 0%, #1a3a5a 25%, #0f2d4a 50%, #1a3a5a 75%, #0a1929 100%)'
        }}>
          {/* Premium gradient overlay */}
          <div className="absolute inset-0 opacity-60 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0, 113, 227, 0.15) 0%, transparent 70%)'
          }} />
          
          {/* Secondary gradient accent */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 60% 50% at 100% 100%, rgba(0, 119, 237, 0.12) 0%, transparent 60%)'
          }} />
          
          {/* Premium background pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_3px_3px,_white_1px,_transparent_0)] bg-[length:50px_50px]" />
          </div>
          
          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/8 rounded-full blur-3xl pointer-events-none" style={{
            animation: 'pulse-glow 4s ease-in-out infinite 2s'
          }} />
          
          {/* Subtle mesh overlay */}
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
            background: `
              radial-gradient(at 20% 30%, rgba(0, 113, 227, 0.08) 0%, transparent 50%),
              radial-gradient(at 80% 70%, rgba(0, 119, 237, 0.06) 0%, transparent 50%)
            `
          }} />
          
          <div className="relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg mb-6">
                <Icon name="Sparkles" className="text-white" size={32} />
              </div>
              <h2 className="text-5xl md:text-6xl font-semibold text-white mb-6 tracking-tight drop-shadow-sm">
                Kurucu Manifestosu
              </h2>
            </div>
            
            <div className="space-y-10 text-xl text-white/95 leading-relaxed max-w-4xl mx-auto font-light">
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-8 border border-white/15 shadow-lg hover:bg-white/10 transition-all duration-300">
                <p className="text-white/95">
                  EZA, teknolojinin hızla büyüdüğü ama etiğin aynı hızda büyümediği bir dünyada doğdu. 
                  Her gün yeni bir AI modeli, yeni bir platform, yeni bir teknoloji ortaya çıkıyor. 
                  Ancak bu teknolojilerin insanlığa karşı nasıl davrandığı konusunda yeterli rehberlik yok.
                </p>
              </div>
              
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-8 border border-white/15 shadow-lg hover:bg-white/10 transition-all duration-300">
                <p className="text-white/95">
                  EZA, bu boşluğu doldurmak için kuruldu. Biz bir ceza kesen etik polisi değiliz. 
                  Biz, teknolojinin daha iyi davranmasını sağlayan bir rehberiz. Yasaklamaz, engellemez, 
                  cezalandırmaz; sadece daha iyi alternatifler önerir ve yönlendirir.
                </p>
              </div>
              
              <div className="bg-white/8 backdrop-blur-md rounded-2xl p-8 border border-white/15 shadow-lg hover:bg-white/10 transition-all duration-300">
                <p className="text-white/95">
                  Teknolojinin insanlığa karşı etik davranmasını sağlamak, sadece güvenlik sorunu değildir. 
                  Bu, teknolojinin kendisinin değerlerini ve davranışlarını şekillendirme meselesidir. 
                  EZA, bu değerleri ve davranışları yönlendirerek, teknoloji ile insan arasında etik bir köprü kurar.
                </p>
              </div>
            </div>
            
            <div className="mt-16 pt-8 border-t border-white/15 text-center">
              <div className="inline-flex flex-col items-center gap-4 px-8 py-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg">
                <Icon name="Sparkles" className="text-white" size={40} />
                <div className="text-center">
                  <p className="font-bold text-3xl md:text-4xl text-white tracking-tight mb-2">
                    EZA
                  </p>
                  <p className="font-semibold text-xl md:text-2xl text-white/90 tracking-tight leading-relaxed">
                    İnsanlığın teknolojiye karşı koruma kalkanı.
                  </p>
                  <p className="font-light text-base md:text-lg text-white/70 mt-3 max-w-2xl">
                    Teknolojinin hızla ilerlediği bir dünyada, insanlığın güvenliğini ve değerlerini koruyan sistem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
