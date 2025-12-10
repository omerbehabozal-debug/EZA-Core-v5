/**
 * Settings Component - Apple Soft Light Theme
 * Language settings only (no theme toggle - always light)
 */

'use client';

import { useState } from 'react';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [language, setLanguage] = useState('tr');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      onClick={onClose}
    >
      <div 
        className="rounded-[16px] p-6 max-w-md w-full mx-4"
        style={{ 
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 2px 6px rgba(0,0,0,0.06), 0px 8px 18px rgba(0,0,0,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 
            className="text-xl font-bold"
            style={{ 
              color: '#1C1C1E',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontWeight: 600
            }}
          >
            Ayarlar
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: '#6E6E73' }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Language */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ 
                color: '#3A3A3C',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontWeight: 500
              }}
            >
              Dil
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 rounded-[14px] transition-all focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: '#F8F9FB',
                border: '1px solid #E3E3E7',
                color: '#1C1C1E',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              }}
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
