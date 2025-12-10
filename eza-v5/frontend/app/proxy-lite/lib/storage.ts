/**
 * Local Storage Management for Proxy-Lite History
 */

export interface AnalysisHistory {
  id: string;
  title: string;
  timestamp: number;
  result: any; // Full analysis result
}

const STORAGE_KEY = 'proxy-lite-history';
const MAX_HISTORY = 50; // Keep last 50 analyses

/**
 * Save analysis to history
 */
export function saveAnalysis(result: any, inputText: string): void {
  try {
    const history = getHistory();
    const title = inputText.substring(0, 25) + (inputText.length > 25 ? '...' : '');
    
    const newEntry: AnalysisHistory = {
      id: Date.now().toString(),
      title,
      timestamp: Date.now(),
      result,
    };

    // Add to beginning and limit size
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save analysis to history:', error);
  }
}

/**
 * Get all history entries
 */
export function getHistory(): AnalysisHistory[] {
  try {
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
export function getHistoryEntry(id: string): AnalysisHistory | null {
  const history = getHistory();
  return history.find(entry => entry.id === id) || null;
}

/**
 * Clear all history
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}

