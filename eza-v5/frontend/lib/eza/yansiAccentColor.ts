/** Default warm amber when scene sampling is unavailable. */
export const YANSI_ACCENT_RGB_DEFAULT = '183, 137, 73';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('yansi accent image load failed'));
    img.src = url;
  });
}

/** Sample a subdued warm/cool accent from the active Yansı scene for sidebar edge bleed. */
export async function extractYansiAccentRgb(imageUrl: string): Promise<string> {
  if (typeof window === 'undefined' || !imageUrl.trim()) {
    return YANSI_ACCENT_RGB_DEFAULT;
  }

  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement('canvas');
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return YANSI_ACCENT_RGB_DEFAULT;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const alpha = data[i + 3];
      if (alpha < 120) continue;

      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      if (lum < 36 || lum > 228) continue;

      r += pr;
      g += pg;
      b += pb;
      count += 1;
    }

    if (count === 0) return YANSI_ACCENT_RGB_DEFAULT;

    return `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
  } catch {
    return YANSI_ACCENT_RGB_DEFAULT;
  }
}

export function applyYansiAccentRgb(rgb: string): void {
  const root = document.querySelector<HTMLElement>('.saina-app-root');
  if (!root) return;
  root.style.setProperty('--yansi-accent-rgb', rgb);
}
