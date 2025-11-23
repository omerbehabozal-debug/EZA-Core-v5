/**
 * Tenant Store (Zustand)
 */

import { create } from 'zustand';
import { TenantConfig, getTenant, defaultTenant } from './tenant';

interface TenantState {
  currentTenantId: string | null;
  setTenant: (id: string) => void;
  getTenant: () => TenantConfig;
}

export const useTenantStore = create<TenantState>()((set, get) => ({
  currentTenantId: null,
  setTenant: (id: string) => {
    set({ currentTenantId: id });
  },
  getTenant: () => {
    const state = get();
    const tenantId = state.currentTenantId || defaultTenant.id;
    return getTenant(tenantId);
  },
}));

