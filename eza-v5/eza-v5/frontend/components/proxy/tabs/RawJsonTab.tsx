/**
 * Raw JSON Tab
 */

'use client';

import { FullPipelineDebugResponse } from '@/api/internal_proxy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

interface RawJsonTabProps {
  data: FullPipelineDebugResponse;
}

export default function RawJsonTab({ data }: RawJsonTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Full Response (JSON)</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto border border-gray-200 max-h-[600px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

