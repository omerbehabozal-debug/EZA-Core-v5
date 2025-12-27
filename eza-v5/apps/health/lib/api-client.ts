/**
 * GET-Only API Client for Health Panel
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
  '/api/auth/password-reset-request',
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
      this.authToken = localStorage.getItem('health_token');
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('health_token', token);
    }
  }

  clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('health_token');
    }
  }

  private checkBlocked(endpoint: string, method: string) {
    // Block non-GET, non-allowed-POST methods
    if (BLOCKED_METHODS.includes(method)) {
      throw new Error(
        `Sağlık paneli SADECE OKUMA modundadır. ${method} istekleri izin verilmez.`
      );
    }

    // Allow POST only for authentication endpoints
    if (method === 'POST') {
      const isAllowed = ALLOWED_POST_ENDPOINTS.some(allowed =>
        endpoint.includes(allowed)
      );
      if (!isAllowed) {
        throw new Error(
          `Sağlık paneli SADECE OKUMA modundadır. POST istekleri yalnızca kimlik doğrulama için izin verilir.`
        );
      }
    }

    // Block analyze/proxy/rewrite endpoints
    const isBlocked = BLOCKED_ENDPOINTS.some(blocked => 
      endpoint.includes(blocked)
    );
    
    if (isBlocked) {
      throw new Error(
        `Sağlık paneli ${endpoint} endpoint'ine erişemez. Bu endpoint engellenmiştir.`
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
          `API isteği başarısız: ${response.status} ${response.statusText}. ${errorText}`
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ağ hatası: ${String(error)}`);
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
export interface HealthDashboardMetrics {
  ok: boolean;
  metrics: {
    active_health_institutions: number;
    clinical_ai_systems_observed: number;
    fail_safe_trigger_count: number;
    high_risk_clinical_events: number;
    average_ethical_index_health: number;
    risk_distribution: {
      low: number;
      medium: number;
      high: number;
    };
    clinical_risk_categories: Record<string, number>;
    fail_safe_frequency: Array<{
      date: string;
      count: number;
    }>;
  };
}

export interface HealthInstitution {
  organization_id: string;
  institution_name: string;
  ai_system_type: string;
  clinical_usage_intensity: string;
  fail_safe_rate: number;
  average_ethical_index: number;
  risk_trend: string;
  last_activity: string | null;
}

export interface HealthInstitutionsResponse {
  ok: boolean;
  institutions: HealthInstitution[];
}

export interface HealthAuditLogEntry {
  id: string;
  timestamp: string | null;
  institution: string;
  ai_system_type: string;
  risk_category: string;
  risk_level: string;
  risk_score: number;
  fail_safe_triggered: string;
}

export interface HealthAuditLogsResponse {
  ok: boolean;
  count: number;
  results: HealthAuditLogEntry[];
}

export interface HealthRiskPattern {
  system_name: string;
  system_type: string;
  unsafe_guidance_count: number;
  total_events: number;
  unsafe_ratio: number;
}

export interface HealthRiskPatternsResponse {
  ok: boolean;
  repeated_unsafe_guidance: HealthRiskPattern[];
  fail_safe_delays: Array<{
    organization_id: string;
    organization_name: string;
    delay_count: number;
  }>;
  rising_risk_institutions: Array<{
    organization_id: string;
    organization_name: string;
    high_risk_event_count: number;
  }>;
  time_window_days: number;
}

export interface HealthAlert {
  type: string;
  severity: string;
  description: string;
  fail_safe_count?: number;
  fail_safe_rate?: number;
  high_risk_count?: number;
  high_risk_rate?: number;
  timestamp: string;
}

export interface HealthAlertsResponse {
  ok: boolean;
  alerts: HealthAlert[];
  count: number;
}

