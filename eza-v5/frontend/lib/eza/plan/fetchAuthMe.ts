/**
 * Sprint 2 — fetch authenticated user profile + Mirror entitlement.
 */

import { apiClient } from '@/lib/apiClient';
import type { PlanId } from '@/lib/eza/plan/planStore';

export type AuthMeResponse = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan: PlanId;
};

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me', { auth: true });
  if (!res.ok) return null;
  const mirrorPlan = res.mirror_plan ?? res.data?.mirror_plan;
  if (!mirrorPlan) return null;
  return {
    user_id: res.user_id ?? res.data?.user_id ?? '',
    email: res.email ?? res.data?.email ?? '',
    role: res.role ?? res.data?.role ?? '',
    mirror_plan: mirrorPlan === 'plus' ? 'plus' : 'free',
  };
}
