import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlaceLocationPicker from '@/components/saina/business-studio/PlaceLocationPicker';
import {
  formatCoordinateFixed,
  isPlaceSearchConfigured,
  parseCoordinate,
  selectedPlaceLabel,
} from '@/lib/eza/businessPlaceLocation';
import { BusinessApiError } from '@/lib/eza/businessYansi';

const searchBrandPlaces = vi.fn();

vi.mock('@/lib/eza/businessYansi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/businessYansi')>('@/lib/eza/businessYansi');
  return {
    ...actual,
    searchBrandPlaces: (...args: unknown[]) => searchBrandPlaces(...args),
  };
});

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockMapCanvas({
      latitude,
      longitude,
      onSelect,
      disabled,
    }: {
      latitude: string;
      longitude: string;
      disabled?: boolean;
      onSelect: (lat: number, lng: number) => void;
    }) {
      return (
        <div data-testid="biz-place-map">
          <span data-testid="biz-place-map-coords">
            {latitude}|{longitude}
          </span>
          <button
            type="button"
            data-testid="biz-place-map-click"
            disabled={disabled}
            onClick={() => onSelect(41.025123, 28.974456)}
          >
            map-click
          </button>
          <button
            type="button"
            data-testid="biz-place-map-drag"
            disabled={disabled}
            onClick={() => onSelect(41.030111, 28.980222)}
          >
            marker-drag
          </button>
        </div>
      );
    },
}));

describe('business place location helpers', () => {
  it('validates and formats coordinates for persistence', () => {
    expect(parseCoordinate('41,025', 'latitude')).toBeCloseTo(41.025);
    expect(parseCoordinate('91', 'latitude')).toBeNull();
    expect(parseCoordinate('181', 'longitude')).toBeNull();
    expect(formatCoordinateFixed(41.0251234)).toBe('41.025123');
    expect(selectedPlaceLabel('', '')).toBe('Konum seçilmedi');
    expect(selectedPlaceLabel('41.01', '29.02', 'Karaköy')).toBe('Karaköy');
    expect(isPlaceSearchConfigured()).toBe(true);
  });
});

describe('PlaceLocationPicker search', () => {
  beforeEach(() => {
    searchBrandPlaces.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches through the proxy, selects a result, and still allows map correction', async () => {
    searchBrandPlaces.mockResolvedValue({
      items: [
        {
          placeName: 'Karaköy',
          address: 'Karaköy, Beyoğlu, İstanbul',
          latitude: '41.025000',
          longitude: '28.974000',
        },
      ],
      attribution: '© OpenStreetMap contributors (Nominatim)',
    });
    const onCoordinatesChange = vi.fn();
    const onPlaceLabelChange = vi.fn();
    render(
      <PlaceLocationPicker
        businessId="biz-1"
        latitude=""
        longitude=""
        onCoordinatesChange={onCoordinatesChange}
        onPlaceLabelChange={onPlaceLabelChange}
      />,
    );

    fireEvent.change(screen.getByTestId('biz-place-search-input'), { target: { value: 'Karakoy' } });
    await waitFor(() => expect(searchBrandPlaces).toHaveBeenCalledWith('biz-1', 'Karakoy'), { timeout: 2000 });
    expect(await screen.findByTestId('biz-place-search-results')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-place-search-result'));
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '41.025000',
      longitude: '28.974000',
    });
    expect(onPlaceLabelChange).toHaveBeenCalledWith('Karaköy, Beyoğlu, İstanbul');

    fireEvent.click(screen.getByTestId('biz-place-map-drag'));
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '41.030111',
      longitude: '28.980222',
    });
  });

  it('shows empty results and keeps map selection available', async () => {
    searchBrandPlaces.mockResolvedValue({ items: [], attribution: '© OpenStreetMap contributors' });
    const onCoordinatesChange = vi.fn();
    render(
      <PlaceLocationPicker businessId="biz-1" latitude="" longitude="" onCoordinatesChange={onCoordinatesChange} />,
    );
    fireEvent.change(screen.getByTestId('biz-place-search-input'), { target: { value: 'xyzabc' } });
    expect(await screen.findByTestId('biz-place-search-empty', {}, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-place-map-click'));
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '41.025123',
      longitude: '28.974456',
    });
  });

  it('surfaces provider failure without blocking map fallback', async () => {
    searchBrandPlaces.mockRejectedValue(new BusinessApiError(503, { code: 'place_search_unavailable' }));
    const onCoordinatesChange = vi.fn();
    render(
      <PlaceLocationPicker businessId="biz-1" latitude="" longitude="" onCoordinatesChange={onCoordinatesChange} />,
    );
    fireEvent.change(screen.getByTestId('biz-place-search-input'), { target: { value: 'Karakoy' } });
    expect(await screen.findByTestId('biz-place-search-error', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByTestId('biz-place-search-disabled')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('biz-place-map-click'));
    expect(onCoordinatesChange).toHaveBeenCalled();
  });

  it('keeps manual map selection when geocode is misconfigured', async () => {
    searchBrandPlaces.mockRejectedValue(new BusinessApiError(503, { code: 'place_search_misconfigured' }));
    const onCoordinatesChange = vi.fn();
    render(
      <PlaceLocationPicker businessId="biz-1" latitude="" longitude="" onCoordinatesChange={onCoordinatesChange} />,
    );
    fireEvent.change(screen.getByTestId('biz-place-search-input'), { target: { value: 'Karakoy' } });
    expect(await screen.findByTestId('biz-place-search-error', {}, { timeout: 2000 })).toHaveTextContent(
      /yapılandırılmadı/,
    );
    fireEvent.click(screen.getByTestId('biz-place-map-click'));
    expect(onCoordinatesChange).toHaveBeenCalledWith({
      latitude: '41.025123',
      longitude: '28.974456',
    });
  });
});
