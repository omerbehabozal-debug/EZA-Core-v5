/**
 * API Key Card Component
 */

import { ApiKey } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { Copy, Trash2, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApiKeyCardProps {
  apiKeys: ApiKey[];
  onGenerate: () => void;
  onRevoke: (id: string) => void;
  onCopy: (key: string) => void;
}

export default function ApiKeyCard({ apiKeys, onGenerate, onRevoke, onCopy }: ApiKeyCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>API Keys</CardTitle>
          <Button onClick={onGenerate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Generate New Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{key.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {key.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="font-mono text-xs bg-white px-2 py-1 rounded border">
                    {key.key.substring(0, 20)}...
                  </p>
                  <p>Created: {formatDate(key.created_at)}</p>
                  {key.last_used && <p>Last used: {formatDate(key.last_used)}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(key.key)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevoke(key.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

