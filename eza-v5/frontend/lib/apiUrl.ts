/**
 * API URL Configuration
 * Ensures NEXT_PUBLIC_EZA_API_URL is always used in production
 * No localhost fallbacks allowed
 */

/**
 * Get the API base URL from environment variables
 * Throws error if not set in production
 */
export function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_EZA_API_URL;
  
  if (!apiUrl) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      const error = 'NEXT_PUBLIC_EZA_API_URL environment variable is required in production';
      console.error('[API URL]', error);
      throw new Error(error);
    }
    
    // Development: warn but don't throw
    console.warn('[API URL] NEXT_PUBLIC_EZA_API_URL is not set. This will fail in production.');
    throw new Error('NEXT_PUBLIC_EZA_API_URL environment variable is required');
  }
  
  // Log the URL being used for validation
  // In production builds, this will be visible in build logs
  if (typeof window === 'undefined') {
    // Server-side (build time or SSR)
    console.log('[API URL] Backend URL configured:', apiUrl);
  } else if (process.env.NODE_ENV === 'production') {
    // Client-side production
    console.log('[API URL] Production backend URL:', apiUrl);
  }
  
  return apiUrl;
}

/**
 * Get the WebSocket base URL from environment variables
 */
export function getWebSocketUrl(): string {
  const wsUrl = process.env.NEXT_PUBLIC_EZA_WS_URL;
  
  if (!wsUrl) {
    // Derive from API URL if WS URL not set
    const apiUrl = getApiUrl();
    // Convert http:// to ws:// and https:// to wss://
    return apiUrl.replace(/^http/, 'ws');
  }
  
  return wsUrl;
}

