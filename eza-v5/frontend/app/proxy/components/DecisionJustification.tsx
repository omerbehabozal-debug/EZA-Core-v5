/**
 * Decision Justification Layer Component
 * Tree structure showing violations, policies, evidence, and severity
 */

"use client";

interface JustificationItem {
  violation: string;
  policy: string;
  evidence: string;
  severity: number;
}

interface DecisionJustificationProps {
  justification: JustificationItem[];
}

export default function DecisionJustification({ justification }: DecisionJustificationProps) {
  const getSeverityColor = (severity: number) => {
    if (severity >= 0.7) return '#E84343'; // High
    if (severity >= 0.4) return '#FF9500'; // Medium
    return '#22BF55'; // Low
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 0.7) return 'Yüksek';
    if (severity >= 0.4) return 'Orta';
    return 'Düşük';
  };

  if (!justification || justification.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm" style={{ color: '#8E8E93' }}>
          Karar gerekçesi bulunmuyor
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {justification.map((item, idx) => (
        <div
          key={idx}
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1C1C1E',
            border: '1px solid #2C2C2E',
          }}
        >
          {/* Violation */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getSeverityColor(item.severity) }}
            />
            <h4 className="text-base font-semibold" style={{ color: '#E5E5EA' }}>
              İhlal: {item.violation}
            </h4>
          </div>

          {/* Policy */}
          <div className="ml-4 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8E8E93' }}>↳</span>
              <span className="text-sm" style={{ color: '#E5E5EA' }}>
                Politika: <span className="font-medium">{item.policy}</span>
              </span>
            </div>
          </div>

          {/* Evidence */}
          <div className="ml-4 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8E8E93' }}>↳</span>
              <span className="text-sm" style={{ color: '#E5E5EA' }}>
                Kanıt: <span className="italic">{item.evidence}</span>
              </span>
            </div>
          </div>

          {/* Severity */}
          <div className="ml-4">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8E8E93' }}>↳</span>
              <span className="text-sm" style={{ color: '#8E8E93' }}>
                Şiddet: <span className="font-bold" style={{ color: getSeverityColor(item.severity) }}>
                  %{(item.severity * 100).toFixed(0)} ({getSeverityLabel(item.severity)})
                </span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

