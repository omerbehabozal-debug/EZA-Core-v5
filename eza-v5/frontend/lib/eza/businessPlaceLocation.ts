/** Content Library place coordinates and place-search helpers. */

export const DEFAULT_PLACE_CENTER = {
  latitude: 41.0082,
  longitude: 28.9784,
  zoom: 12,
} as const;

export type PlaceCoordinates = {
  latitude: string;
  longitude: string;
};

export type PlaceSearchHit = {
  placeName: string;
  address: string;
  latitude: string;
  longitude: string;
};

/** Search is always routed through the authenticated Business geocode proxy. */
export function isPlaceSearchConfigured(): boolean {
  return true;
}

export function parseCoordinate(value: string | null | undefined, kind: 'latitude' | 'longitude'): number | null {
  if (value == null) return null;
  const text = String(value).trim().replace(',', '.');
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  if (kind === 'latitude' && (num < -90 || num > 90)) return null;
  if (kind === 'longitude' && (num < -180 || num > 180)) return null;
  return num;
}

/** Persist with 6 decimal places to match backend Numeric(8/9, 6). */
export function formatCoordinateFixed(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(6);
}

export function coordsFromStrings(latitude: string, longitude: string): { lat: number; lng: number } | null {
  const lat = parseCoordinate(latitude, 'latitude');
  const lng = parseCoordinate(longitude, 'longitude');
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function selectedPlaceLabel(latitude: string, longitude: string, placeName?: string): string {
  const name = (placeName || '').trim();
  if (name) return name;
  const pair = coordsFromStrings(latitude, longitude);
  if (!pair) return 'Konum seçilmedi';
  return `${formatCoordinateFixed(pair.lat)}, ${formatCoordinateFixed(pair.lng)}`;
}
