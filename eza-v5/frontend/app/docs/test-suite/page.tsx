'use client';

import { useState, useEffect } from 'react';

interface Improvement {
  from: number;
  to: number;
  change: string;
}

interface TestSuite {
  name: string;
  name_tr: string | null;
  test_count: number;
  passed: number;
  failed: number;
  success_rate: number;
  status: 'completed' | 'partial';
  status_tr: string | null;
  description: string | null;
  label: string | null;
  improvement: Improvement | null;
  details: Record<string, any> | string[] | null;
}

interface ComprehensiveTestResults {
  overall: {
    total_runs: number;
    total_tests: number;
    total_passed: number;
    total_failed: number;
    success_rate: number;
  };
  test_suites: TestSuite[];
  latest_runs: Array<{
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    success_rate: number;
  }>;
  improvements: {
    total_fixes: number;
    fixed_tests: number;
    remaining_issues: number;
  };
  last_updated: string;
}

export default function TestSuitePage() {
  const [data, setData] = useState<ComprehensiveTestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshotKey = process.env.NEXT_PUBLIC_SNAPSHOT_KEY;
        if (!snapshotKey) {
          throw new Error('NEXT_PUBLIC_SNAPSHOT_KEY is not configured');
        }

        const response = await fetch(
          'https://api.ezacore.ai/api/public/test-safety-benchmarks?period=daily',
          {
            headers: {
              'x-eza-publish-key': snapshotKey
            }
          }
        );
        
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Access denied. Check NEXT_PUBLIC_SNAPSHOT_KEY configuration.');
          }
          if (response.status === 404) {
            throw new Error('No snapshot available. Please publish a snapshot first.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch test results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">EZA Test & Safety Benchmarks</h1>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Toplam Test</div>
          <div className="text-3xl font-bold">{data.overall.total_tests}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Genel Başarı Oranı</div>
          <div className="text-3xl font-bold text-green-600">{data.overall.success_rate}%</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-2">Test Suite Sayısı</div>
          <div className="text-3xl font-bold">{data.test_suites.length}</div>
        </div>
      </div>

      {/* Test Suites */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Test Suite Özeti</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.test_suites.map((suite, index) => (
            <TestSuiteCard key={suite.name || index} suite={suite} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TestSuiteCardProps {
  suite: TestSuite;
}

function TestSuiteCard({ suite }: TestSuiteCardProps) {
  const statusIcon = suite.status === 'completed' ? '✅' : '⚠️';
  const statusColor = suite.status === 'completed' ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{suite.name_tr || suite.name}</h3>
        <span className={`${statusColor} text-sm`}>
          {statusIcon} {suite.status_tr || suite.status}
        </span>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-bold mb-1">{suite.test_count}</div>
        <div className="text-sm text-gray-600">Test Sayısı</div>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-bold text-green-600 mb-1">{suite.success_rate}%</div>
        <div className="text-sm text-gray-600">Başarı Oranı</div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${suite.success_rate}%` }}
          />
        </div>
      </div>

      {suite.description && (
        <div className="text-sm text-gray-600 mb-4">{suite.description}</div>
      )}

      {/* Improvement - SAFELY RENDERED with optional chaining */}
      {suite.improvement && (
        <div className="text-sm text-blue-600 mb-2 p-2 bg-blue-50 rounded">
          <span className="font-semibold">İyileştirme: </span>
          {suite.improvement?.from}% → {suite.improvement?.to}% ({suite.improvement?.change})
        </div>
      )}

      {/* Details - SAFELY RENDERED */}
      {suite.details && (
        <div className="text-sm text-gray-500 mt-2">
          <span className="font-semibold">Detaylar: </span>
          {Array.isArray(suite.details) ? (
            <span>{suite.details.join(', ')}</span>
          ) : typeof suite.details === 'object' ? (
            <div className="mt-1">
              {Object.entries(suite.details).map(([key, value]) => (
                <div key={key} className="ml-2">
                  {key}: {String(value)}
                </div>
              ))}
            </div>
          ) : (
            <span>{String(suite.details)}</span>
          )}
        </div>
      )}

      {suite.label && (
        <div className="text-xs text-gray-400 mt-2">{suite.label}</div>
      )}
    </div>
  );
}

