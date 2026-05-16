'use client';

import { AlertCircle } from 'lucide-react';
import { formatGovernanceError } from '@/lib/governance/display';

export default function GovernanceErrorState({ error }: { error: unknown }) {
  const { title, description } = formatGovernanceError(error);

  return (
    <div
      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-red-800/90">{description}</p>
      </div>
    </div>
  );
}
