/**
 * Platform Register Page
 * First-time admin user registration (bootstrap mode)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'https://eza-core-v5-production.up.railway.app';

export default function PlatformRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuth();
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          role: 'admin',
          full_name: fullName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const data = await response.json();
      
      // Validate response
      if (!data.access_token || !data.role) {
        throw new Error('Invalid response from server');
      }

      // Check if role is allowed for platform
      const platformRoles = ['admin', 'org_admin', 'ops', 'finance', 'auditor'];
      if (!platformRoles.includes(data.role)) {
        throw new Error(`Access denied. Platform requires one of: ${platformRoles.join(', ')}`);
      }

      // Set auth in context
      setAuth(data.access_token, data.role);
      
      // Redirect to platform
      router.push('/platform');
    } catch (err: any) {
      console.error('Register error:', err);
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0B0E14' }}
    >
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#F1F5F9' }}>
            EZA Platform
          </h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Create Admin Account
          </p>
        </div>

        {/* Register Form */}
        <div 
          className="rounded-lg p-8 shadow-xl"
          style={{ backgroundColor: '#181F2B' }}
        >
          <form onSubmit={handleRegister} className="space-y-6">
            {/* Full Name (Optional) */}
            <div>
              <label 
                htmlFor="fullName" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Full Name (Optional)
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                }}
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                }}
                placeholder="admin@eza.ai"
              />
            </div>

            {/* Password */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Password *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                }}
                placeholder="••••••••"
              />
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                Minimum 8 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label 
                htmlFor="confirmPassword" 
                className="block text-sm font-medium mb-2"
                style={{ color: '#E2E8F0' }}
              >
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: '#121722',
                  borderColor: '#334155',
                  color: '#F1F5F9',
                }}
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className="p-4 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#FCA5A5',
                  borderLeft: '3px solid #EF4444',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading ? '#1E40AF' : '#3B82F6',
                color: '#FFFFFF',
              }}
            >
              {loading ? 'Creating account...' : 'Create Admin Account'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs" style={{ color: '#64748B' }}>
            <p>Already have an account?{' '}
              <Link 
                href="/platform/login" 
                className="hover:underline"
                style={{ color: '#3B82F6' }}
              >
                Login
              </Link>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center text-xs" style={{ color: '#64748B' }}>
          <p>EZA AI Safety Platform v1.0</p>
          <p className="mt-1">
            <a 
              href="https://proxy.ezacore.ai" 
              className="hover:underline"
              style={{ color: '#3B82F6' }}
            >
              Go to Proxy UI
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

