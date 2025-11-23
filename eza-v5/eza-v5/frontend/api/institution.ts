/**
 * Institution API Client
 */

import { apiRequest } from "./api_client";

export interface InstitutionCreateRequest {
  name: string;
  code?: string;
  domain?: string;
}

export interface InstitutionResponse {
  id: number;
  name: string;
  code?: string;
  domain?: string;
  is_active: boolean;
}

export function createInstitution(
  name: string,
  code?: string,
  domain?: string
): Promise<InstitutionResponse> {
  return apiRequest<InstitutionResponse>("/api/institution/", "POST", {
    name,
    code,
    domain,
  });
}

export function listInstitutions(): Promise<InstitutionResponse[]> {
  return apiRequest<InstitutionResponse[]>("/api/institution/", "GET");
}

