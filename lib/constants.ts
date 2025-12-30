export const navigation = {
  main: [
    { name: "Home", href: "/" },
    { name: "Ecosystem", href: "/#ecosystem" },
    { name: "Hakkımızda", href: "/about" },
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
      title: "Standalone",
      description: "Yapay zekâ ile birebir etkileşim için etik analizli chat deneyimi. Bireysel kullanımda, soru–cevap sürecinin etik sınırlarını görünür kılar.",
      href: "/products/standalone",
      icon: "Shield",
    },
    {
      title: "Proxy-Lite",
      description: "Metin ve içerikler için hızlı ve sade etik analiz aracı. Bireysel kullanıcılar ve içerik üreticiler için tasarlanmıştır.",
      href: "/products/proxy-lite",
      icon: "Zap",
    },
    {
      title: "Proxy",
      description: "Kurumsal sistemler için API tabanlı derin etik analiz çözümü. Organizasyon bazlı kullanım ve gelişmiş raporlama sunar.",
      href: "/products/proxy",
      icon: "Globe",
    },
  ],
  panels: [
    {
      title: "Global Ölçekli Paneller",
      description: "Çok uluslu kurumlar ve global operasyonlar için etik izleme ve raporlama panelleri.",
      href: "/panels/global-oversight",
      icon: "Globe",
    },
    {
      title: "Ulusal Regülasyon Panelleri",
      description: "Ulusal düzenleyici kurumlar ve yerel regülasyonlara uyum için özel paneller.",
      href: "/panels/national-regulation",
      icon: "Building2",
    },
    {
      title: "Platform Panel",
      description: "Organizasyon oluşturma, kullanıcı ve yetki yönetimi için merkezi kontrol katmanı. Proxy ve diğer kurumsal panellere erişim buradan tanımlanır.",
      href: "/panels/platform",
      icon: "LayoutGrid",
      note: "Kurumsal kullanım için başlangıç noktası.",
    },
  ],
  modules: [
    {
      title: "Medya & İçerik",
      description: "Haber üretimi, sosyal medya ve reklam & influencer içerikleri için etik kontrol.",
      href: "/solutions/media",
      icon: "Newspaper",
      category: "Medya & İçerik",
      items: ["Haber üretimi", "Sosyal medya", "Reklam & influencer içerikleri"],
    },
    {
      title: "Kurumsal & Operasyonel",
      description: "Kurum içi AI kullanımı, karar destek sistemleri ve iç denetim & risk yönetimi.",
      href: "/solutions/corporate",
      icon: "Briefcase",
      category: "Kurumsal & Operasyonel",
      items: ["Kurum içi AI kullanımı", "Karar destek sistemleri", "İç denetim & risk yönetimi"],
    },
    {
      title: "Regülasyon & Uyum",
      description: "AI Act uyumu, ulusal regülasyonlar ve denetim ve raporlama çözümleri.",
      href: "/panels/eu-ai-act",
      icon: "Scale",
      category: "Regülasyon & Uyum",
      items: ["AI Act uyumu", "Ulusal regülasyonlar", "Denetim ve raporlama"],
    },
    {
      title: "Otonom & Kritik Sistemler",
      description: "Otonom araçlar, sağlık AI'ları ve robotik karar sistemleri için etik değerlendirme.",
      href: "/solutions/autonomous",
      icon: "Car",
      category: "Otonom & Kritik Sistemler",
      items: ["Otonom araçlar", "Sağlık AI'ları", "Robotik karar sistemleri"],
    },
  ],
};

export const sectors = [
  {
    title: "Eğitim",
    description: "Eğitim teknolojilerinde etik kullanım. Öğrenci verilerinin korunması ve adil AI kullanımı.",
    href: "/solutions/education",
    icon: "GraduationCap",
  },
  {
    title: "Bankacılık",
    description: "Finansal hizmetlerde etik AI. Kredi kararlarında adalet ve şeffaflık.",
    href: "/solutions/banking",
    icon: "Landmark",
  },
  {
    title: "Sağlık",
    description: "Sağlık hizmetlerinde etik teknoloji. Hasta gizliliği ve adil tanı destek sistemleri.",
    href: "/solutions/healthcare",
    icon: "Heart",
  },
  {
    title: "Kurumsal",
    description: "Kurumsal AI kullanımında etik standartlar. İşe alım, değerlendirme ve karar süreçleri.",
    href: "/solutions/corporate",
    icon: "Building",
  },
  {
    title: "Otonom",
    description: "Otonom sistemlerde etik yönlendirme. Robotik ve AI karar destek sistemleri için güvenlik.",
    href: "/solutions/autonomous",
    icon: "Car",
  },
  {
    title: "İnsansı Robotlar",
    description: "İnsansı robotlar ile insanlığın etik iletişimi. Saygılı, anlaşılır ve güvenli etkileşim ortamı.",
    href: "/solutions/humanoid-robots",
    icon: "Cpu",
  },
  {
    title: "Medya",
    description: "Medya ve içerik üretiminde etik AI. Deepfake tespiti ve sorumlu içerik oluşturma.",
    href: "/solutions/media",
    icon: "Newspaper",
  },
  {
    title: "Kamu Sektörü",
    description: "Kamu sektöründe etik teknoloji kullanımı. Vatandaş hakları ve şeffaflık.",
    href: "/solutions/public-sector",
    icon: "Scale",
  },
];

export const products = [
  {
    title: "Standalone",
    description: "Bağımsız çalışan etik değerlendirme platformu. Herhangi bir sistemle entegre olmadan, kendi başına etik analiz yapar. Kullanıcı talep ettiğinde etik iyileştirme önerileri sunar.",
    href: "/products/standalone",
    icon: "Shield",
  },
  {
    title: "Proxy",
    description: "API proxy katmanı olarak çalışan etik kontrol sistemi. Tüm istekleri analiz eder, etik riskleri görünür kılar. Kullanıcı talep ettiğinde etik iyileştirme önerileri sunar.",
    href: "/products/proxy",
    icon: "Globe",
  },
  {
    title: "Proxy-Lite",
    description: "Hafif versiyon proxy çözümü. Hızlı analiz ile etik kontrol sağlar, küçük ve orta ölçekli uygulamalar için idealdir.",
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
    answer: "Hayır. EZA bir sansür sistemi değildir. EZA, teknolojinin daha etik davranmasını görünür kılan bir gözlem altyapısıdır. İçeriği otomatik olarak yasaklamaz veya cezalandırmaz. Kullanıcı talep ettiğinde etik iyileştirme önerileri sunabilir, ancak bu öneriler bağlayıcı değildir.",
  },
  {
    question: "EZA doğruluk değil, etik odaklı mı?",
    answer: "Evet. EZA doğruluk kontrolü yapmaz. EZA'nın odak noktası etik davranıştır. Bir içeriğin doğru olup olmadığını değil, etik etkilerini ölçer ve görünür kılar. Kullanıcı talep ettiğinde etik iyileştirme önerileri sunabilir.",
  },
  {
    question: "Hangi sektörler kullanabilir?",
    answer: "EZA, eğitim, bankacılık, sağlık, kurumsal, otonom sistemler, medya ve kamu sektörü dahil olmak üzere birçok sektörde kullanılabilir. Her sektör için özelleştirilmiş etik modüller sunar.",
  },
  {
    question: "Teknoloji nasıl yönlendirilir?",
    answer: "EZA, API proxy katmanı veya standalone mod olarak çalışarak teknolojik sistemleri gözlemler. Etik riskleri tespit eder ve görünür kılar. Kullanıcı talep ettiğinde etik iyileştirme önerileri sunabilir, ancak içeriği otomatik olarak engellemez.",
  },
  {
    question: "Güvenlik ve etik farkı nedir?",
    answer: "Güvenlik, sistemlerin zararlı saldırılara karşı korunmasıdır. Etik ise, teknolojinin insanlara karşı adil, saygılı ve sorumlu bir şekilde davranmasını sağlamaktır. EZA etik odaklıdır ve teknolojinin insanlığa karşı etik davranmasını sağlar.",
  },
];
