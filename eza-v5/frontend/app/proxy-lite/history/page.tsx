/**
 * Proxy-Lite History Page
 * Shows analysis history from local storage
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getHistory, deleteHistoryEntry, LiteHistoryItem } from '../lib/storage';
import { Trash2, X } from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<LiteHistoryItem[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LiteHistoryItem | null>(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail view
    if (confirm('Bu analizi silmek istediğinize emin misiniz?')) {
      deleteHistoryEntry(id);
      setHistory(getHistory());
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm('Tüm analiz geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      localStorage.removeItem('eza_proxy_lite_history');
      setHistory([]);
      setSelectedEntry(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: '#0A0F1F',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Analiz Geçmişi</h1>
            <p className="text-gray-400 text-sm">{history.length} kayıt</p>
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-80"
                style={{ backgroundColor: '#E84343' }}
              >
                Tümünü Temizle
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/proxy-lite')}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-80"
              style={{ backgroundColor: '#0066FF' }}
            >
              ← Geri
            </button>
          </div>
        </div>

        {/* History List */}
        {history.length === 0 ? (
          <div 
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: '#111726', borderRadius: '12px' }}
          >
            <p className="text-gray-400">Henüz analiz geçmişi yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
                style={{ 
                  backgroundColor: '#111726',
                  borderRadius: '12px',
                  border: selectedEntry?.id === entry.id ? '2px solid #0066FF' : '1px solid #1A1F2E'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium mb-1">{entry.title}</h3>
                    <p className="text-gray-400 text-xs">{formatDate(new Date(entry.createdAt).getTime())}</p>
                    {entry.analysis && (
                      <p className="text-gray-500 text-xs mt-1">
                        Skor: {entry.analysis.ethics_score?.toFixed(1) || 'N/A'} | 
                        {' '}{entry.analysis.ethics_level || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(entry.id, e)}
                      className="p-2 rounded-lg transition-all hover:bg-red-500/20"
                      style={{ color: '#E84343' }}
                      title="Sil"
                    >
                      <Trash2 size={18} />
                    </button>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail View */}
        {selectedEntry && (
          <div 
            className="rounded-xl p-6 mt-6"
            style={{ backgroundColor: '#111726', borderRadius: '12px' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Analiz Detayı</h2>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-2 rounded-lg transition-all hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Başlık</p>
                <p className="text-white">{selectedEntry.title}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400 mb-2">Tarih</p>
                <p className="text-white">{formatDate(new Date(selectedEntry.createdAt).getTime())}</p>
              </div>

              {selectedEntry.analysis && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Genel Skor</p>
                  <p className="text-white text-2xl font-bold">
                    {selectedEntry.analysis.ethics_score?.toFixed(1) || 'N/A'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {selectedEntry.analysis.ethics_level || 'N/A'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

