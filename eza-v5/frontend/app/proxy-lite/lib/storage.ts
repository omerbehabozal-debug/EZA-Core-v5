/**
 * Local Storage Management for Proxy-Lite History
 */

export interface AnalysisHistory {
  id: string;
  text: string;
  date: string; // ISO date string
  ethical_score: number;
  result?: any; // Optional: full analysis result for detail view
}

const STORAGE_KEY = 'proxy-lite-history';
const MAX_HISTORY = 50; // Keep last 50 analyses

/**
 * Save analysis to history
 */
export function saveAnalysis(result: ProxyLiteAnalysisResponse, inputText: string): void {
  try {
    const history = getHistory();
    
    const newEntry: AnalysisHistory = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      text: inputText,
      date: new Date().toISOString(),
      ethical_score: result.ethical_score,
      result, // Store full result for detail view
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

