/**
 * RiskResultCard Component - Risk level display card
 */

import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface RiskResultCardProps {
  riskLevel?: string;
  riskCategory?: string;
  violatedRuleCount?: number;
  summary?: string;
}

export default function RiskResultCard({ riskLevel, riskCategory, violatedRuleCount, summary }: RiskResultCardProps) {
  if (!riskLevel) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-500 text-center py-4">Risk analizi sonuçları burada görünecek.</p>
      </div>
    );
  }

  const getRiskConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical':
      case 'high':
        return {
          color: 'red',
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: XCircle,
          label: 'Yüksek Risk',
        };
      case 'medium':
        return {
          color: 'amber',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          icon: AlertCircle,
          label: 'Orta Risk',
        };
      default:
        return {
          color: 'green',
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: CheckCircle,
          label: 'Düşük Risk',
        };
    }
  };

  const config = getRiskConfig(riskLevel);
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${config.border} p-6`}>
      <div className="flex items-center space-x-4 mb-4">
        <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${config.text}`} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{config.label}</h2>
          <p className="text-sm text-gray-500">Risk Seviyesi</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">Kategori:</span>
          <span className="text-sm font-medium text-gray-900 capitalize">
            {riskCategory?.replace('_', ' ') || 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">İhlal Sayısı:</span>
          <span className="text-sm font-medium text-gray-900">{violatedRuleCount || 0}</span>
        </div>

        {summary && (
          <div className="pt-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Özet</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

