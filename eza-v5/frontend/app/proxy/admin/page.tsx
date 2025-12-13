/**
 * Proxy Panel - Admin Only
 * Developer / AI security team forensic view
 * MOVED from /proxy to /proxy/admin
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

export default function ProxyAdminPage() {
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
        setError(result.error?.error_message || 'Proxy analizi başarısız');
        return;
      }

      setResponse({ ok: true, data: result.data });
    } catch (err: any) {
      setError(err?.message || 'Bilinmeyen hata');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RequireAuth allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Proxy Panel (Admin)</h1>

          <form onSubmit={handleSubmit} className="mb-8">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Test mesajı girin..."
              className="w-full h-32 p-4 border rounded-lg mb-4"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Analiz Ediliyor...' : 'Analiz Et'}
            </button>
          </form>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {response?.data && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex gap-4 mb-4 border-b">
                {(['overview', 'raw', 'alignment', 'analysis'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 ${
                      activeTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">EZA Score: {response.data.eza_score}</p>
                  <p className="text-sm text-gray-600 mb-2">Risk Level: {response.data.risk_level}</p>
                  {response.data.policy_violations && (
                    <div>
                      <p className="font-semibold mb-2">Policy Violations:</p>
                      <ul className="list-disc list-inside">
                        {response.data.policy_violations.map((v, i) => (
                          <li key={i} className="text-sm text-red-600">{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'raw' && (
                <div>
                  <h3 className="font-semibold mb-2">Raw Output</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {response.data.raw_output}
                  </pre>
                  <h3 className="font-semibold mb-2 mt-4">Safe Answer</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {response.data.safe_answer}
                  </pre>
                </div>
              )}

              {activeTab === 'alignment' && (
                <div>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(response.data.alignment, null, 2)}
                  </pre>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div>
                  <h3 className="font-semibold mb-2">Input Analysis</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto mb-4">
                    {JSON.stringify(response.data.input_analysis, null, 2)}
                  </pre>
                  <h3 className="font-semibold mb-2">Deep Analysis</h3>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                    {JSON.stringify(response.data.deep_analysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}

