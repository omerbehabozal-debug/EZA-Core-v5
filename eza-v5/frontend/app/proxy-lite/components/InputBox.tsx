/**
 * Input Box Component
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  isLoading?: boolean;
}

export default function InputBox({ onSubmit, isLoading = false }: InputBoxProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Analiz etmek istediğiniz içeriği buraya yazın..."
        className="w-full h-64 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-400"
        disabled={isLoading}
      />
      <Button
        type="submit"
        disabled={!text.trim() || isLoading}
        className="w-full"
      >
        {isLoading ? 'Analiz Ediliyor...' : 'Analiz Et'}
      </Button>
    </form>
  );
}

