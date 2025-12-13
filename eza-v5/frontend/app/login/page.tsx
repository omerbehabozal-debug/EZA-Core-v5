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

  const handleLogin = () => {
    if (!token.trim()) {
      setError('Please enter a JWT token');
      return;
    }

    if (!role) {
      setError('Please select a role');
      return;
    }

    // Set auth
    setAuth(token.trim(), role);
    setError(null);

    // Redirect based on role
    if (role === 'admin') {
      router.push('/proxy'); // or /corporate
    } else if (role === 'corporate') {
      router.push('/corporate');
    } else if (role === 'regulator') {
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
              Get your JWT token from the backend (e.g., via Swagger or API)
            </p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Role
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
        </div>
      </div>
    </div>
  );
}

