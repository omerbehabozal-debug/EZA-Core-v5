/**
 * Proxy Panel - Admin Only
 * Developer / AI security team forensic view
 */

'use client';

import { useState } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
import { apiClient } from '@/lib/apiClient';

interface ProxyResponse {
  ok: boolean;
  data?: {
    raw_output?: string;
    safe_answer?: string;
    input_analysis?: any;
    alignment?: any;
    deep_analysis?: any;
    eza_score?: number;
    risk_level?: string;
    policy_violations?: string[];
  };
  error?: {
    error_message?: string;
  };
}

export default function ProxyPage() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ProxyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'raw' | 'alignment' | 'analysis'>('overview');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await apiClient.post<ProxyResponse['data']>('/api/proxy', {
        body: { message: userInput },
        auth: true, // Requires admin JWT
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error?.error_message || 'Request failed');
      }

      setResponse(result as any);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RequireAuth allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Proxy Panel</h1>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <label htmlFor="userInput" className="block text-sm font-medium text-gray-700 mb-2">
                User Input
              </label>
              <textarea
                id="userInput"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Enter text to analyze..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
              />
              <button
                type="submit"
                disabled={isLoading || !userInput.trim()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Results */}
          {response && response.data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: User Input + Safe Answer */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">User Input</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{userInput}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Safe Answer</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {response.data.safe_answer || 'No safe answer available'}
                  </p>
                </div>
              </div>

              {/* Right Column: Tabs */}
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                  <nav className="flex -mb-px">
                    {(['overview', 'raw', 'alignment', 'analysis'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                          activeTab === tab
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500">EZA Score</span>
                        <p className="text-2xl font-bold text-gray-900">
                          {response.data.eza_score?.toFixed(1) || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Risk Level</span>
                        <p className="text-lg font-semibold text-gray-900">
                          {response.data.risk_level || 'N/A'}
                        </p>
                      </div>
                      {response.data.policy_violations && response.data.policy_violations.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Policy Violations</span>
                          <ul className="mt-2 space-y-1">
                            {response.data.policy_violations.map((violation, idx) => (
                              <li key={idx} className="text-sm text-red-600">• {violation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'raw' && (
                    <div>
                      <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(response.data.raw_output || response.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {activeTab === 'alignment' && (
                    <div>
                      <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(response.data.alignment || {}, null, 2)}
                      </pre>
                    </div>
                  )}

                  {activeTab === 'analysis' && (
                    <div>
                      <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
                        {JSON.stringify(response.data.deep_analysis || response.data.input_analysis || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
