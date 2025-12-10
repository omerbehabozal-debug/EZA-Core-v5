/**
 * Settings Component
 * Language and Theme settings
 */

'use client';

import { useState } from 'react';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [language, setLanguage] = useState('tr');
  const [theme, setTheme] = useState('dark');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div 
        className="rounded-xl p-6 max-w-md w-full mx-4"
        style={{ backgroundColor: '#111726' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Ayarlar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dil
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#1A1F2E' }}
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tema
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#1A1F2E' }}
            >
              <option value="dark">Koyu</option>
              <option value="light">Açık</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

