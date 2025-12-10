/**
 * Local Storage Management for Proxy-Lite History
 */

import { LiteAnalysisResponse } from '@/api/proxy_lite';

export interface LiteHistoryItem {
  id: string; // uuid
  createdAt: string; // ISO date
  title: string; // First line of text or optional user title
  text: string; // Original full text
  analysis: LiteAnalysisResponse;
  tags: string[]; // Auto-generated tags from topics
}

const STORAGE_KEY = 'eza_proxy_lite_history';
const MAX_HISTORY = 20; // Keep last 20 analyses

/**
 * Auto-generate tags from text topics
 */
function generateTags(text: string, issues: string[]): string[] {
  const tags: string[] = [];
  const textLower = text.toLowerCase();
  
  // Topic detection keywords
  const topicMap: Record<string, string> = {
    'sağlık': '#sağlık',
    'health': '#sağlık',
    'diyet': '#sağlık',
    'zayıflama': '#sağlık',
    'detoks': '#sağlık',
    'çay': '#sağlık',
    'seyahat': '#seyahat',
    'travel': '#seyahat',
    'tatil': '#seyahat',
    'gezi': '#seyahat',
    'yemek': '#yemek',
    'food': '#yemek',
    'restoran': '#yemek',
    'teknoloji': '#teknoloji',
    'tech': '#teknoloji',
    'yazılım': '#teknoloji',
    'eğitim': '#eğitim',
    'education': '#eğitim',
    'öğrenme': '#eğitim',
    'moda': '#moda',
    'fashion': '#moda',
    'stil': '#moda',
    'spor': '#spor',
    'sport': '#spor',
    'fitness': '#spor',
    'egzersiz': '#spor',
  };
  
  // Check for topics in text
  for (const [keyword, tag] of Object.entries(topicMap)) {
    if (textLower.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  // Add issue-based tags
  if (issues.some(i => i.toLowerCase().includes('sağlık'))) {
    if (!tags.includes('#sağlık')) tags.push('#sağlık');
  }
  
  return tags.slice(0, 5); // Limit to 5 tags
}

/**
 * Save analysis to history
 */
export function saveAnalysis(result: LiteAnalysisResponse, inputText: string): void {
  try {
    const history = getHistory();
    
    // Generate title from first line of text
    const firstLine = inputText.split('\n')[0].trim();
    const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    
    // Generate tags
    const tags = generateTags(inputText, result.unique_issues || []);
    
    const newEntry: LiteHistoryItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt: new Date().toISOString(),
      title: title || 'Analiz',
      text: inputText,
      analysis: result,
      tags,
    };

    // Add to beginning and limit size (FIFO)
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save analysis to history:', error);
  }
}

/**
 * Get all history entries
 */
export function getHistory(): LiteHistoryItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to read history:', error);
    return [];
  }
}

/**
 * Get single history entry by ID
 */
export function getHistoryEntry(id: string): LiteHistoryItem | null {
  const history = getHistory();
  return history.find(entry => entry.id === id) || null;
}

/**
 * Clear all history
 */
export function clearHistory(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}
