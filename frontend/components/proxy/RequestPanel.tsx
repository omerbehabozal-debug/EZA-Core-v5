/**
 * RequestPanel Component - Input form for Proxy Lab
 */

import { useState, FormEvent } from 'react';
import { Play } from 'lucide-react';

interface RequestPanelProps {
  onSubmit: (message: string, model: string, depth: 'fast' | 'deep') => void;
  isLoading: boolean;
  mode: 'fast' | 'deep';
}

export default function RequestPanel({ onSubmit, isLoading, mode }: RequestPanelProps) {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState('gpt-4');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSubmit(message.trim(), model, mode);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Mesajı
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Analiz edilecek mesajı buraya girin..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none text-sm"
          />
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 text-sm"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm shadow-md transition-all transform active:scale-95 flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>{isLoading ? 'Analiz Ediliyor...' : 'Çalıştır'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

