/**
 * Risk Matrix Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { cn } from '@/lib/utils';

interface RiskMatrixProps {
  data: Array<{ x: number; y: number; value: number; label: string }>;
  tenantId?: string;
}

export default function RiskMatrix({ data, tenantId = 'rtuk' }: RiskMatrixProps) {
  // Tenant-specific tooltip labels
  const getTenantLabel = (x: number, y: number, value: number, defaultLabel: string) => {
    if (tenantId === 'rtuk') {
      const labels = ['Çocuk İçeriği', 'Aile İçeriği', 'Şiddet İçeriği'];
      return `${labels[x] || 'Risk'}: ${Math.round(value * 100)}%`;
    }
    if (tenantId === 'btk') {
      const labels = ['İletişim Güvenliği', 'Erişim Güvenliği', 'Veri Güvenliği'];
      return `${labels[x] || 'Risk'}: ${Math.round(value * 100)}%`;
    }
    if (tenantId === 'eu_ai') {
      const labels = ['Yüksek Risk Sınıfı', 'Kullanım Alanı', 'Uyumluluk'];
      return `${labels[x] || 'Risk'}: ${Math.round(value * 100)}%`;
    }
    return defaultLabel || `Risk: ${Math.round(value * 100)}%`;
  };
  // Generate 3x3 grid
  const grid = Array.from({ length: 9 }, (_, i) => {
    const x = Math.floor(i / 3);
    const y = i % 3;
    const item = data.find(d => d.x === x && d.y === y);
    return item || { x, y, value: 0, label: '' };
  });

  const getColor = (value: number) => {
    if (value >= 0.8) return 'bg-red-500';
    if (value >= 0.6) return 'bg-orange-500';
    if (value >= 0.4) return 'bg-yellow-500';
    if (value >= 0.2) return 'bg-green-400';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Matrisi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {grid.map((item, index) => (
            <div
              key={index}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center text-white text-xs font-semibold transition-all hover:scale-110 cursor-pointer',
                getColor(item.value)
              )}
              title={getTenantLabel(item.x, item.y, item.value, item.label)}
            >
              {item.value > 0 ? Math.round(item.value * 100) : ''}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

