/**
 * RecommendationCard Component - Action recommendation display
 */

import { CheckCircle, Eye, AlertTriangle } from 'lucide-react';

interface RecommendationCardProps {
  recommendation?: string;
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  if (!recommendation) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-500 text-center py-4">Öneri burada görünecek.</p>
      </div>
    );
  }

  const getRecommendationConfig = (rec: string) => {
    const recLower = rec.toLowerCase();
    
    if (recLower.includes('no action') || recLower.includes('safe') || recLower.includes('standard')) {
      return {
        icon: CheckCircle,
        color: 'green',
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        title: 'Aksiyon Gerekmiyor',
        description: 'İçerik güvenli görünüyor. Standart izleme yeterlidir.',
      };
    }
    
    if (recLower.includes('monitor') || recLower.includes('safeguard')) {
      return {
        icon: Eye,
        color: 'amber',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        title: 'İzleme Önerilir',
        description: 'İçerik izlenmeli ve ek güvenlik önlemleri düşünülmelidir.',
      };
    }
    
    if (recLower.includes('revise') || recLower.includes('block') || recLower.includes('review') || recLower.includes('action required')) {
      return {
        icon: AlertTriangle,
        color: 'red',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        title: 'İçerik Gözden Geçirilmeli',
        description: 'İçerik revize edilmeli veya yayından kaldırılmalıdır.',
      };
    }

    // Default
    return {
      icon: Eye,
      color: 'gray',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      title: 'Değerlendirme Gerekli',
      description: recommendation,
    };
  };

  const config = getRecommendationConfig(recommendation);
  const Icon = config.icon;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${config.border} p-6`}>
      <div className="flex items-center space-x-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.text}`} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{config.description}</p>
    </div>
  );
}

