/**
 * Regulator Panel - Regulator/Admin Only
 * RTÜK / Regulator live monitoring with filters
 */

'use client';

import { useState, useEffect } from 'react';
import RequireAuth from '@/components/auth/RequireAuth';
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

export default function RegulatorPage() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);
  
  // Filters
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [policyFilter, setPolicyFilter] = useState<string>('');

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await apiClient.get<{
          items: TelemetryEvent[];
          total: number;
        }>('/api/monitor/regulator-feed', {
          auth: true,
          params: { limit: '100' },
        });

        if (response.ok && response.data?.items) {
          setEvents(response.data.items);
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
    path: '/ws/regulator',
    onMessage: (data) => {
      // Add new event to the beginning of the list
      if (data.id) {
        setEvents((prev) => {
          const newEvents = [data as TelemetryEvent, ...prev];
          return newEvents.slice(0, 200); // Keep last 200 events
        });
      }
    },
    enabled: true,
  });

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (riskLevelFilter !== 'all' && event.risk_level !== riskLevelFilter) {
      return false;
    }
    if (modeFilter !== 'all' && event.mode !== modeFilter) {
      return false;
    }
    if (policyFilter && (!event.policy_violations || !event.policy_violations.some(v => v.includes(policyFilter)))) {
      return false;
    }
    return true;
  });

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <RequireAuth allowedRoles={['regulator', 'admin']}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Regulator Panel</h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="riskLevel" className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Level
                </label>
                <select
                  id="riskLevel"
                  value={riskLevelFilter}
                  onChange={(e) => setRiskLevelFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="mode" className="block text-sm font-medium text-gray-700 mb-2">
                  Mode
                </label>
                <select
                  id="mode"
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="standalone">Standalone</option>
                  <option value="proxy">Proxy</option>
                  <option value="proxy-lite">Proxy-Lite</option>
                </select>
              </div>

              <div>
                <label htmlFor="policy" className="block text-sm font-medium text-gray-700 mb-2">
                  Policy Violation (contains)
                </label>
                <input
                  id="policy"
                  type="text"
                  value={policyFilter}
                  onChange={(e) => setPolicyFilter(e.target.value)}
                  placeholder="e.g., P1, P2..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Events Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Events ({filteredEvents.length})
              </h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No events match the filters</div>
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
                        Policy Violations
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.map((event) => (
                      <tr
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
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
                          {event.policy_violations && event.policy_violations.length > 0 ? (
                            <span className="text-red-600">
                              {event.policy_violations.join(', ')}
                            </span>
                          ) : (
                            'None'
                          )}
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

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Timestamp</h3>
                  <p className="text-gray-900">{new Date(selectedEvent.timestamp).toLocaleString()}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">User Input</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedEvent.user_input || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Safe Answer</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedEvent.safe_answer || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">EZA Score</h3>
                    <p className="text-gray-900">{selectedEvent.eza_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Risk Level</h3>
                    <p className="text-gray-900">{selectedEvent.risk_level || 'N/A'}</p>
                  </div>
                </div>

                {selectedEvent.policy_violations && selectedEvent.policy_violations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Policy Violations</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedEvent.policy_violations.map((violation, idx) => (
                        <li key={idx} className="text-red-600">{violation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEvent.meta && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Metadata</h3>
                    <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
                      {JSON.stringify(selectedEvent.meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}

