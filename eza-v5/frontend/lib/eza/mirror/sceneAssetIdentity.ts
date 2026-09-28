const MIRROR_SCENE_ASSET_RE =
  /\/mirror-scene-assets\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\.[A-Za-z0-9]+)?(?:[?#]|$)/;

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function canonicalMirrorSceneAssetIdFromUrl(
  url: string | null | undefined
): string {
  const value = (url || '').trim();
  if (!value) return '';
  const pathMatch = value.match(MIRROR_SCENE_ASSET_RE);
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase();

  const lastSegment = value.split(/[?#]/, 1)[0]?.split('/').pop() || '';
  const stem = lastSegment.replace(/\.[A-Za-z0-9]+$/, '');
  if (UUID_RE.test(stem)) return stem.toLowerCase();
  if (UUID_RE.test(lastSegment)) return lastSegment.toLowerCase();
  return '';
}

export function canonicalMirrorSceneAssetId(
  sceneAssetId: string | null | undefined
): string {
  const value = (sceneAssetId || '').trim();
  if (!value) return '';
  const stem = value.replace(/\.[A-Za-z0-9]+$/, '');
  if (UUID_RE.test(stem)) return stem.toLowerCase();
  if (UUID_RE.test(value)) return value.toLowerCase();
  return value.toLowerCase();
}

export function resolveCanonicalMirrorSceneAssetId(
  sceneImageUrl: string | null | undefined,
  sceneAssetId: string | null | undefined
): string {
  return (
    canonicalMirrorSceneAssetIdFromUrl(sceneImageUrl) ||
    canonicalMirrorSceneAssetId(sceneAssetId)
  );
}
