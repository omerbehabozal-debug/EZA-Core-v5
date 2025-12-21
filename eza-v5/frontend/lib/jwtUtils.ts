/**
 * JWT Token Utilities
 * Helper functions for JWT token validation and expiry checking
 */

/**
 * Decode JWT token (without verification)
 * Returns payload or null if invalid
 */
export function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
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
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
      return null; // Cannot determine
    }
    
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    
    return exp < now;
  } catch (error) {
    console.error('[JWT] Expiry check error:', error);
    return null;
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

