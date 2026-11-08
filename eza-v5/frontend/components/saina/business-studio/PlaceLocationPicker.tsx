'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatCoordinateFixed, selectedPlaceLabel } from '@/lib/eza/businessPlaceLocation';
import { isBusinessApiError, searchBrandPlaces, type PlaceSearchHit } from '@/lib/eza/businessYansi';

const PlaceMapCanvas = dynamic(() => import('./PlaceMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="biz-place-map-canvas biz-place-map-canvas--loading" data-testid="biz-place-map-loading">
      Harita yükleniyor…
    </div>
  ),
});

const SEARCH_DEBOUNCE_MS = 400;

export type PlaceLocationPickerProps = {
  businessId: string;
  latitude: string;
  longitude: string;
  placeLabel?: string;
  disabled?: boolean;
  /** When true (create form), emit latitude/longitude fields for FormData. */
  includeFormFields?: boolean;
  onCoordinatesChange: (next: { latitude: string; longitude: string }) => void;
  onPlaceLabelChange?: (label: string) => void;
};

/**
 * Interactive OSM place picker for Content Library.
 * Address search goes through the authenticated Business Nominatim proxy — never Nominatim from the browser.
 */
export default function PlaceLocationPicker({
  businessId,
  latitude,
  longitude,
  placeLabel = '',
  disabled = false,
  includeFormFields = true,
  onCoordinatesChange,
  onPlaceLabelChange,
}: PlaceLocationPickerProps) {
  const searchId = useId();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [attribution, setAttribution] = useState('© OpenStreetMap contributors');
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = searchQuery.trim();
    if (disabled || q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError('');
      void searchBrandPlaces(businessId, q)
        .then((payload) => {
          if (seq !== requestSeq.current) return;
          setResults(Array.isArray(payload.items) ? payload.items : []);
          if (payload.attribution?.trim()) setAttribution(payload.attribution.trim());
          setSearchUnavailable(false);
        })
        .catch((error: unknown) => {
          if (seq !== requestSeq.current) return;
          setResults([]);
          const code = isBusinessApiError(error) ? error.code : '';
          if (
            code === 'place_search_unavailable'
            || code === 'place_search_timeout'
            || code === 'place_search_misconfigured'
          ) {
            setSearchUnavailable(true);
            setSearchError(
              code === 'place_search_timeout'
                ? 'Adres araması zaman aşımına uğradı. Haritadan konum seçebilirsiniz.'
                : code === 'place_search_misconfigured'
                  ? 'Adres araması yapılandırılmadı. Haritadan konum seçebilirsiniz.'
                  : 'Adres araması şu anda kullanılamıyor. Haritadan konum seçebilirsiniz.',
            );
            return;
          }
          if (code === 'place_search_rate_limited') {
            setSearchError('Adres arama limiti doldu. Biraz sonra tekrar deneyin.');
            return;
          }
          if (code === 'place_search_query_rejected') {
            setSearchError('Arama metni çok kısa veya geçersiz.');
            return;
          }
          setSearchError(error instanceof Error ? error.message : 'Arama tamamlanamadı.');
        })
        .finally(() => {
          if (seq === requestSeq.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [businessId, disabled, searchQuery]);

  function applyCoords(lat: number, lng: number) {
    onCoordinatesChange({
      latitude: formatCoordinateFixed(lat),
      longitude: formatCoordinateFixed(lng),
    });
  }

  function selectHit(hit: PlaceSearchHit) {
    onCoordinatesChange({
      latitude: hit.latitude,
      longitude: hit.longitude,
    });
    const label = (hit.address || hit.placeName || '').trim();
    if (label) onPlaceLabelChange?.(label);
    setSearchQuery(hit.placeName || hit.address || '');
    setResults([]);
    setSearchError('');
  }

  return (
    <div className="biz-place-picker" data-testid="biz-place-picker">
      <div className="biz-place-search">
        <label htmlFor={searchId}>Yer ara</label>
        <input
          id={searchId}
          type="search"
          enterKeyHint="search"
          autoComplete="street-address"
          placeholder="Adres veya yer adı"
          value={searchQuery}
          disabled={disabled}
          aria-disabled={disabled}
          aria-controls={`${searchId}-results`}
          aria-expanded={results.length > 0}
          data-testid="biz-place-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searching ? (
          <p className="biz-card-meta" data-testid="biz-place-search-loading">
            Aranıyor…
          </p>
        ) : null}
        {searchError ? (
          <p className="biz-card-meta" role="status" data-testid="biz-place-search-error">
            {searchError}
          </p>
        ) : null}
        {!searching && !searchError && searchQuery.trim().length >= 2 && results.length === 0 ? (
          <p className="biz-card-meta" data-testid="biz-place-search-empty">
            Sonuç bulunamadı. Haritadan seçebilirsiniz.
          </p>
        ) : null}
        {results.length ? (
          <ul
            id={`${searchId}-results`}
            className="biz-place-search-results"
            role="listbox"
            aria-label="Arama sonuçları"
            data-testid="biz-place-search-results"
          >
            {results.map((hit) => (
              <li key={`${hit.latitude}:${hit.longitude}:${hit.placeName}`}>
                <button
                  type="button"
                  role="option"
                  className="biz-place-search-result"
                  data-testid="biz-place-search-result"
                  disabled={disabled}
                  onClick={() => selectHit(hit)}
                >
                  <span className="biz-place-search-result__name">{hit.placeName}</span>
                  {hit.address && hit.address !== hit.placeName ? (
                    <span className="biz-place-search-result__address">{hit.address}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searchUnavailable ? (
          <p className="biz-card-meta" data-testid="biz-place-search-disabled">
            Sunucu tarafı adres araması kapalı veya geçici olarak yanıt vermiyor. Harita seçimi çalışmaya devam eder.
          </p>
        ) : null}
      </div>

      <PlaceMapCanvas
        latitude={latitude}
        longitude={longitude}
        disabled={disabled}
        onSelect={(lat, lng) => {
          applyCoords(lat, lng);
          onPlaceLabelChange?.('');
        }}
      />

      <p className="biz-place-selection" data-testid="biz-place-selection">
        Seçilen konum: {selectedPlaceLabel(latitude, longitude, placeLabel)}
      </p>
      <p className="biz-card-meta">
        Haritaya tıklayın, sonuç seçin veya işaretçiyi sürükleyin. {attribution}
      </p>

      <button
        type="button"
        className="biz-btn-ghost"
        data-testid="biz-place-advanced-toggle"
        aria-expanded={advancedOpen}
        disabled={disabled}
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        {advancedOpen ? 'Gelişmiş koordinatları gizle' : 'Gelişmiş: koordinatları elle gir'}
      </button>

      {advancedOpen ? (
        <div className="biz-asset-coords" data-testid="biz-place-advanced-coords">
          <label>
            Enlem
            <input
              name={includeFormFields ? 'latitude' : undefined}
              aria-label="Enlem"
              inputMode="decimal"
              value={latitude}
              required={includeFormFields}
              disabled={disabled}
              onChange={(event) => {
                onCoordinatesChange({ latitude: event.target.value, longitude });
                onPlaceLabelChange?.('');
              }}
            />
          </label>
          <label>
            Boylam
            <input
              name={includeFormFields ? 'longitude' : undefined}
              aria-label="Boylam"
              inputMode="decimal"
              value={longitude}
              required={includeFormFields}
              disabled={disabled}
              onChange={(event) => {
                onCoordinatesChange({ latitude, longitude: event.target.value });
                onPlaceLabelChange?.('');
              }}
            />
          </label>
        </div>
      ) : includeFormFields ? (
        <>
          <input type="hidden" name="latitude" value={latitude} readOnly />
          <input type="hidden" name="longitude" value={longitude} readOnly />
        </>
      ) : null}
    </div>
  );
}
