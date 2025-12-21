/**
 * JWT Token Utilities
 * Helper functions for JWT token validation and expiry checking
 */

/**
 * Decode JWT token (without verification)
 * Returns payload or null if invalid
 */
export function decodeJWT(token: string): any | null {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return null;
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    if (!payload || payload.trim() === '') {
      return null;
    }
    
    // Base64 decode with padding handling
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[JWT] Decode error:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * Returns true if expired, false if valid, null if cannot determine
 */
export function isTokenExpired(token: string): boolean | null {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return true; // No token = expired
  }
  
  try {
    const payload = decodeJWT(token);
    if (!payload) {
      return true; // Cannot decode = treat as expired for safety
    }
    
    if (!payload.exp || typeof payload.exp !== 'number') {
      return null; // Cannot determine expiry
    }
    
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    
    // Add 5 second buffer to account for clock skew
    return exp < (now + 5);
  } catch (error) {
    console.error('[JWT] Expiry check error:', error);
    // On error, treat as expired for safety
    return true;
  }
}

/**
 * Get token expiry time in milliseconds
 * Returns null if cannot determine
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
      return null;
    }
    
    return payload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    console.error('[JWT] Get expiry error:', error);
    return null;
  }
}

