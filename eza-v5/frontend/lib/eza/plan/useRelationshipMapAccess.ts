'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchRelationshipMapAccess,
  type RelationshipMapAccessState,
} from '@/lib/eza/plan/fetchRelationshipMapAccess';
import type { RelationshipMapAccess } from '@/lib/eza/plan/tierEntitlements';

export type UseRelationshipMapAccessResult = {
  isLoading: boolean;
  canViewMapData: boolean;
  mapAccess: RelationshipMapAccess;
  cutoffIso: string | null;
  refreshMapAccess: () => Promise<void>;
};

const LOCKED_STATE: RelationshipMapAccessState = {
  status: 'locked',
  access: 'locked',
  cutoffIso: null,
};

export function useRelationshipMapAccess(): UseRelationshipMapAccessResult {
  const [state, setState] = useState<RelationshipMapAccessState>({ status: 'loading' });

  const refreshMapAccess = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const next = await fetchRelationshipMapAccess();
      setState(next);
    } catch {
      setState(LOCKED_STATE);
    }
  }, []);

  useEffect(() => {
    void refreshMapAccess();
  }, [refreshMapAccess]);

  const isLoading = state.status === 'loading';
  const mapAccess: RelationshipMapAccess =
    state.status === 'ready' ? state.access : 'locked';
  const cutoffIso = state.status === 'ready' ? state.cutoffIso : null;
  const canViewMapData = state.status === 'ready' && mapAccess !== 'locked';

  return {
    isLoading,
    canViewMapData,
    mapAccess,
    cutoffIso,
    refreshMapAccess,
  };
}
