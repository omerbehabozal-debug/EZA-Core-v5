/**
 * AI Audit List Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import RiskLevelTag from '@/app/proxy-lite/components/RiskLevelTag';
import { formatDate } from '@/lib/utils';
import type { CorporateAudit } from '@/lib/types';

interface AiAuditListProps {
  items: CorporateAudit[];
}

export default function AiAuditList({ items }: AiAuditListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Audit Listesi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">AI Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Risk Skoru</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Flags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reviewer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{item.ai_agent}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold">{Math.round(item.risk_score * 100)}%</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      {item.flags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.reviewer}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'approved' ? 'bg-green-100 text-green-800' :
                      item.status === 'flagged' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

