'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_PLACE_CENTER, parseCoordinate } from '@/lib/eza/businessPlaceLocation';

type PlaceMapCanvasProps = {
  latitude: string;
  longitude: string;
  disabled?: boolean;
  onSelect: (latitude: number, longitude: number) => void;
};

function markerIcon() {
  return L.divIcon({
    className: 'biz-place-marker',
    html: '<span class="biz-place-marker-dot" aria-hidden="true"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Leaflet canvas: OSM tiles, map click + draggable marker. */
export default function PlaceMapCanvas({ latitude, longitude, disabled = false, onSelect }: PlaceMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const disabledRef = useRef(disabled);
  onSelectRef.current = onSelect;
  disabledRef.current = disabled;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) return;

    const startLat = parseCoordinate(latitude, 'latitude') ?? DEFAULT_PLACE_CENTER.latitude;
    const startLng = parseCoordinate(longitude, 'longitude') ?? DEFAULT_PLACE_CENTER.longitude;
    const map = L.map(node, {
      zoomControl: true,
      attributionControl: true,
    }).setView([startLat, startLng], DEFAULT_PLACE_CENTER.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (disabledRef.current) return;
      const { lat, lng } = event.latlng;
      onSelectRef.current(lat, lng);
    });

    mapRef.current = map;
    const resize = window.setTimeout(() => map.invalidateSize(), 40);

    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const lat = parseCoordinate(latitude, 'latitude');
    const lng = parseCoordinate(longitude, 'longitude');
    if (lat == null || lng == null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      const marker = L.marker([lat, lng], {
        draggable: !disabledRef.current,
        icon: markerIcon(),
        keyboard: true,
        title: 'Seçilen konum',
      }).addTo(map);
      marker.on('dragend', () => {
        if (disabledRef.current) return;
        const pos = marker.getLatLng();
        onSelectRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
      map.panTo([lat, lng]);
      return;
    }

    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 1e-7 || Math.abs(current.lng - lng) > 1e-7) {
      markerRef.current.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    const dragging = markerRef.current?.dragging;
    if (!dragging) return;
    if (disabled) dragging.disable();
    else dragging.enable();
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className="biz-place-map-canvas"
      data-testid="biz-place-map"
      role="application"
      aria-label="Konum haritası"
    />
  );
}
