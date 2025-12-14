/**
 * Corporate Panel - Corporate/Admin Only
 * Live telemetry feed with WebSocket real-time updates
 */

'use client';

import { useState, useEffect } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { apiClient } from '@/lib/apiClient';
import { useWebSocket } from '@/hooks/useWebSocket';

interface TelemetryEvent {
  id: string;
  timestamp: string;
  mode: string;
  source: string;
  user_input?: string;
  safe_answer?: string;
  eza_score?: number;
  risk_level?: string;
  policy_violations?: string[];
  model_votes?: any;
  meta?: any;
}

export default function CorporatePage() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    highRiskCount: 0,
    avgScore: 0,
  });

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await apiClient.get<{
          items: TelemetryEvent[];
          total: number;
        }>('/api/monitor/corporate-feed', {
          auth: true,
          params: { limit: '50' },
        });

        if (response.ok && response.data?.items) {
          setEvents(response.data.items);
          calculateStats(response.data.items);
        } else {
          setError(response.error?.error_message || 'Failed to load data');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket({
    path: '/ws/corporate',
    onMessage: (data) => {
      // Add new event to the beginning of the list
      if (data.id) {
        setEvents((prev) => {
          const newEvents = [data as TelemetryEvent, ...prev];
          calculateStats(newEvents);
          return newEvents.slice(0, 100); // Keep last 100 events
        });
      }
    },
    enabled: true,
  });

  const calculateStats = (eventList: TelemetryEvent[]) => {
    const last10Minutes = Date.now() - 10 * 60 * 1000;
    const recentEvents = eventList.filter(
      (e) => new Date(e.timestamp).getTime() > last10Minutes
    );

    const highRisk = recentEvents.filter(
      (e) => e.risk_level === 'high' || e.risk_level === 'critical'
    ).length;

    const scores = eventList
      .map((e) => e.eza_score)
      .filter((s): s is number => s !== undefined && s !== null);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    setStats({
      highRiskCount: highRisk,
      avgScore: Math.round(avgScore * 10) / 10,
    });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <RequireAuth allowedRoles={['corporate', 'admin']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Corporate Panel</h1>
            <div className="flex items-center gap-4">
              {/* User Profile Dropdown */}
              <UserProfileDropdown />
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">High Risk Events (Last 10 min)</h3>
              <p className="text-3xl font-bold text-red-600">{stats.highRiskCount}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Average EZA Score (All Time)</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.avgScore}</p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Live Feed Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Live Feed</h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No events yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EZA Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.mode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {event.eza_score?.toFixed(1) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              event.risk_level === 'high' || event.risk_level === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : event.risk_level === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {event.risk_level || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {truncateText(event.user_input || 'No input', 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}

