/**
 * Risk Flags Component
 * Displays unique flags and risk locations
 */

"use client";

import { RiskLocation } from "@/api/proxy_corporate";

interface RiskFlagsProps {
  flags: string[];
  riskLocations: RiskLocation[];
}

export default function RiskFlags({ flags, riskLocations }: RiskFlagsProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#E84343';
      case 'medium': return '#FF9500';
      case 'low': return '#FFCC00';
      default: return '#8E8E93';
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ethical: '#007AFF',
      compliance: '#22BF55',
      manipulation: '#FF9500',
      bias: '#AF52DE',
      legal: '#E84343',
    };
    return colors[type] || '#8E8E93';
  };

  return (
    <div className="space-y-6">
      {/* Flags */}
      {flags.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ color: '#E5E5EA' }}>
            Etik Bulgular ({flags.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {flags.map((flag, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{
                  backgroundColor: '#2C2C2E',
                  color: '#E5E5EA',
                  border: '1px solid #3A3A3C',
                }}
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk Locations */}
      {riskLocations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3" style={{ color: '#E5E5EA' }}>
            Risk Lokasyonları ({riskLocations.length})
          </h3>
          <div className="space-y-2">
            {riskLocations.map((location, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg flex items-center justify-between"
                style={{
                  backgroundColor: '#2C2C2E',
                  border: `1px solid ${getSeverityColor(location.severity)}40`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${getTypeColor(location.type)}20`,
                      color: getTypeColor(location.type),
                    }}
                  >
                    {location.type}
                  </span>
                  <span className="text-sm" style={{ color: '#8E8E93' }}>
                    Pozisyon: {location.start}-{location.end}
                  </span>
                </div>
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${getSeverityColor(location.severity)}20`,
                    color: getSeverityColor(location.severity),
                  }}
                >
                  {location.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

