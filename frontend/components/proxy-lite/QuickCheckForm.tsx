/**
 * QuickCheckForm Component - Input form for Proxy-Lite
 */

import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';

interface QuickCheckFormProps {
  onSubmit: (message: string, outputText: string) => void;
  isLoading: boolean;
}

export default function QuickCheckForm({ onSubmit, isLoading }: QuickCheckFormProps) {
  const [message, setMessage] = useState('');
  const [outputText, setOutputText] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('QuickCheckForm: Form submitted', { message, outputText, isLoading });
    if (message.trim() && outputText.trim() && !isLoading) {
      console.log('QuickCheckForm: Calling onSubmit');
      onSubmit(message.trim(), outputText.trim());
    } else {
      console.log('QuickCheckForm: Form validation failed', {
        hasMessage: !!message.trim(),
        hasOutputText: !!outputText.trim(),
        isLoading
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Kontrol</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Giriş Mesajı
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="İçeriği buraya yapıştırın…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Çıktı Metni
          </label>
          <textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="Analiz edilecek çıktı metnini buraya yapıştırın…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim() || !outputText.trim() || isLoading}
          className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm shadow-md transition-all transform active:scale-95 flex items-center justify-center space-x-2"
        >
          <Search className="w-4 h-4" />
          <span>{isLoading ? 'Analiz Ediliyor...' : 'Analiz Et'}</span>
        </button>
      </form>
    </div>
  );
}

