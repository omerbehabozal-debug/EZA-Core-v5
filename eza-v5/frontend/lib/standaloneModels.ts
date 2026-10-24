/**
 * Standalone — analiz edilen AI ortamları (router model_id ile eşleşir)
 */

export interface StandaloneAnalysisModel {
  id: string;
  label: string;
  provider: string;
}

export const STORAGE_KEY_ANALYSIS_MODEL = 'eza_standalone_analysis_model';

export const STANDALONE_ANALYSIS_MODELS: StandaloneAnalysisModel[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o', provider: 'OpenAI' },
];

export const DEFAULT_ANALYSIS_MODEL_ID = STANDALONE_ANALYSIS_MODELS[0].id;

function isRetiredAnalysisModel(id: string): boolean {
  const normalized = id.trim().toLowerCase();
  return (
    normalized.startsWith('groq/') ||
    normalized.startsWith('groq-') ||
    normalized.startsWith('mistral/') ||
    normalized.startsWith('mistral-')
  );
}

export function getAnalysisModelById(id: string): StandaloneAnalysisModel {
  return (
    STANDALONE_ANALYSIS_MODELS.find((m) => m.id === id) ?? STANDALONE_ANALYSIS_MODELS[0]
  );
}

export function readStoredAnalysisModel(): string {
  if (typeof window === 'undefined') return DEFAULT_ANALYSIS_MODEL_ID;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANALYSIS_MODEL);
    if (raw && STANDALONE_ANALYSIS_MODELS.some((m) => m.id === raw)) return raw;
    if (raw && isRetiredAnalysisModel(raw)) {
      writeStoredAnalysisModel(DEFAULT_ANALYSIS_MODEL_ID);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ANALYSIS_MODEL_ID;
}

export function writeStoredAnalysisModel(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ANALYSIS_MODEL, id);
  } catch {
    /* ignore */
  }
}
