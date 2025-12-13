/**
 * History Drawer Component - Apple Soft Light Theme
 * Side panel for viewing analysis history
 */

'use client';

import { useEffect, useState } from 'react';
import { getHistory, LiteHistoryItem, clearHistory, deleteHistoryEntry } from '../lib/storage';
import { getEthicalScoreColor } from '../lib/scoringUtils';
import { Trash2, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: LiteHistoryItem) => void;
}

export default function HistoryDrawer({ isOpen, onClose, onSelect }: HistoryDrawerProps) {
  const [history, setHistory] = useState<LiteHistoryItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null,
  });
  const [clearConfirm, setClearConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);

  const handleClear = () => {
    setClearConfirm(true);
  };

  const handleConfirmClear = () => {
    clearHistory();
    setHistory([]);
    setClearConfirm(false);
    setToast({ message: 'Tüm geçmiş temizlendi', type: 'success' });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening entry
    setDeleteConfirm({ isOpen: true, id });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id) {
      deleteHistoryEntry(deleteConfirm.id);
      setHistory(getHistory());
      setToast({ message: 'Analiz silindi', type: 'success' });
    }
    setDeleteConfirm({ isOpen: false, id: null });
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
                className="p-1 rounded-lg transition-all hover:bg-gray-100"
                style={{ color: '#6E6E73' }}
              >
                <X size={20} />
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
                      className="rounded-[16px] p-4 relative group"
                      style={{ 
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E3E3E7',
                        boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
                      }}
                    >
                      {/* Delete button - appears on hover */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(entry.id, e)}
                        className="absolute top-3 right-3 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-red-50"
                        style={{ 
                          color: '#E84343',
                          zIndex: 10
                        }}
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div
                        onClick={() => {
                          onSelect(entry);
                          onClose();
                        }}
                        className="cursor-pointer"
                      >
                        <h3 
                          className="font-medium mb-2 line-clamp-2 pr-8"
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Analizi Sil"
        message="Bu analizi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        cancelText="İptal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      {/* Clear All Confirmation Modal */}
      <ConfirmModal
        isOpen={clearConfirm}
        title="Tüm Geçmişi Temizle"
        message="Tüm analiz geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Tümünü Sil"
        cancelText="İptal"
        type="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirm(false)}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
