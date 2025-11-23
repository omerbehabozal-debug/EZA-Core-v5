/**
 * Content Stream Component
 */

import { ContentItem } from '@/lib/types';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/ui/button';
import RiskLevelTag from '@/app/proxy-lite/components/RiskLevelTag';
import { formatDate } from '@/lib/utils';

interface ContentStreamProps {
  items: ContentItem[];
  onAnalyze: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

export default function ContentStream({ items, onAnalyze, onLoadMore, hasMore }: ContentStreamProps) {
  return (
    <Card>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">{item.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatDate(item.timestamp)}</span>
                    <span>Skor: {item.score}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RiskLevelTag level={item.risk_level} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAnalyze(item.id)}
                  >
                    Detaylı Analiz
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={onLoadMore}>
                Daha Fazla Yükle
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

