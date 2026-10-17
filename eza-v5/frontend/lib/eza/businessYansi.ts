import { getApiUrl } from '@/lib/apiUrl';
import { getAuthToken } from '@/lib/eza/authTokenStore';

export type Business = { id: string; name: string; slug: string; description: string; logo_url: string | null; verified: boolean; official: boolean; status: string };
export type Knowledge = { id: string; item_id: string; title: string; category: string; content: string; source: string; public_allowed: boolean; status: string; version: number; revision: number };
export type Step = { question: string; answer: string; sources: string[] };
export type Draft = { id: string; title: string; summary: string; steps: Step[]; status: string; revision: number; conversation_id: string | null };
export type Publication = { slug: string; journey_version: number; visibility?: string };
export type BrandApplication = {
  id: string;
  brand_name: string;
  contact_name: string;
  corporate_email: string;
  website: string | null;
  company_info: string;
  status: 'received' | 'under_review' | 'approved' | 'rejected' | string;
  reviewer_note: string;
  business_id: string | null;
};
export async function businessRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Business yönetimi için giriş yapmalısın.');
  const response = await fetch(getApiUrl().replace(/\/$/, '') + '/api/business-yansi' + path, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail?.code || data?.detail?.reason || `İşlem tamamlanamadı (${response.status}).`);
  }
  return response.json();
}
