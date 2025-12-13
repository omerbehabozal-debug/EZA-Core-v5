/**
 * History Drawer Component - Apple Soft Light Theme
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
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-50 transform transition-transform duration-300 ease-out"
        style={{ 
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#E3E3E7' }}>
            <h2 
              className="text-xl font-bold"
              style={{ 
                color: '#1C1C1E',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 600
              }}
            >
              Analiz Geçmişi
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-xs"
                style={{ color: '#6E6E73' }}
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ color: '#6E6E73' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <p style={{ color: '#6E6E73' }}>Henüz analiz geçmişi yok</p>
              </div>
            ) : (
              <>
                {history.map((entry) => {
                  const score = entry.analysis.ethics_score;
                  const color = getEthicalScoreColor(score);
                  
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        onSelect(entry);
                        onClose();
                      }}
                      className="rounded-[16px] p-4 cursor-pointer"
                      style={{ 
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E3E3E7',
                        boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
                      }}
                    >
                      <h3 
                        className="font-medium mb-2 line-clamp-2"
                        style={{ 
                          color: '#1C1C1E',
                          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                          fontWeight: 500
                        }}
                      >
                        {entry.title}
                      </h3>
                      <p className="text-xs mb-2" style={{ color: '#6E6E73' }}>
                        {new Date(entry.createdAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-lg font-bold"
                            style={{ 
                              color,
                              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                              fontWeight: 700
                            }}
                          >
                            {Math.round(score)}
                          </span>
                          <span className="text-xs" style={{ color: '#6E6E73' }}>Etik Skor</span>
                        </div>
                      </div>
                      
                      {/* Tags */}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: '#F8F9FB',
                                color: '#007AFF',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
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
