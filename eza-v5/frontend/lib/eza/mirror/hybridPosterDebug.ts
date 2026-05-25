/**
 * Hybrid poster dev diagnostics — prompt markers, mock detection, OCR heuristic.
 */

import type { HybridPosterTextPayload } from '@/lib/eza/mirror/hybridPosterPromptBuilder';

export const HYBRID_PROMPT_MARKERS = [
  'embed the following turkish text into the artwork',
  'leave top 10% empty',
  'leave bottom 25% empty',
  'use elegant editorial typography',
  'do not generate ui cards',
] as const;

export const OPENAI_MIRROR_PROMPT_MAX = 4000;

export type UsedPromptType = 'hybrid_middle' | 'scene_only_director';

export type HybridPromptMarkerReport = {
  ok: boolean;
  missing: string[];
  present: string[];
};

export type HybridOcrProbeResult = {
  ok: boolean;
  reason: string;
  detail: string;
  edgeScore?: number;
  mockImage?: boolean;
};

export function analyzeHybridPromptMarkers(prompt: string): HybridPromptMarkerReport {
  const lower = prompt.toLowerCase();
  const present: string[] = [];
  const missing: string[] = [];
  for (const marker of HYBRID_PROMPT_MARKERS) {
    if (lower.includes(marker)) {
      present.push(marker);
    } else {
      missing.push(marker);
    }
  }
  return { ok: missing.length === 0, missing, present };
}

export function detectPromptTruncationRisk(prompt: string): {
  truncated: boolean;
  length: number;
  max: number;
} {
  const length = prompt.length;
  return {
    truncated: length > OPENAI_MIRROR_PROMPT_MAX,
    length,
    max: OPENAI_MIRROR_PROMPT_MAX,
  };
}

export function isMockSceneImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes('picsum.photos') ||
    u.includes('unsplash.com') ||
    u.includes('placeholder') ||
    u.includes('mock-scene') ||
    u.includes('loremflickr')
  );
}

export function inferUsedPromptType(
  prompt: string,
  renderMode?: string
): UsedPromptType {
  if (renderMode === 'hybrid_middle') return 'hybrid_middle';
  const lower = prompt.toLowerCase();
  if (
    lower.includes('middle artwork zone') ||
    lower.includes('embed the following turkish text')
  ) {
    return 'hybrid_middle';
  }
  return 'scene_only_director';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = url.startsWith('data:') ? null : 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed for OCR probe'));
    img.src = url;
  });
}

/** Simple edge-density heuristic in upper-left headline zone (dev QA, not true OCR). */
function edgeDensityScore(imageData: ImageData): number {
  const { data, width, height } = imageData;
  let edges = 0;
  let samples = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4;
      const lum =
        0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const ir = ((y * width + x + 1) * 4);
      const lumR =
        0.299 * data[ir]! + 0.587 * data[ir + 1]! + 0.114 * data[ir + 2]!;
      const id = ((y + 1) * width + x) * 4;
      const lumD =
        0.299 * data[id]! + 0.587 * data[id + 1]! + 0.114 * data[id + 2]!;
      if (Math.abs(lum - lumR) + Math.abs(lum - lumD) > 48) edges += 1;
      samples += 1;
    }
  }
  return samples ? edges / samples : 0;
}

export async function probeHybridTypographyInImage(
  imageUrl: string,
  textPayload?: HybridPosterTextPayload | null
): Promise<HybridOcrProbeResult> {
  if (isMockSceneImageUrl(imageUrl)) {
    return {
      ok: false,
      reason: 'mock_provider_image',
      detail: 'Mock/picsum URL — embedded typography not expected from OpenAI.',
      mockImage: true,
    };
  }

  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    const w = Math.min(img.naturalWidth || img.width, 540);
    const h = Math.min(img.naturalHeight || img.height, 960);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'canvas_unavailable', detail: 'Canvas 2D unavailable' };
    }
    ctx.drawImage(img, 0, 0, w, h);
    const headlineZone = ctx.getImageData(0, Math.floor(h * 0.08), Math.floor(w * 0.55), Math.floor(h * 0.28));
    const quoteZone = ctx.getImageData(
      Math.floor(w * 0.1),
      Math.floor(h * 0.45),
      Math.floor(w * 0.8),
      Math.floor(h * 0.25)
    );
    const headlineEdge = edgeDensityScore(headlineZone);
    const quoteEdge = edgeDensityScore(quoteZone);
    const combined = (headlineEdge + quoteEdge) / 2;
    const likelyTypography = headlineEdge > 0.06 && quoteEdge > 0.04;
    const headlineHint = textPayload?.headline?.slice(0, 24) ?? 'headline';

    return {
      ok: likelyTypography,
      reason: likelyTypography ? 'edge_heuristic_pass' : 'edge_heuristic_fail',
      detail: likelyTypography
        ? `Upper/quote zones show text-like edge density (headline probe: "${headlineHint}")`
        : `Low edge density in headline/quote zones — embedded typography likely missing`,
      edgeScore: combined,
      mockImage: false,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'ocr_probe_error',
      detail: err instanceof Error ? err.message : 'OCR probe failed',
    };
  }
}

export function logHybridPromptBuilt(input: {
  renderMode: string;
  usedPromptType: UsedPromptType;
  prompt: string;
  negativePrompt: string;
  textPayload?: HybridPosterTextPayload;
}): void {
  if (process.env.NODE_ENV !== 'development') return;
  const markers = analyzeHybridPromptMarkers(input.prompt);
  const trunc = detectPromptTruncationRisk(input.prompt);
  console.group('[EZA Mirror] buildHybridPosterPrompt');
  console.log('renderMode:', input.renderMode);
  console.log('usedPromptType:', input.usedPromptType);
  console.log('promptLength:', trunc.length, 'truncateRisk:', trunc.truncated);
  console.log('markersOk:', markers.ok, 'missing:', markers.missing);
  if (input.textPayload) console.log('textPayload:', input.textPayload);
  console.log('FINAL PROMPT → OpenAI generate-scene:\n', input.prompt);
  console.log('NEGATIVE:', input.negativePrompt.slice(0, 400));
  console.groupEnd();
}
