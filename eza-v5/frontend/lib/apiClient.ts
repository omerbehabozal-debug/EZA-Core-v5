/**
 * EZA API Client
 * Centralized API client with authentication support
 */

import { getApiUrl, getWebSocketUrl } from './apiUrl';

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
    // Always use direct backend URL (no local proxy routes)
    this.baseURL = getApiUrl();
    this.wsBaseURL = getWebSocketUrl();
  }
  
  /**
   * Get full URL for request
   */
  private getRequestUrl(path: string, params?: Record<string, string>): string {
    // Always use full backend URL (direct communication)
    let url = `${this.baseURL}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    return url;
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

    // Build URL (always use direct backend URL)
    const url = this.getRequestUrl(path, params);

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
      // Log API URL for validation (only in production or build)
      if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
        console.log('[API Client] Backend URL:', this.baseURL);
      }
      console.log('API Request:', { method, url, body: body ? JSON.stringify(body).substring(0, 100) : null });
      
      const response = await fetch(url, config);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        return {
          ok: false,
          error: {
            error_code: 'INVALID_RESPONSE',
            error_message: 'Server returned non-JSON response',
            message: text.substring(0, 100),
          },
        };
      }
      
      const data = await response.json();
      console.log('API Response:', { status: response.status, data });

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

      // Backend response format: { ok: true, data: {...}, mode: "...", eza_score: ... }
      // We want to preserve the structure but make data easily accessible
      return {
        ok: true,
        ...data,  // Spread all fields (mode, eza_score, etc.)
        data: data.data,  // Extract the data field (this contains assistant_answer, user_score, etc.)
      };
    } catch (error: any) {
      console.error('API Request Error:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200)
      });
      
      // More specific error messages
      let errorMessage = 'Network request failed';
      if (error.message) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Backend bağlantı hatası. CORS veya network sorunu olabilir.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        ok: false,
        error: {
          error_code: 'NETWORK_ERROR',
          error_message: errorMessage,
          message: errorMessage,
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

