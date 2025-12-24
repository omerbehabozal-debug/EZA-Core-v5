import FadeIn from "./FadeIn";
import Icon from "./Icon";

const whyNeeded = [
  {
    icon: "MessageSquare",
    title: "Teknoloji bazen insan niyetini doğru anlamayabilir",
    description: "EZA, iletişimi daha anlaşılır ve güvenli hâle getirir.",
  },
  {
    icon: "Brain",
    title: "Yapay zekâlar öğrenirken hatalar yapabilir",
    description: "EZA, bu hataları yargılamadan tespit eder ve daha uygun bir sonuç önerir.",
  },
  {
    icon: "Car",
    title: "Otonom sistemler her durumda insan önceliğini kolayca değerlendiremeyebilir",
    description: 'EZA, bu alanlarda "insana göre daha iyi davranış" önerileri sunar.',
  },
  {
    icon: "Cpu",
    title: "İnsansı robotlar ile insanlığın etik iletişimi",
    description: "EZA, insansı robotların insanlarla etkileşiminde saygılı, anlaşılır ve güvenli bir iletişim ortamı sağlar.",
  },
  {
    icon: "Video",
    title: "Medya akışı çok hızlı",
    description: 'EZA "yasaklama" değil, daha sağlıklı içerik sunumu için iyileştirme önerileri geliştirir.',
  },
  {
    icon: "Users",
    title: "Aileler, çocuklarının dijital dünyada güvende olmasını ister",
    description: "EZA, sadece \"uyarı\" yapar ve ailelere karar desteği sunar.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Analiz",
    description: "İçeriği veya davranışı analiz eder",
  },
  {
    step: "2",
    title: "İşaretleme",
    description: "Riskli veya sorunlu bir durum görürse hafifçe işaret eder",
  },
  {
    step: "3",
    title: "Öneri",
    description: "Daha doğru, daha güvenli, daha etik bir alternatif önerir",
  },
  {
    step: "4",
    title: "Rehberlik",
    description: "Sisteme ya da kullanıcıya rehberlik sunar",
  },
];

const contributions = [
  {
    icon: "Brain",
    title: "Daha Sağlıklı Teknolojik Etkileşim",
    description: "Kullanıcı deneyimini bozmadan, daha net ve doğru sonuçlar sağlar.",
  },
  {
    icon: "MessageCircle",
    title: "Daha Etik İletişim",
    description: "Uyumlu, saygılı ve faydalı bir iletişim ortamını destekler.",
  },
  {
    icon: "Car",
    title: "Daha Güvenli Otonom Sistemler",
    description: "Yanlış yorum risklerini azaltan öneriler üretir.",
  },
  {
    icon: "Cpu",
    title: "İnsansı Robotlar ile Etik İletişim",
    description: "İnsansı robotların insanlarla etkileşiminde saygılı, anlaşılır ve güvenli bir iletişim ortamı sağlar.",
  },
  {
    icon: "Monitor",
    title: "Daha Güvenilir İçerik",
    description: "Çocuklara, ailelere ve topluma uygun içeriklerin görünürlüğünü artırır.",
  },
  {
    icon: "Shield",
    title: "Daha Az Yanlış Bilgi",
    description: "EZA, doğruluk kontrolünü bir kalkan gibi değil, bir yönlendirici pusula gibi yapar.",
  },
];

const targetAudience = [
  "Teknoloji geliştiricileri",
  "Medya kuruluşları",
  "Otonom araç üreticileri",
  "İnsansı robot üreticileri",
  "Devlet kurumları",
  "Eğitim dünyası",
  "Aileler",
  "Günlük kullanıcılar",
];

export default function WhyEZA() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Slogan */}
      <FadeIn>
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-semibold text-eza-text mb-6">
            Neden EZA?
          </h2>
          <div className="inline-block px-8 py-3 bg-eza-blue/10 border border-eza-blue/20 rounded-lg mb-6">
            <span className="text-eza-blue font-semibold text-xl">"İnsanlık için emniyet kemeri"</span>
          </div>
          <p className="text-xl text-eza-text-secondary max-w-2xl mx-auto mb-12">
            Teknolojinin hızla geliştiği bir dünyada, insanlığı koruyan ve güvende tutan güvenlik katmanı
          </p>
          
          {/* Premium Image */}
          <FadeIn delay={200}>
            <div className="max-w-4xl mx-auto">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50">
                <div className="absolute inset-0 bg-gradient-to-br from-eza-blue/5 via-transparent to-purple-500/5 pointer-events-none" />
                <img 
                  src="/videos/anasayfa resmi.png" 
                  alt="EZA - Etik Zeka Altyapısı"
                  className="w-full h-auto object-cover"
                  style={{
                    maxHeight: '600px',
                    objectFit: 'cover'
                  }}
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </FadeIn>

      {/* Neden Gereklidir? */}
      <div className="mb-20">
        <FadeIn>
          <h3 className="text-3xl font-semibold text-eza-text mb-8 text-center">
            Neden Gereklidir?
          </h3>
        </FadeIn>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {whyNeeded.map((item, index) => (
            <FadeIn key={index} delay={index * 50}>
              <div className="bg-white rounded-lg p-6 border border-gray-200 h-full">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                    <Icon name={item.icon} className="text-eza-blue" size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-eza-text mb-2 text-base">
                      {item.title}
                    </h4>
                    <p className="text-sm text-eza-text-secondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* EZA Nasıl Çalışır? */}
      <div className="mb-20">
        <FadeIn>
          <h3 className="text-3xl font-semibold text-eza-text mb-4 text-center">
            EZA Nasıl Çalışır?
          </h3>
          <p className="text-center text-eza-text-secondary mb-12 max-w-2xl mx-auto">
            EZA önce anlamaya çalışır, sonra değerlendirir ve gerekirse daha iyi bir yol önerir.
            Bu süreç "engelleme" değil, daha iyiye yönlendirme sürecidir.
          </p>
        </FadeIn>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorks.map((item, index) => (
            <FadeIn key={index} delay={index * 50}>
              <div className="bg-white rounded-lg p-6 border border-gray-200 text-center relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-eza-blue text-white font-bold text-sm">
                    {item.step}
                  </div>
                </div>
                <h4 className="font-semibold text-eza-text mb-3 mt-2">{item.title}</h4>
                <p className="text-sm text-eza-text-secondary leading-relaxed">
                  {item.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* EZA İnsanlığa Nasıl Katkı Sağlar? */}
      <div className="mb-20">
        <FadeIn>
          <h3 className="text-3xl font-semibold text-eza-text mb-8 text-center">
            EZA İnsanlığa Nasıl Katkı Sağlar?
          </h3>
        </FadeIn>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contributions.map((item, index) => (
            <FadeIn key={index} delay={index * 50}>
              <div className="bg-white rounded-lg p-6 border border-gray-200 h-full">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-eza-blue/10 flex items-center justify-center">
                    <Icon name={item.icon} className="text-eza-blue" size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-eza-text mb-2 text-base">
                      {item.title}
                    </h4>
                    <p className="text-sm text-eza-text-secondary leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Kimler İçin? */}
      <div>
        <FadeIn>
          <h3 className="text-3xl font-semibold text-eza-text mb-8 text-center">
            Kimler İçin?
          </h3>
        </FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {targetAudience.map((audience, index) => (
            <FadeIn key={index} delay={index * 30}>
              <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Icon name="CheckCircle" className="text-eza-blue" size={20} />
                </div>
                <p className="text-sm font-medium text-eza-text">{audience}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

