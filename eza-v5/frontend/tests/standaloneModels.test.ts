import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  STORAGE_KEY_ANALYSIS_MODEL,
  STANDALONE_ANALYSIS_MODELS,
} from '@/lib/standaloneModels';

describe('standalone analysis model', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists only GPT-4o', () => {
    expect(STANDALONE_ANALYSIS_MODELS.map((model) => model.id)).toEqual([
      DEFAULT_ANALYSIS_MODEL_ID,
    ]);
  });

  it.each(['groq/llama3-8b-tool-use', 'mistral/mistral-7b-instruct'])(
    'rewrites a stored %s preference to the OpenAI default',
    (retired) => {
      localStorage.setItem(STORAGE_KEY_ANALYSIS_MODEL, retired);
      expect(readStoredAnalysisModel()).toBe(DEFAULT_ANALYSIS_MODEL_ID);
      expect(localStorage.getItem(STORAGE_KEY_ANALYSIS_MODEL)).toBe(DEFAULT_ANALYSIS_MODEL_ID);
    }
  );

  it('keeps a stored OpenAI preference', () => {
    localStorage.setItem(STORAGE_KEY_ANALYSIS_MODEL, DEFAULT_ANALYSIS_MODEL_ID);
    expect(readStoredAnalysisModel()).toBe(DEFAULT_ANALYSIS_MODEL_ID);
  });
});
