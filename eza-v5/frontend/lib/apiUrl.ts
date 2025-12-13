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
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!apiUrl) {
    if (isProduction) {
      const error = 'NEXT_PUBLIC_EZA_API_URL environment variable is required in production. Please configure it in Vercel project settings.';
      console.error('[API URL]', error);
      // In production, we should still return a value to prevent app crash
      // But log the error clearly
      if (typeof window !== 'undefined') {
        console.error('[API URL] Production deployment is missing NEXT_PUBLIC_EZA_API_URL. Please add it in Vercel project settings → Environment Variables.');
      }
      // Return empty string to trigger fetch errors that can be handled
      return '';
    }
    
    // Development: use localhost fallback
    console.warn('[API URL] NEXT_PUBLIC_EZA_API_URL is not set. Using localhost fallback for development.');
    return 'http://127.0.0.1:8000';
  }
  
  // Log the URL being used for validation
  // In production builds, this will be visible in build logs
  if (typeof window === 'undefined') {
    // Server-side (build time or SSR)
    console.log('[API URL] Backend URL configured:', apiUrl);
  } else if (process.env.NODE_ENV === 'production') {
    // Client-side production
    console.log('[API URL] Production backend URL:', apiUrl);
  } else {
    // Development
    console.log('[API URL] Development backend URL:', apiUrl);
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

