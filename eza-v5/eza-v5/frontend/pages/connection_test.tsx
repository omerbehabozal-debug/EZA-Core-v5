/**
 * Connection Test Page - V6 Backend Connectivity Checker
 */

import { useState } from 'react';
import { testGateway } from '@/api/gateway';
import { API_BASE_URL } from '@/api/config';

export default function ConnectionTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test gateway endpoint
      const gatewayResult = await testGateway(
        "Test prompt for connectivity check",
        "openai",
        undefined,
        "eu_ai"
      );
      
      setResult({
        success: true,
        gateway: gatewayResult,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('V6 Gateway ERROR:', err);
      setError(err.message || 'Connection test failed');
      setResult({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            EZA V6 Backend Connection Test
          </h1>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Backend URL:</strong> {API_BASE_URL}
            </p>
            <button
              onClick={runTest}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Testing...' : 'Run Connection Test'}
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                {result.success ? 'Connection Successful!' : 'Connection Failed'}
              </h3>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <h3 className="font-semibold mb-2">Test Endpoints:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Gateway: {API_BASE_URL}/api/gateway/test-call</li>
              <li>Standalone: {API_BASE_URL}/api/standalone/standalone_chat</li>
              <li>Proxy: {API_BASE_URL}/api/proxy/eval</li>
              <li>Proxy-Lite: {API_BASE_URL}/api/proxy-lite/report</li>
              <li>Health: {API_BASE_URL}/health</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

