/**
 * SettingsModal Component - Apple Settings Sheet Style
 */

import { X, Globe, Sun, Info, MessageSquare } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-gray-200/80">
          {/* Handle Bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200/80 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Ayarlar</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4 space-y-1">
            {/* Language Selection */}
            <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-medium text-gray-900">Dil</p>
                  <p className="text-xs text-gray-500">Türkçe</p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-gray-600">›</span>
            </button>
            
            {/* Theme (Placeholder) */}
            <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors group opacity-50 cursor-not-allowed">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-medium text-gray-500">Tema</p>
                  <p className="text-xs text-gray-400">Light (Yakında)</p>
                </div>
              </div>
              <span className="text-gray-300">›</span>
            </button>
            
            {/* About */}
            <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Info className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-medium text-gray-900">Hakkında</p>
                  <p className="text-xs text-gray-500">EZA v5.0.0</p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-gray-600">›</span>
            </button>
            
            {/* Feedback */}
            <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-medium text-gray-900">Geri Bildirim</p>
                  <p className="text-xs text-gray-500">Görüşlerinizi paylaşın</p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-gray-600">›</span>
            </button>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200/80">
            <p className="text-xs text-center text-gray-400">
              EZA v5 - Ethical Zekâ Altyapısı
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

