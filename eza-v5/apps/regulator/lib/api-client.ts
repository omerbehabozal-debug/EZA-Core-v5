/**
 * GET-Only API Client for Regulator Panel
 * 
 * CRITICAL: This client ONLY allows GET requests.
 * All POST/PATCH/DELETE requests are blocked at runtime.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Blocked endpoints (analyze, proxy, rewrite, API key management)
const BLOCKED_ENDPOINTS = [
  '/api/analyze',
  '/api/proxy/analyze',
  '/api/proxy/rewrite',
  '/api/rewrite',
  '/proxy/analyze',
  '/proxy/rewrite',
  '/api/keys',
  '/api/api-keys',
  '/api/organizations',
];

// Allowed POST endpoints (authentication only)
const ALLOWED_POST_ENDPOINTS = [
  '/api/auth/login',
  '/api/production/auth/password-reset-request',
];

// Blocked methods (except for allowed POST endpoints)
const BLOCKED_METHODS = ['PATCH', 'PUT', 'DELETE'];

interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

class GetOnlyApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Get token from localStorage (set by auth)
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('regulator_token');
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('regulator_token', token);
    }
  }

  clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('regulator_token');
    }
  }

  private checkBlocked(endpoint: string, method: string) {
    // Block non-GET, non-allowed-POST methods
    if (BLOCKED_METHODS.includes(method)) {
      throw new Error(
        `Regulator panel is READ-ONLY. ${method} requests are not allowed.`
      );
    }

    // Allow POST only for authentication endpoints
    if (method === 'POST') {
      const isAllowed = ALLOWED_POST_ENDPOINTS.some(allowed =>
        endpoint.includes(allowed)
      );
      if (!isAllowed) {
        throw new Error(
          `Regulator panel is READ-ONLY. POST requests are only allowed for authentication endpoints.`
        );
      }
    }

    // Block analyze/proxy/rewrite endpoints
    const isBlocked = BLOCKED_ENDPOINTS.some(blocked => 
      endpoint.includes(blocked)
    );
    
    if (isBlocked) {
      throw new Error(
        `Regulator panel cannot access ${endpoint}. This endpoint is blocked for regulators.`
      );
    }
  }

  async request<T>(
    endpoint: string,
    options: ApiClientOptions = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    
    // Runtime enforcement: Block non-GET methods
    this.checkBlocked(endpoint, method);

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    // GET requests don't need body
    if (method === 'GET' && options.body) {
      console.warn('GET request with body is unusual. Body will be ignored.');
    }

    // POST requests (only for auth) can have body
    if (method === 'POST' && options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Network error: ${String(error)}`);
    }
  }

  // Convenience method for GET requests
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }
}

// Singleton instance
export const apiClient = new GetOnlyApiClient();

// Export types
export interface AuditLogSearchParams {
  org_id?: string;
  from_date?: string;
  to_date?: string;
  risk_level?: 'low' | 'medium' | 'high';
  flag?: string;
}

export interface CoverageSummary {
  ok: boolean;
  independent_sources: number;
  organizations: number;
  ai_system_types: number;
  ai_modalities: Record<string, number>;
  data_origins: Record<string, number>;
}

export interface AuditLogEntry {
  id: string;
  type: 'IntentLog' | 'ImpactEvent';
  created_at: string;
  sector?: string;
  risk_scores?: Record<string, number>;
  organization_id: string;
  flags?: any;
}

export interface AuditSearchResponse {
  ok: boolean;
  count: number;
  results: AuditLogEntry[];
}

