/**
 * Authentication utilities
 */

import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface LoginCredentials {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  expires_in: number;
}

export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
}

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    `${API_URL}/api/auth/login`,
    credentials
  );
  
  // Store token
  Cookies.set('access_token', response.data.access_token, {
    expires: response.data.expires_in / 86400, // Convert seconds to days
    secure: true,
    sameSite: 'strict'
  });
  
  Cookies.set('user_role', response.data.role, {
    expires: response.data.expires_in / 86400,
    secure: true,
    sameSite: 'strict'
  });
  
  return response.data;
}

export function logout(): void {
  Cookies.remove('access_token');
  Cookies.remove('user_role');
}

export function getToken(): string | undefined {
  return Cookies.get('access_token');
}

export function getRole(): string | undefined {
  return Cookies.get('user_role');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getRedirectPath(role: string): string {
  switch (role) {
    case 'public_user':
    case 'corporate_client':
      return '/standalone';
    case 'institution_auditor':
      return '/proxy-lite';
    case 'eza_internal':
      return '/proxy';
    case 'admin':
      return '/admin';
    default:
      return '/standalone';
  }
}

