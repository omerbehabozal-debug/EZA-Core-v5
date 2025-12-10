/**
 * History Drawer Component
 * Side panel for viewing analysis history
 */

'use client';

import { useEffect, useState } from 'react';
import { getHistory, AnalysisHistory, clearHistory } from '../lib/storage';
import { ProxyLiteAnalysisResponse } from '@/api/proxy_lite';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: AnalysisHistory) => void;
}

export default function HistoryDrawer({ isOpen, onClose, onSelect }: HistoryDrawerProps) {
  const [history, setHistory] = useState<AnalysisHistory[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);


  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 transform transition-transform duration-300 ease-out"
        style={{ backgroundColor: '#111726' }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#1A1F2E' }}>
            <h2 className="text-xl font-bold text-white">Analiz Geçmişi</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Henüz analiz geçmişi yok</p>
              </div>
            ) : (
              <>
                {history.map((entry) => {
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        onSelect(entry);
                        onClose();
                      }}
                      className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
                      style={{ 
                        backgroundColor: '#1A1F2E',
                        borderRadius: '12px',
                        border: '1px solid #1A1F2E'
                      }}
                    >
                      <h3 className="text-white font-medium mb-2 line-clamp-2">
                        {entry.text.substring(0, 50)}{entry.text.length > 50 ? '...' : ''}
                      </h3>
                      <p className="text-gray-400 text-xs mb-2">
                        {new Date(entry.date).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-lg font-bold"
                          style={{ 
                            color: entry.ethic_score >= 70 ? '#39FF88' : 
                                   entry.ethic_score >= 40 ? '#FFC93C' : '#FF3B3B'
                          }}
                        >
                          {Math.round(entry.ethic_score)}
                        </span>
                        <span className="text-xs text-gray-500">Etik Skor</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          {history.length > 0 && (
            <div className="p-4 border-t" style={{ borderColor: '#1A1F2E' }}>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tüm geçmişi silmek istediğinize emin misiniz?')) {
                    clearHistory();
                    setHistory([]);
                  }
                }}
                className="w-full py-2 px-4 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                style={{ backgroundColor: '#1A1F2E' }}
              >
                Geçmişi Temizle
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

