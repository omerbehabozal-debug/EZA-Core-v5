// Multimodal API Client

import { API_BASE_URL } from './config';

export type MultimodalAnalysisResult = {
  request_id: string;
  content_type: "video" | "audio" | "image";
  filename?: string | null;
  duration_sec?: number | null;
  language?: string | null;
  asr_segments: Array<{
    start_sec: number;
    end_sec: number;
    text: string;
    risk_level: string;
  }>;
  ocr_segments: Array<{
    timestamp_sec: number;
    text: string;
    risk_level: string;
  }>;
  video_frames: Array<{
    index: number;
    timestamp_sec: number;
    risk_level: string;
    labels: string[];
    summary?: string | null;
  }>;
  audio_emotions: Array<{
    start_sec: number;
    end_sec: number;
    emotion: string;
    intensity: number;
    risk_level: string;
  }>;
  context_nodes: Array<{
    id: string;
    type: string;
    label: string;
    risk_level: string;
  }>;
  context_edges: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
  eza_multimodal_score: {
    overall_score: number;
    text_score?: number | null;
    visual_score?: number | null;
    audio_score?: number | null;
    legal_risk_score?: number | null;
  };
  global_risk_level: string;
  recommended_actions: string[];
  meta: Record<string, any>;
};

export async function uploadMultimodalFile(
  kind: "video" | "audio" | "image",
  file: File
): Promise<MultimodalAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/multimodal/${kind}/run`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 503) {
      throw new Error("Multimodal analysis is currently disabled in this environment.");
    }
    const text = await res.text();
    throw new Error(text || `Failed to analyze ${kind}`);
  }

  return res.json();
}

