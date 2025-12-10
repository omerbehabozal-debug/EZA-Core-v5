/**
 * History Drawer Component
 * Side panel for viewing analysis history
 */

'use client';

import { useEffect, useState } from 'react';
import { getHistory, LiteHistoryItem, clearHistory } from '../lib/storage';
import { getEthicalScoreColor } from '../lib/scoringUtils';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: LiteHistoryItem) => void;
}

export default function HistoryDrawer({ isOpen, onClose, onSelect }: HistoryDrawerProps) {
  const [history, setHistory] = useState<LiteHistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);

  const handleClear = () => {
    if (confirm('Tüm geçmişi silmek istediğinize emin misiniz?')) {
      clearHistory();
      setHistory([]);
    }
  };

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
            <h2 className="text-xl font-bold text-slate-50">Analiz Geçmişi</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">Henüz analiz geçmişi yok</p>
              </div>
            ) : (
              <>
                {history.map((entry) => {
                  const score = entry.analysis.overall_ethical_score;
                  const color = getEthicalScoreColor(score);
                  
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        onSelect(entry);
                        onClose();
                      }}
                      className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] shadow-lg"
                      style={{ 
                        backgroundColor: '#1A1F2E',
                        border: '1px solid #1A1F2E'
                      }}
                    >
                      <h3 className="text-slate-50 font-medium mb-2 line-clamp-2">
                        {entry.title}
                      </h3>
                      <p className="text-slate-400 text-xs mb-2">
                        {new Date(entry.createdAt).toLocaleString('tr-TR', {
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
                          style={{ color }}
                        >
                          {Math.round(score)}
                        </span>
                        <span className="text-xs text-slate-400">Etik Skor</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
