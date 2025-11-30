/**
 * EZA API Client
 * Centralized API client with authentication support
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  body?: any;
  params?: Record<string, string>;
  auth?: boolean; // If true, add JWT token from auth store
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    error_code?: string;
    error_message?: string;
    message?: string;
  };
  [key: string]: any; // Allow other response fields
}

class ApiClient {
  private baseURL: string;
  private wsBaseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
    this.wsBaseURL = process.env.NEXT_PUBLIC_EZA_WS_URL || 'ws://localhost:8000';
  }

  /**
   * Get JWT token from localStorage
   */
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const authData = localStorage.getItem('eza_auth');
      if (!authData) return null;
      
      const parsed = JSON.parse(authData);
      return parsed.token || null;
    } catch {
      return null;
    }
  }

  /**
   * Make HTTP request
   */
  async request<T = any>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { body, params, auth = false, headers = {} } = options;

    // Build URL
    let url = `${this.baseURL}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    // Build headers
    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authentication if required
    if (auth) {
      const token = this.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // Build request config
    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Handle HTTP errors
      if (!response.ok) {
        return {
          ok: false,
          error: {
            error_code: data.error?.error_code || `HTTP_${response.status}`,
            error_message: data.error?.error_message || data.detail || data.message || 'Request failed',
            message: data.error?.message || data.detail || data.message,
          },
        };
      }

      return {
        ok: true,
        ...data,
        data: data.data || data,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: {
          error_code: 'NETWORK_ERROR',
          error_message: error.message || 'Network request failed',
          message: error.message || 'Network request failed',
        },
      };
    }
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, options);
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, options);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Get WebSocket URL with token
   */
  getWebSocketURL(path: string, token?: string | null): string {
    const tokenToUse = token || this.getToken();
    const tokenParam = tokenToUse ? `?token=${encodeURIComponent(tokenToUse)}` : '';
    return `${this.wsBaseURL}${path}${tokenParam}`;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiResponse, RequestOptions };

