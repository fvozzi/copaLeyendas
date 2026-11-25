import L, { type LatLngExpression } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommunityCourt } from '../types';
import { communityCourtTypeLabels } from '../lib/court-directory';

const southAmericaCenter: LatLngExpression = [-22, -59];
const courtIcon = L.divIcon({ className: 'court-map-marker', html: '<span aria-hidden="true">●</span>', iconSize: [30, 38], iconAnchor: [15, 35], popupAnchor: [0, -34] });
const selectedIcon = L.divIcon({ className: 'court-map-marker is-selected', html: '<span aria-hidden="true">●</span>', iconSize: [34, 42], iconAnchor: [17, 39], popupAnchor: [0, -38] });

interface CourtMapProps {
  courts?: CommunityCourt[];
  position?: { latitude: number; longitude: number } | null;
  selectedCourtId?: number | null;
  onPositionChange?: (position: { latitude: number; longitude: number }) => void;
  onCourtSelect?: (court: CommunityCourt) => void;
  className?: string;
}

export function CourtMap({ courts = [], position = null, selectedCourtId = null, onPositionChange, onCourtSelect, className = '' }: CourtMapProps) {
  const focus = position ?? (selectedCourtId ? pointFor(courts.find((court) => court.id === selectedCourtId)) : null);
  return <MapContainer className={`court-map ${className}`} center={southAmericaCenter} zoom={3} minZoom={2} maxZoom={19} scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {onPositionChange && <MapClick onChange={onPositionChange} />}
    <MapFocus position={focus} />
    {position && <Marker position={[position.latitude, position.longitude]} icon={selectedIcon}><Popup>Ubicación seleccionada</Popup></Marker>}
    {courts.map((court) => <Marker key={court.id} position={[court.latitude, court.longitude]} icon={court.id === selectedCourtId ? selectedIcon : courtIcon} eventHandlers={{ click: () => onCourtSelect?.(court) }}>
      <Popup><strong>{court.name}</strong><br />{court.courtType ? communityCourtTypeLabels[court.courtType] : 'Tipo sin informar'}<br />{court.locality}, {court.province}<br />{court.totalPlayers} jugadores/as registrados</Popup>
    </Marker>)}
  </MapContainer>;
}

function MapClick({ onChange }: { onChange: (position: { latitude: number; longitude: number }) => void }) {
  useMapEvents({ click: (event) => onChange({ latitude: roundCoordinate(event.latlng.lat), longitude: roundCoordinate(event.latlng.lng) }) });
  return null;
}

function MapFocus({ position }: { position: { latitude: number; longitude: number } | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 12), { duration: 0.7 }); }, [map, position?.latitude, position?.longitude]);
  return null;
}

function pointFor(court?: CommunityCourt) {
  return court ? { latitude: court.latitude, longitude: court.longitude } : null;
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
