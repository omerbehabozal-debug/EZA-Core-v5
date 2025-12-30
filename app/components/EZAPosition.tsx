import FadeIn from "./FadeIn";
import Link from "next/link";
import Icon from "./Icon";

export default function EZAPosition() {
  return (
    <FadeIn>
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="rounded-2xl p-8 md:p-12 shadow-xl relative overflow-hidden bg-gradient-to-br from-eza-gray via-white to-eza-gray border border-gray-200/50">
          {/* Premium subtle gradient overlay */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(0, 113, 227, 0.08) 0%, transparent 70%)'
          }} />
          
          {/* Secondary subtle accent */}
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 70% 60% at 100% 100%, rgba(0, 119, 237, 0.06) 0%, transparent 60%)'
          }} />
          
          {/* Premium background pattern */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_3px_3px,_rgba(0,113,227,0.1)_1px,_transparent_0)] bg-[length:50px_50px]" />
          </div>
          
          {/* Subtle animated gradient orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-eza-blue/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-eza-blue/4 rounded-full blur-3xl pointer-events-none" />
          
          {/* Subtle mesh overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            background: `
              radial-gradient(at 20% 30%, rgba(0, 113, 227, 0.04) 0%, transparent 50%),
              radial-gradient(at 80% 70%, rgba(0, 119, 237, 0.03) 0%, transparent 50%)
            `
          }} />
          
          <div className="relative z-10">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-4 tracking-tight">
                EZA'nın Duruşu
              </h2>
            </div>
            
            <div className="space-y-4 text-lg text-eza-text-secondary leading-relaxed max-w-3xl mx-auto">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 shadow-sm hover:shadow-md hover:border-eza-blue/20 transition-all duration-300">
                <p className="text-eza-text text-center">
                  EZA, yapay zekâ sistemlerine otomatik veya zorunlu müdahale etmez.
                </p>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 shadow-sm hover:shadow-md hover:border-eza-blue/20 transition-all duration-300">
                <p className="text-eza-text text-center">
                  Yasaklamaz, yönlendirmez, karar vermez.
                </p>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 shadow-sm hover:shadow-md hover:border-eza-blue/20 transition-all duration-300">
                <p className="text-eza-text text-center">
                  EZA yalnızca ölçer, skorlar ve görünür kılar.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-eza-blue/10 via-white to-eza-blue/10 backdrop-blur-sm rounded-xl p-6 border border-eza-blue/30 shadow-md hover:shadow-lg hover:border-eza-blue/40 transition-all duration-300">
                <p className="text-eza-text text-center font-semibold text-xl">
                  Çünkü etik, dayatıldığında değil; fark edildiğinde anlamlıdır.
                </p>
              </div>
            </div>
            
            <div className="mt-10 pt-6 border-t border-gray-200/50 text-center">
              <Link 
                href="/manifesto" 
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white/90 backdrop-blur-sm rounded-lg border border-eza-blue/20 text-eza-blue hover:bg-eza-blue/5 hover:border-eza-blue/30 font-medium transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <span>Kurucu Manifestosu'nu Oku</span>
                <Icon name="ArrowRight" size={16} className="text-eza-blue group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

