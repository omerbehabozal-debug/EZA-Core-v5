/**
 * Internal Proxy Sidebar - History + Input
 */

'use client';

import { useState, useEffect } from 'react';
import { getInternalProxyHistory, HistoryItem } from '@/api/internal_proxy';
import { getRiskLevelColor } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

interface InternalProxySidebarProps {
  onSessionSelect: (sessionId: string) => void;
  onRunPipeline: (text: string) => Promise<any>;
  selectedSessionId?: string;
}

export default function InternalProxySidebar({
  onSessionSelect,
  onRunPipeline,
  selectedSessionId,
}: InternalProxySidebarProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getInternalProxyHistory(20);
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Refresh history function (exposed for parent component)
  const refreshHistory = async () => {
    await loadHistory();
  };

  // Expose refreshHistory to parent via callback
  useEffect(() => {
    // Store refreshHistory in a way parent can access it
    // For now, we'll handle it in handleSubmit
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      const textToAnalyze = inputText.trim();
      setInputText('');
      
      // Call pipeline and wait for result
      try {
        const result = await onRunPipeline(textToAnalyze);
        // After pipeline completes, refresh history
        await refreshHistory();
        // Then select the new session
        if (result?.request_id) {
          onSessionSelect(result.request_id);
        }
      } catch (err) {
        console.error('Pipeline error:', err);
      }
    }
  };

  return (
    <aside className="w-[340px] border-r border-gray-200 bg-gray-50 flex flex-col" style={{ height: '100%' }}>
      {/* History Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-sm font-semibold text-gray-900">Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No sessions yet</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSessionSelect(item.id)}
                  className={`w-full text-left p-3 hover:bg-gray-100 transition-colors ${
                    selectedSessionId === item.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {formatDate(item.created_at)}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getRiskLevelColor(
                        item.risk_level
                      )}`}
                    >
                      {item.risk_level}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 line-clamp-2 mb-1">
                    {item.input_text}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Score: {item.eza_score.toFixed(0)}</span>
                    <span>•</span>
                    <span>{item.summary}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter text to analyze..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-full bg-blue-600 text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Debug Pipeline
          </button>
        </form>
      </div>
    </aside>
  );
}

