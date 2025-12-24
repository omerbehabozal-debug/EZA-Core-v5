export const navigation = {
  main: [
    { name: "Home", href: "/" },
    { name: "Ecosystem", href: "/#ecosystem" },
    {
      name: "Products",
      href: "/products",
      children: [
        { name: "Standalone", href: "/products/standalone" },
        { name: "Proxy", href: "/products/proxy" },
        { name: "Proxy-Lite", href: "/products/proxy-lite" },
      ],
    },
    {
      name: "Panels",
      href: "/panels",
      children: [
        { name: "Regulator Panel", href: "/panels/regulator" },
        { name: "Corporate Panel", href: "/panels/corporate" },
        { name: "Developer Console", href: "/panels/developer" },
      ],
    },
    {
      name: "Solutions",
      href: "/solutions",
      children: [
        { name: "Education", href: "/solutions/education" },
        { name: "Banking", href: "/solutions/banking" },
        { name: "Healthcare", href: "/solutions/healthcare" },
        { name: "Corporate", href: "/solutions/corporate" },
        { name: "Autonomous", href: "/solutions/autonomous" },
        { name: "Humanoid Robots", href: "/solutions/humanoid-robots" },
        { name: "Media", href: "/solutions/media" },
        { name: "Public Sector", href: "/solutions/public-sector" },
      ],
    },
    { name: "Documentation", href: "/documentation" },
    { name: "Contact", href: "/contact" },
  ],
};

export const ecosystemItems = {
  core: [
    {
      title: "Platform",
      description: "EZA'nın teknolojik motoru. Etik analiz pipeline, skorlama sistemi ve risk değerlendirme çekirdeği.",
      href: "/platform/eza-core",
      icon: "Cpu",
      external: false,
    },
    {
      title: "Standalone",
      description: "EZA-Core'un bağımsız modu. Herhangi bir sistemle entegre olmadan çalışır.",
      href: "/products/standalone",
      icon: "Shield",
    },
    {
      title: "Proxy",
      description: "EZA-Core'un API proxy katmanı. Tüm istekleri yönlendirir ve etik kontrol sağlar.",
      href: "/products/proxy",
      icon: "Globe",
    },
    {
      title: "Proxy-Lite",
      description: "EZA-Core'un hafif versiyonu. Düşük kaynak kullanımı ile etik kontrol.",
      href: "/products/proxy-lite",
      icon: "Zap",
    },
  ],
  panels: [
    {
      title: "Regulator Panel",
      description: "Düzenleyici kurumlar için özel panel. Sektör genelinde etik izleme ve raporlama.",
      href: "/panels/regulator",
      icon: "Building2",
    },
    {
      title: "Corporate Panel",
      description: "Kurumsal yönetim paneli. Organizasyon içi etik uyumluluk ve izleme.",
      href: "/panels/corporate",
      icon: "Briefcase",
    },
    {
      title: "Developer Console",
      description: "Geliştiriciler için API yönetim konsolu. Entegrasyon ve test araçları.",
      href: "/panels/developer",
      icon: "Code",
    },
    {
      title: "EU AI Act Compliance Panel",
      description: "Avrupa Birliği Yapay Zekâ Yasasına uyum sağlamak isteyen şirketler için özel panel.",
      href: "/panels/eu-ai-act",
      icon: "Scale",
    },
    {
      title: "Select Portal",
      description: "Kurumlar arası portal. Birden fazla kurumla çalışan holdingler için çok tenantlı portal.",
      href: "/panels/select-portal",
      icon: "Layers",
    },
  ],
  modules: [
    {
      title: "LLM Safety",
      description: "Büyük dil modelleri için etik güvenlik modülü. Zararlı içerik tespiti ve yönlendirme.",
      href: "/modules/llm-safety",
      icon: "Brain",
    },
    {
      title: "Media Safety",
      description: "Medya içeriği için etik kontrol. Görsel, video ve metin analizi.",
      href: "/solutions/media",
      icon: "Video",
    },
    {
      title: "Autonomous Safety",
      description: "Otonom sistemler için etik yönlendirme. Robotik ve AI karar destek sistemleri.",
      href: "/solutions/autonomous",
      icon: "Cpu",
    },
    {
      title: "Children Safety",
      description: "Çocuk güvenliği odaklı etik modül. Yaşa uygun içerik filtreleme ve koruma.",
      href: "/modules/children-safety",
      icon: "Users",
    },
    {
      title: "Social & Communication Ethics",
      description: "Sosyal platformlar ve iletişim için etik standartlar. Zararlı etkileşim önleme.",
      href: "/modules/social-communication-ethics",
      icon: "MessageCircle",
    },
  ],
};

export const sectors = [
  {
    title: "Education",
    description: "Eğitim teknolojilerinde etik kullanım. Öğrenci verilerinin korunması ve adil AI kullanımı.",
    href: "/solutions/education",
    icon: "GraduationCap",
  },
  {
    title: "Banking",
    description: "Finansal hizmetlerde etik AI. Kredi kararlarında adalet ve şeffaflık.",
    href: "/solutions/banking",
    icon: "Landmark",
  },
  {
    title: "Healthcare",
    description: "Sağlık hizmetlerinde etik teknoloji. Hasta gizliliği ve adil tanı destek sistemleri.",
    href: "/solutions/healthcare",
    icon: "Heart",
  },
  {
    title: "Corporate",
    description: "Kurumsal AI kullanımında etik standartlar. İşe alım, değerlendirme ve karar süreçleri.",
    href: "/solutions/corporate",
    icon: "Building",
  },
  {
    title: "Autonomous",
    description: "Otonom sistemlerde etik yönlendirme. Robotik ve AI karar destek sistemleri için güvenlik.",
    href: "/solutions/autonomous",
    icon: "Car",
  },
  {
    title: "Humanoid Robots",
    description: "İnsansı robotlar ile insanlığın etik iletişimi. Saygılı, anlaşılır ve güvenli etkileşim ortamı.",
    href: "/solutions/humanoid-robots",
    icon: "Cpu",
  },
  {
    title: "Media",
    description: "Medya ve içerik üretiminde etik AI. Deepfake tespiti ve sorumlu içerik oluşturma.",
    href: "/solutions/media",
    icon: "Newspaper",
  },
  {
    title: "Public Sector",
    description: "Kamu sektöründe etik teknoloji kullanımı. Vatandaş hakları ve şeffaflık.",
    href: "/solutions/public-sector",
    icon: "Scale",
  },
];

export const products = [
  {
    title: "Standalone",
    description: "Bağımsız çalışan etik değerlendirme platformu. Herhangi bir sistemle entegre olmadan, kendi başına etik analiz yapar ve yönlendirmeler sunar.",
    href: "/products/standalone",
    icon: "Shield",
  },
  {
    title: "Proxy",
    description: "API proxy katmanı olarak çalışan etik kontrol sistemi. Tüm istekleri yönlendirir, zararlı içerikleri tespit eder ve daha iyi alternatifler önerir.",
    href: "/products/proxy",
    icon: "Globe",
  },
  {
    title: "Proxy-Lite",
    description: "Hafif versiyon proxy çözümü. Düşük kaynak kullanımı ile etik kontrol sağlar, küçük ve orta ölçekli uygulamalar için idealdir.",
    href: "/products/proxy-lite",
    icon: "Zap",
  },
];

export const panels = [
  {
    title: "Regulator Panel",
    description: "Düzenleyici kurumlar için özel panel. Sektör genelinde etik izleme, raporlama ve uyumluluk yönetimi sağlar.",
    href: "/panels/regulator",
    icon: "Building2",
  },
  {
    title: "Corporate Panel",
    description: "Kurumsal yönetim paneli. Organizasyon içi etik uyumluluk, izleme ve sürekli iyileştirme araçları sunar.",
    href: "/panels/corporate",
    icon: "Briefcase",
  },
  {
    title: "Developer Console",
    description: "Geliştiriciler için API yönetim konsolu. Entegrasyon, test ve izleme araçları ile geliştirme sürecini destekler.",
    href: "/panels/developer",
    icon: "Code",
  },
];

export const faqItems = [
  {
    question: "EZA sansür sistemi mi?",
    answer: "Hayır. EZA bir sansür sistemi değildir. EZA, teknolojinin daha etik davranmasını sağlayan bir rehberdir. İçeriği yasaklamaz veya cezalandırmaz; bunun yerine daha iyi alternatifler önerir ve yönlendirir.",
  },
  {
    question: "EZA doğruluk değil, etik odaklı mı?",
    answer: "Evet. EZA doğruluk kontrolü yapmaz. EZA'nın odak noktası etik davranıştır. Bir içeriğin doğru olup olmadığını değil, etik olup olmadığını değerlendirir ve yönlendirir.",
  },
  {
    question: "Hangi sektörler kullanabilir?",
    answer: "EZA, eğitim, bankacılık, sağlık, kurumsal, otonom sistemler, medya ve kamu sektörü dahil olmak üzere birçok sektörde kullanılabilir. Her sektör için özelleştirilmiş etik modüller sunar.",
  },
  {
    question: "Teknoloji nasıl yönlendirilir?",
    answer: "EZA, API proxy katmanı veya standalone mod olarak çalışarak teknolojik sistemleri yönlendirir. Zararlı veya etik olmayan içerikleri tespit eder ve daha iyi alternatifler önerir, ancak içeriği engellemez.",
  },
  {
    question: "Güvenlik ve etik farkı nedir?",
    answer: "Güvenlik, sistemlerin zararlı saldırılara karşı korunmasıdır. Etik ise, teknolojinin insanlara karşı adil, saygılı ve sorumlu bir şekilde davranmasını sağlamaktır. EZA etik odaklıdır ve teknolojinin insanlığa karşı etik davranmasını sağlar.",
  },
];
