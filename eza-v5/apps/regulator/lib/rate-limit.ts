/**
 * Client-Side Rate Limiting for Login
 * 
 * Brute force protection - max 5 failed attempts
 * Resets after 15 minutes
 */

const MAX_ATTEMPTS = 5;
const RESET_TIME_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitState {
  attempts: number;
  resetTime: number;
}

function getRateLimitKey(email: string): string {
  return `regulator_login_attempts_${email}`;
}

export function checkRateLimit(email: string): { allowed: boolean; remainingAttempts: number } {
  if (typeof window === 'undefined') {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const key = getRateLimitKey(email);
  const stored = localStorage.getItem(key);

  if (!stored) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  try {
    const state: RateLimitState = JSON.parse(stored);
    const now = Date.now();

    // Check if reset time has passed
    if (now > state.resetTime) {
      localStorage.removeItem(key);
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check if max attempts reached
    if (state.attempts >= MAX_ATTEMPTS) {
      return { allowed: false, remainingAttempts: 0 };
    }

    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - state.attempts,
    };
  } catch {
    // Invalid stored data, reset
    localStorage.removeItem(key);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }
}

export function recordFailedAttempt(email: string): void {
  if (typeof window === 'undefined') return;

  const key = getRateLimitKey(email);
  const stored = localStorage.getItem(key);
  const now = Date.now();

  let state: RateLimitState;
  if (stored) {
    try {
      state = JSON.parse(stored);
      // Reset if time has passed
      if (now > state.resetTime) {
        state = { attempts: 0, resetTime: now + RESET_TIME_MS };
      }
    } catch {
      state = { attempts: 0, resetTime: now + RESET_TIME_MS };
    }
  } else {
    state = { attempts: 0, resetTime: now + RESET_TIME_MS };
  }

  state.attempts += 1;
  localStorage.setItem(key, JSON.stringify(state));
}

export function clearRateLimit(email: string): void {
  if (typeof window === 'undefined') return;
  const key = getRateLimitKey(email);
  localStorage.removeItem(key);
}

