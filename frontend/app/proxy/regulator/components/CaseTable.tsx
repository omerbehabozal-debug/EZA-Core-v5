/**
 * Case Table Component
 */

import { Button } from '@/components/ui';
import type { RegulatorCase } from '@/mock/regulator';

interface CaseTableProps {
  cases: RegulatorCase[];
  onReview: (caseId: string) => void;
}

export default function CaseTable({ cases, onReview }: CaseTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">İçerik ID</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Risk Skoru</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">EU AI Sınıfı</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Son Durum</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((caseItem) => (
            <tr key={caseItem.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{caseItem.content_id}</td>
              <td className="px-4 py-3 text-sm">
                <span className="font-semibold">{Math.round(caseItem.risk_score * 100)}%</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{caseItem.eu_ai_class}</td>
              <td className="px-4 py-3 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  caseItem.status === 'approved' ? 'bg-green-100 text-green-800' :
                  caseItem.status === 'flagged' ? 'bg-red-100 text-red-800' :
                  caseItem.status === 'reviewed' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {caseItem.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReview(caseItem.id)}
                >
                  İncele
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

