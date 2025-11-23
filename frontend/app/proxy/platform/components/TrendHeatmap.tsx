/**
 * Trend Heatmap Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { cn } from '@/lib/utils';

interface TrendHeatmapProps {
  data: Array<{ hour: number; risk: number }>;
}

export default function TrendHeatmap({ data }: TrendHeatmapProps) {
  // Generate 24 hours grid
  const hours = Array.from({ length: 24 }, (_, i) => {
    const item = data.find(d => d.hour === i);
    return item || { hour: i, risk: 0 };
  });

  const getColor = (risk: number) => {
    if (risk >= 0.8) return 'bg-red-500';
    if (risk >= 0.6) return 'bg-orange-500';
    if (risk >= 0.4) return 'bg-yellow-500';
    if (risk >= 0.2) return 'bg-green-400';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Son 24 Saat Risk Yoğunluğu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-2">
          {hours.map((item, index) => (
            <div
              key={index}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center text-white text-xs font-semibold transition-all hover:scale-110 cursor-pointer',
                getColor(item.risk)
              )}
              title={`Saat ${item.hour}:00 - Risk: ${Math.round(item.risk * 100)}%`}
            >
              {item.hour}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

