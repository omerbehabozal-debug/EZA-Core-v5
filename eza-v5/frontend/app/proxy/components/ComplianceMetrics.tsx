/**
 * Compliance Metrics Component
 * Shows compliance breakdown by policy
 */

"use client";

interface ComplianceMetricsProps {
  policies?: string[];
  complianceScore: number;
}

export default function ComplianceMetrics({ policies, complianceScore }: ComplianceMetricsProps) {
  const policyColors: Record<string, string> = {
    TRT: '#007AFF',
    FINTECH: '#22BF55',
    HEALTH: '#FF9500',
  };

  return (
    <div className="p-6 rounded-xl" style={{ backgroundColor: '#1C1C1E' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: '#E5E5EA' }}>
        Uyumluluk Metrikleri
      </h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: '#8E8E93' }}>Genel Uyum Skoru</span>
            <span className="text-2xl font-bold" style={{ color: complianceScore >= 70 ? '#22BF55' : '#FF9500' }}>
              {complianceScore}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#2C2C2E' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${complianceScore}%`,
                backgroundColor: complianceScore >= 70 ? '#22BF55' : '#FF9500',
              }}
            />
          </div>
        </div>
        
        {policies && policies.length > 0 && (
          <div className="pt-4 border-t" style={{ borderColor: '#2C2C2E' }}>
            <p className="text-sm mb-3" style={{ color: '#8E8E93' }}>Uygulanan Politikalar:</p>
            <div className="flex flex-wrap gap-2">
              {policies.map((policy) => (
                <span
                  key={policy}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${policyColors[policy] || '#6E6E73'}20`,
                    color: policyColors[policy] || '#8E8E93',
                  }}
                >
                  {policy}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

