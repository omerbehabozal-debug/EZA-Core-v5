/**
 * Result Card Component
 */

'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import ScoreBadge from './ScoreBadge';
import RiskLevelTag from './RiskLevelTag';
import { Button } from '@/components/ui/Button';
import { ProxyLiteResult } from '@/lib/types';

interface ResultCardProps {
  result: ProxyLiteResult;
}

export default function ResultCard({ result }: ResultCardProps) {
  const router = useRouter();
  const score = result.score || 75; // Default score if not provided

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analiz Sonucu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm text-gray-600 mb-2">Etik Skor</p>
            <ScoreBadge score={score} />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm text-gray-600 mb-2">Risk Seviyesi</p>
            <RiskLevelTag level={result.risk_level} />
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Risk Özeti</h4>
            <p className="text-sm text-gray-700">{result.summary}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Öneriler</h4>
            <p className="text-sm text-gray-700">{result.recommendation}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>İhlal Edilen Kural:</span>
            <span className="font-semibold">{result.violated_rule_count}</span>
          </div>
        </div>

        <Button
          onClick={() => router.push('/proxy/login')}
          className="w-full"
          variant="outline"
        >
          Detaylı Proxy Analizine Geç
        </Button>
      </CardContent>
    </Card>
  );
}

