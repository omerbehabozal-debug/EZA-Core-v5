/**
 * GET-Only API Client for Finance Panel
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
      this.authToken = localStorage.getItem('finance_token');
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('finance_token', token);
    }
  }

  clearAuthToken() {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('finance_token');
    }
  }

  private checkBlocked(endpoint: string, method: string) {
    // Block non-GET, non-allowed-POST methods
    if (BLOCKED_METHODS.includes(method)) {
      throw new Error(
        `Finans paneli SADECE OKUMA modundadır. ${method} istekleri izin verilmez.`
      );
    }

    // Allow POST only for authentication endpoints
    if (method === 'POST') {
      const isAllowed = ALLOWED_POST_ENDPOINTS.some(allowed =>
        endpoint.includes(allowed)
      );
      if (!isAllowed) {
        throw new Error(
          `Finans paneli SADECE OKUMA modundadır. POST istekleri yalnızca kimlik doğrulama için izin verilir.`
        );
      }
    }

    // Block analyze/proxy/rewrite endpoints
    const isBlocked = BLOCKED_ENDPOINTS.some(blocked => 
      endpoint.includes(blocked)
    );
    
    if (isBlocked) {
      throw new Error(
        `Finans paneli ${endpoint} endpoint'ine erişemez. Bu endpoint engellenmiştir.`
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
export interface FinanceDashboardMetrics {
  ok: boolean;
  metrics: {
    active_financial_institutions: number;
    ai_assisted_decision_volume: {
      total: number;
      daily: Record<string, number>;
      weekly: number;
    };
    high_risk_financial_ai_ratio: number;
    average_ethical_index_finance: number;
    repeated_risk_institutions: number;
    risk_distribution: {
      low: number;
      medium: number;
      high: number;
    };
    risk_categories: Record<string, number>;
    daily_activity_trend: Array<{
      date: string;
      count: number;
    }>;
  };
}

export interface FinanceInstitution {
  organization_id: string;
  institution_name: string;
  institution_type: string;
  ai_system_type: string;
  ai_usage_intensity: string;
  average_ethical_index: number;
  high_risk_frequency: number;
  risk_trend: string;
  last_activity: string | null;
}

export interface FinanceInstitutionsResponse {
  ok: boolean;
  institutions: FinanceInstitution[];
}

export interface FinanceAuditLogEntry {
  id: string;
  timestamp: string | null;
  institution: string;
  ai_system_type: string;
  policy_category: string;
  risk_level: string;
  risk_score: number;
  system_flags: string[];
}

export interface FinanceAuditLogsResponse {
  ok: boolean;
  count: number;
  results: FinanceAuditLogEntry[];
}

export interface FinanceRiskPattern {
  system_name: string;
  system_type: string;
  high_risk_count: number;
  total_events: number;
  institutions_count: number;
  high_risk_ratio: number;
}

export interface FinanceRiskPatternsResponse {
  ok: boolean;
  repeated_high_risk_systems: FinanceRiskPattern[];
  concentration_risks: Array<{
    system_name: string;
    system_type: string;
    institutions_using_count: number;
  }>;
  escalating_advisory_risk: boolean;
  sector_wide_trend: string;
  time_window_days: number;
}

export interface FinanceAlert {
  type: string;
  severity: string;
  description: string;
  recent_count?: number;
  older_count?: number;
  bias_event_count?: number;
  system_name?: string;
  dependency_rate?: number;
  timestamp: string;
}

export interface FinanceAlertsResponse {
  ok: boolean;
  alerts: FinanceAlert[];
  count: number;
}

