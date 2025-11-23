/**
 * Risk Matrix Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { cn } from '@/lib/utils';
import type { RiskMatrixResponse } from '@/mock/regulator';

interface RiskMatrixProps {
  data: RiskMatrixResponse;
  tenantId?: string;
}

export default function RiskMatrix({ data, tenantId = 'rtuk' }: RiskMatrixProps) {
  const getTenantLabel = (severity: string, likelihood: string, count: number) => {
    if (tenantId === 'rtuk') {
      const severityLabels: Record<string, string> = {
        low: 'Çocuk İçeriği',
        medium: 'Aile İçeriği',
        high: 'Şiddet İçeriği',
      };
      return `${severityLabels[severity] || severity}: ${count} vaka`;
    }
    if (tenantId === 'btk') {
      const severityLabels: Record<string, string> = {
        low: 'İletişim Güvenliği',
        medium: 'Erişim Güvenliği',
        high: 'Veri Güvenliği',
      };
      return `${severityLabels[severity] || severity}: ${count} vaka`;
    }
    if (tenantId === 'eu_ai') {
      const severityLabels: Record<string, string> = {
        low: 'Yüksek Risk Sınıfı',
        medium: 'Kullanım Alanı',
        high: 'Uyumluluk',
      };
      return `${severityLabels[severity] || severity}: ${count} vaka`;
    }
    return `${severity}/${likelihood}: ${count} vaka`;
  };

  const getColorClass = (severity: string, likelihood: string) => {
    if (severity === 'high' || likelihood === 'high') {
      return 'bg-red-500';
    }
    if (severity === 'medium' || likelihood === 'medium') {
      return 'bg-yellow-500';
    }
    return 'bg-green-500';
  };

  const matrix = data.matrix || [];
  const severityLevels = ['low', 'medium', 'high'];
  const likelihoodLevels = ['low', 'medium', 'high'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Matrisi (3x3)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-600">
            <div></div>
            <div className="text-center">Düşük</div>
            <div className="text-center">Orta</div>
            <div className="text-center">Yüksek</div>
          </div>
          {severityLevels.map((severity, rowIdx) => (
            <div key={severity} className="grid grid-cols-4 gap-2">
              <div className="text-xs font-medium text-gray-600 flex items-center">
                {severity === 'low' ? 'Düşük' : severity === 'medium' ? 'Orta' : 'Yüksek'}
              </div>
              {likelihoodLevels.map((likelihood, colIdx) => {
                const cell = matrix[rowIdx]?.[colIdx];
                const count = cell?.count || 0;
                const percentage = cell?.percentage || 0;
                return (
                  <div
                    key={`${severity}-${likelihood}`}
                    className={cn(
                      'p-3 rounded text-center text-white text-xs cursor-help transition-opacity hover:opacity-80',
                      getColorClass(severity, likelihood),
                      count === 0 && 'opacity-50'
                    )}
                    title={getTenantLabel(severity, likelihood, count)}
                  >
                    <div className="font-bold">{count}</div>
                    <div className="text-xs opacity-90">{percentage.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Toplam: <span className="font-semibold">{data.total_cases || 0}</span> vaka
        </div>
      </CardContent>
    </Card>
  );
}
