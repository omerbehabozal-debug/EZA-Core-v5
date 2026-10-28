import { getApiUrl } from '@/lib/apiUrl';

export type PublicBusinessImage = { type: 'image'; assetId: string; title: string; contentPath: string };
export type PublicBusinessVideo = { type: 'video'; assetId: string; title: string; href: string };
export type PublicBusinessMap = { type: 'map'; assetId: string; title: string; caption: string; latitude: string; longitude: string };
export type PublicBusinessLink = { type: 'link'; assetId: string; title: string; caption: string; href: string };
export type PublicBusinessBlock = PublicBusinessImage | PublicBusinessVideo | PublicBusinessMap | PublicBusinessLink;
export type PublicBusinessMedia = { cover: PublicBusinessImage | null; steps: PublicBusinessBlock[][] };

const CONTENT_PATH = /^\/api\/business-yansi\/public-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;
const HTTPS = /^https:\/\/\S+$/i;
const COORDINATE = /^-?\d+(?:\.\d+)?$/;

function parseBlock(raw: unknown): PublicBusinessBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if ('locator' in row || 'url' in row || 'path' in row || 'src' in row || 'file' in row) return null;
  const assetId = typeof row.assetId === 'string' ? row.assetId : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!assetId || !title) return null;
  if (row.type === 'image') {
    const contentPath = typeof row.contentPath === 'string' ? row.contentPath : '';
    if (!CONTENT_PATH.test(contentPath) || contentPath.toLowerCase().includes('brand-assets')) return null;
    return { type: 'image', assetId, title, contentPath };
  }
  if (row.type === 'video' || row.type === 'link') {
    const href = typeof row.href === 'string' ? row.href : '';
    if (!HTTPS.test(href)) return null;
    if (row.type === 'video') return { type: 'video', assetId, title, href };
    return { type: 'link', assetId, title, caption: typeof row.caption === 'string' ? row.caption : '', href };
  }
  if (row.type === 'map') {
    const latitude = typeof row.latitude === 'string' ? row.latitude : '';
    const longitude = typeof row.longitude === 'string' ? row.longitude : '';
    if (!COORDINATE.test(latitude) || !COORDINATE.test(longitude)) return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { type: 'map', assetId, title, caption: typeof row.caption === 'string' ? row.caption : '', latitude, longitude };
  }
  return null;
}

export function parseBusinessMediaBlocks(value: unknown): PublicBusinessBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const block = parseBlock(item);
    return block ? [block] : [];
  });
}

export function parseBusinessMedia(value: unknown): PublicBusinessMedia | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const cover = row.cover == null ? null : parseBlock(row.cover);
  const imageCover = cover?.type === 'image' ? cover : null;
  const steps = Array.isArray(row.steps)
    ? row.steps.map((step) => (Array.isArray(step) ? parseBusinessMediaBlocks(step) : []))
    : [];
  if (!imageCover && steps.every((step) => step.length === 0)) return undefined;
  return { cover: imageCover, steps };
}

export function businessMediaUrl(contentPath: string): string {
  return `${getApiUrl().replace(/\/$/, '')}${contentPath}`;
}

export function businessCoverUrl(media?: PublicBusinessMedia | null): string | null {
  if (!media?.cover) return null;
  return businessMediaUrl(media.cover.contentPath);
}
