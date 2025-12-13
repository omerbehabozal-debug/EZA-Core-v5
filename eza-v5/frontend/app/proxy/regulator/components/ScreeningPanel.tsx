/**
 * Screening Panel Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/ui';
import type { RegulatorCase } from '@/mock/regulator';

interface ScreeningPanelProps {
  caseItem: RegulatorCase | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onWarning: (id: string) => void;
  onRemove: (id: string) => void;
  onReport: (id: string) => void;
}

export default function ScreeningPanel({
  caseItem,
  onClose,
  onApprove,
  onWarning,
  onRemove,
  onReport,
}: ScreeningPanelProps) {
  if (!caseItem) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>İçerik İnceleme</CardTitle>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Model Output</h4>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
              {caseItem.content_preview || caseItem.content_id}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Risk Skoru:</span>
                <span className="font-semibold">{Math.round(caseItem.risk_score * 100)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">EU AI Sınıfı:</span>
                <span className="font-semibold">{caseItem.eu_ai_class}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Policy Violations</h4>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">İhlal tespit edildi</p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onApprove(caseItem.id)}
              className="flex-1"
            >
              Uygun
            </Button>
            <Button
              variant="outline"
              onClick={() => onWarning(caseItem.id)}
              className="flex-1"
            >
              Uyarı
            </Button>
            <Button
              variant="outline"
              onClick={() => onRemove(caseItem.id)}
              className="flex-1"
            >
              Kaldır
            </Button>
            <Button
              onClick={() => onReport(caseItem.id)}
              className="flex-1"
            >
              Rapor Oluştur
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

