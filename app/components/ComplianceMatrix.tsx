import Section from "./Section";
import FadeIn from "./FadeIn";

interface ComplianceItem {
  regulation: string;
  requirement: string;
  eza: string;
}

const complianceData: ComplianceItem[] = [
  {
    regulation: "AB AI Act",
    requirement: "Risk Yönetimi • Güvenli Yanıt Üretimi • İnsan gözetimi • Zararlı içerik önleme",
    eza: "Policy Engine • Output Analyzer • Behavioral Safety Engine • Standalone Alignment Layer",
  },
  {
    regulation: "NIST AI RMF",
    requirement: "Identify • Govern • Map • Measure • Manage risk yaklaşımı",
    eza: "Input Analyzer • Model Router • Behavioral Monitoring • Risk Scoring Pipeline",
  },
  {
    regulation: "ISO/IEC 23053",
    requirement: "AI Governance Framework • Süreç yönetimi • Sistem davranış tutarlılığı",
    eza: "Core Safety Pipeline • Multi-Turn Stability Tests • Alignment Supervisor",
  },
  {
    regulation: "ISO/IEC 42001",
    requirement: "AI Management System • Veri güvenliği • Süreç şeffaflığı",
    eza: "Security Layer • Logging/Tracing • Policy Violation Reports",
  },
  {
    regulation: "OECD AI Principles",
    requirement: "Adalet • Hesap verebilirlik • Güvenilirlik • Şeffaflık",
    eza: "Behavioral Engine • Redirect/Safe Rewrite • Explainability Block",
  },
  {
    regulation: "RTÜK / BTK Standartları",
    requirement: "Ulusal içerik güvenliği • Zararlı içerik tespiti • Erişim güvenliği",
    eza: "Content Safety Layer • Compliance Filters • Proxy-Lite Regulator Panel",
  },
];

// Compliance Matrix Row Component
function ComplianceRow({ item, index }: { item: ComplianceItem; index: number }) {
  return (
    <tr
      className={`
        border-b border-gray-100 last:border-0
        transition-all duration-300
        hover:shadow-md hover:bg-[#f9fbff]
        ${index % 2 === 0 ? "bg-[#fafcff]" : "bg-[#f5f7fb]"}
        opacity-0 translate-y-4
        animate-fade-in-up
      `}
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: "forwards",
      }}
    >
      <td className="px-6 py-5 text-sm font-semibold text-eza-text">
        {item.regulation}
      </td>
      <td className="px-6 py-5 text-sm text-eza-text-secondary leading-relaxed">
        {item.requirement}
      </td>
      <td className="px-6 py-5 text-sm text-eza-text-secondary leading-relaxed">
        {item.eza}
      </td>
    </tr>
  );
}

export default function ComplianceMatrix() {
  return (
    <Section className="bg-white">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-eza-text mb-4 relative pb-4">
              Regülasyon Uyum Matrisi
              <span 
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-0.5"
                style={{
                  width: "80px",
                  background: "linear-gradient(90deg, #5b8bff, #8fc5ff)",
                }}
              ></span>
            </h2>
            <p className="text-lg text-eza-text-secondary max-w-3xl mx-auto leading-relaxed">
              EZA'nın çekirdek güvenlik mimarisi, uluslararası yapay zekâ standartları ve yerel regülasyonların gerektirdiği güvenlik, yönetişim ve risk yönetimi süreçleriyle doğrudan eşleşecek şekilde tasarlanmıştır.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200/70 bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-eza-blue/5 to-eza-blue/10 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-bold text-eza-text uppercase tracking-wider">
                    Regülasyon / Standart
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-eza-text uppercase tracking-wider">
                    Gereksinim
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-eza-text uppercase tracking-wider">
                    EZA Modülü / Motor
                  </th>
                </tr>
              </thead>
              <tbody>
                {complianceData.map((item, index) => (
                  <ComplianceRow key={item.regulation} item={item} index={index} />
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}

