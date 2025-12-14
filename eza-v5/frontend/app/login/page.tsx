/**
 * Login Page
 * Demo login - paste JWT token and select role
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuth();
  const router = useRouter();

  // Decode JWT token to extract role
  const decodeToken = (token: string): UserRole | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('Invalid token format');
        return null;
      }
      
      // Decode base64 (handle padding)
      let payloadJson = parts[1];
      payloadJson = payloadJson.replace(/-/g, '+').replace(/_/g, '/');
      const padding = 4 - (payloadJson.length % 4);
      if (padding !== 4) {
        payloadJson += '='.repeat(padding);
      }
      
      const payload = JSON.parse(atob(payloadJson));
      const tokenRole = payload.role;
      
      console.log('Decoded token role:', tokenRole);
      
      // Map token role to UserRole type
      // Support all roles: proxy, platform, and legacy
      const validRoles = [
        'admin', 'org_admin', 'ops', 'finance', // Platform roles
        'proxy_user', 'reviewer', 'auditor', // Proxy roles
        'corporate', 'regulator' // Legacy roles
      ];
      
      if (validRoles.includes(tokenRole)) {
        return tokenRole as UserRole;
      }
      console.warn('Unknown role in token:', tokenRole);
      return null;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  };

  const handleLogin = () => {
    if (!token.trim()) {
      setError('Please enter a JWT token');
      return;
    }

    // Try to decode role from token
    const tokenRole = decodeToken(token.trim());
    const finalRole = tokenRole || role;

    console.log('Token role:', tokenRole, 'Selected role:', role, 'Final role:', finalRole);

    if (!finalRole) {
      setError('Could not determine role from token. Please select a role manually.');
      return;
    }

    // Set auth with token role (or fallback to selected role)
    console.log('Setting auth with role:', finalRole);
    setAuth(token.trim(), finalRole);
    setError(null);

    // Redirect based on role
    if (finalRole === 'admin') {
      router.push('/proxy'); // or /corporate
    } else if (finalRole === 'corporate') {
      router.push('/corporate');
    } else if (finalRole === 'regulator') {
      router.push('/regulator');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">EZA Login</h1>
          <p className="text-gray-600">Enter your JWT token and select your role</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
              JWT Token
            </label>
            <textarea
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your JWT token here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
            />
            <p className="mt-1 text-xs text-gray-500">
              Get your JWT token from the backend (e.g., via Swagger or API). 
              Role will be automatically detected from token, or select manually below.
            </p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Role (Fallback - auto-detected from token if available)
            </label>
            <select
              id="role"
              value={role || ''}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="admin">Admin</option>
              <option value="corporate">Corporate</option>
              <option value="regulator">Regulator</option>
            </select>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Login
          </button>

          <div className="text-center text-sm text-gray-500">
            <p>This is a demo login. In production, use proper authentication.</p>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem('eza_auth');
              setToken('');
              setRole('admin');
              setError(null);
              alert('LocalStorage cleared! Please login again.');
            }}
            className="w-full py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-sm"
          >
            Clear Storage & Reset
          </button>
        </div>
      </div>
    </div>
  );
}

