import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { getTournament } from '../lib/api';
import { categoryGraph, mapParticipant, roundNames, venueColor, type MapNode } from '../lib/program-map';
import type { TournamentDetail, TournamentScheduleSlot, TournamentZone, Venue } from '../types';
import { ProgramZoneEditor } from './ProgramZoneEditor';

type Props = { tournamentId: number; slots: TournamentScheduleSlot[]; venues: Venue[]; busy: boolean; onChanged: () => Promise<void>; onMatch: (slot: TournamentScheduleSlot, kind: 'schedule' | 'result') => void };
const colorStyle = (venueId?: number | null) => ({ '--venue-color': venueColor(venueId) }) as CSSProperties;

export function ProgramMap({ tournamentId, slots, venues, busy, onChanged, onMatch }: Props) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(0);
  const [venueId, setVenueId] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [editingZone, setEditingZone] = useState<TournamentZone | null>(null);
  useEffect(() => {
    let current = true;
    if (tournamentId) getTournament(tournamentId).then((item) => { if (current) setDetail(item); }).catch((reason: Error) => { if (current) setError(reason.message); });
    return () => { current = false; };
  }, [tournamentId]);
  const refresh = async () => {
    const [, item] = await Promise.all([onChanged(), getTournament(tournamentId)]);
    setDetail(item);
    if (editingZone) setEditingZone(item.zones.find((zone) => zone.id === editingZone.id) ?? null);
  };
  if (error) return <div className="inline-state" role="alert">{error}<button className="inline-link" onClick={() => { setError(null); void getTournament(tournamentId).then(setDetail).catch((reason: Error) => setError(reason.message)); }}>Reintentar</button></div>;
  if (!detail) return <div className="inline-state">Cargando mapa del torneo…</div>;
  const allVenues = [...new Map([...detail.zones.map((zone) => zone.venue), ...venues].map((venue) => [venue.id, venue])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const categories = [...detail.categories].sort((a, b) => a.category.name.localeCompare(b.category.name, 'es'));
  const boards = categories.filter((category) => !categoryId || category.id === categoryId).map((category) => {
    const zones = detail.zones.filter((zone) => zone.tournamentCategoryId === category.id);
    const games = slots.filter((slot) => slot.tournamentCategoryId === category.id);
    return { category, zones, games, graph: categoryGraph(zones, games, venueId), full: categoryGraph(zones, games) };
  }).filter((board) => board.graph.nodes.length);
  const zoneCount = boards.reduce((count, board) => count + board.graph.nodes.filter((node) => node.zone).length, 0);
  return <div className="program-map">
    <div className="map-controls">
      <label>Categoría<select aria-label="Filtrar mapa por categoría" value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}><option value="0">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.category.name}</option>)}</select></label>
      <label>Sede<select aria-label="Filtrar mapa por sede" value={venueId} onChange={(event) => setVenueId(Number(event.target.value))}><option value="0">Todas las sedes</option>{allVenues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <span className="map-count" role="status">{zoneCount} {zoneCount === 1 ? 'zona' : 'zonas'} · {boards.length} {boards.length === 1 ? 'categoría' : 'categorías'}</span>
      <div className="map-zoom" aria-label="Escala del mapa"><button aria-label="Alejar mapa" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Acercar mapa" disabled={zoom >= 1.5} onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}>+</button><button onClick={() => setZoom(1)}>Ajustar</button></div>
    </div>
    <div className="map-legend" aria-label="Colores de las sedes">{allVenues.filter((venue) => detail.zones.some((zone) => zone.venueId === venue.id) || slots.some((slot) => slot.court?.venueId === venue.id)).map((venue) => <span key={venue.id}><i style={{ background: venueColor(venue.id) }} />{venue.name}</span>)}</div>
    {venueId > 0 && <p className="map-filter-note">Se muestran las zonas de esta sede y los cruces que continúan hasta la final.</p>}
    {!boards.length && <div className="inline-state">No hay zonas ni partidos para estos filtros.<button className="inline-link" onClick={() => { setCategoryId(0); setVenueId(0); }}>Ver todo el torneo</button></div>}
    {boards.map((board) => <section className="map-category" key={board.category.id} aria-label={`Mapa de ${board.category.category.name}`}>
      <div className="map-category-title"><h2>{board.category.category.name}</h2><span>{board.graph.nodes.filter((node) => node.zone).length} zonas · {board.games.length} partidos</span></div>
      <MapBoard {...board} zoom={zoom} busy={busy} onZone={setEditingZone} onMatch={(slot) => onMatch(slot, slot.match?.status === 'PLAYED' ? 'result' : 'schedule')} />
    </section>)}
    {editingZone && <ProgramZoneEditor key={editingZone.id} zone={editingZone} venues={allVenues} slots={slots.filter((slot) => slot.match?.zoneId === editingZone.id)} onClose={() => setEditingZone(null)} onChanged={refresh} onMatch={(slot, kind) => { setEditingZone(null); onMatch(slot, kind); }} />}
  </div>;
}

function MapBoard({ graph, full, zones, games, zoom, busy, onZone, onMatch }: {
  graph: ReturnType<typeof categoryGraph>; full: ReturnType<typeof categoryGraph>; zones: TournamentZone[]; games: TournamentScheduleSlot[]; zoom: number; busy: boolean;
  onZone: (zone: TournamentZone) => void; onMatch: (slot: TournamentScheduleSlot) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [width, setWidth] = useState(1100);
  const marker = useId().replace(/:/g, '');
  useEffect(() => {
    if (!viewport.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  const columnCount = Math.max(1, ...full.nodes.map((node) => node.column + 1));
  const rowCount = Math.max(1, ...Array.from({ length: columnCount }, (_, column) => full.nodes.filter((node) => node.column === column).length));
  const canvasWidth = columnCount * 280 - 32;
  const canvasHeight = rowCount * 166 + 42;
  const positions = new Map(full.nodes.map((node) => {
    const siblings = full.nodes.filter((item) => item.column === node.column);
    const index = siblings.findIndex((item) => item.id === node.id);
    return [node.id, { x: node.column * 280 + 12, y: 42 + (index + 0.5) * (rowCount * 166 / siblings.length) - 71 }];
  }));
  // A readable canvas on phones; its own viewport pans without widening the page.
  const scale = (width < 650 ? 0.9 : Math.min(1, width / canvasWidth)) * zoom;
  const renderNode = (node: MapNode, positioned = true) => {
    const zone = node.zone;
    const slot = node.slot;
    const zoneGames = zone ? games.filter((game) => game.match?.zoneId === zone.id) : [];
    const pairs = new Set(zoneGames.flatMap((game) => [game.match?.homeRegistration?.id, game.match?.awayRegistration?.id]).filter(Boolean));
    const position = positions.get(node.id)!;
    const venueId = zone?.venueId ?? slot?.court?.venueId;
    return <button type="button" key={node.id} className={`map-node ${zone ? 'map-zone-node' : 'map-match-node'}`} data-map-node={node.id} aria-label={zone ? `Editar zona ${zone.name} de ${zone.tournamentCategory.category.name}` : `${slot?.match?.status === 'PLAYED' ? 'Ver resultado' : 'Editar partido'} P${slot?.sequence}`} disabled={busy}
      style={{ ...colorStyle(venueId), ...(positioned ? { left: position.x, top: position.y, width: 224, height: 142 } : {}) }} onClick={() => zone ? onZone(zone) : slot && onMatch(slot)}>
      {zone ? <><span className="map-node-kicker">Zona</span><strong className="map-node-title">{zone.name.replace(/^zona\s+/i, '')}</strong><span className="map-node-venue" title={zone.venue.name}>{zone.venue.name}</span><span className="map-node-meta">{pairs.size}/{zone.capacity} parejas · {zoneGames.length} partidos</span><span className="map-node-action">Editar zona y parejas ↗</span></> : slot && <>
        <span className="map-match-heading"><strong>P{slot.sequence}</strong><span>{slot.match?.status === 'PLAYED' ? `${slot.match.homeScore}–${slot.match.awayScore}` : slot.match?.status === 'READY' ? 'Listo' : 'A definir'}</span></span>
        <span className="map-participant" title={mapParticipant(slot, 'home', zones, games)}>{mapParticipant(slot, 'home', zones, games)}</span>
        <span className="map-participant" title={mapParticipant(slot, 'away', zones, games)}>{mapParticipant(slot, 'away', zones, games)}</span>
        <span className="map-node-venue" title={`${slot.court?.venue?.name ?? 'Sede a definir'} · ${slot.court?.name ?? 'Sin cancha'}`}>{slot.court ? `${slot.court.venue?.name ?? ''} · ${slot.court.name}` : 'Cancha a definir'}</span>
        <span className="map-node-meta">{slot.scheduledAt ? new Date(slot.scheduledAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'Horario a definir'}</span>
      </>}
    </button>;
  };
  if (columnCount === 1) return <div className="map-zones-only">{graph.nodes.map((node) => renderNode(node, false))}<p className="field-hint">Los cruces se mostrarán cuando estén definidos en el programa.</p></div>;
  return <>
    <p className="map-pan-hint">Deslizá el mapa para recorrer el cuadro. Tocá una zona o un partido para editar.</p>
    <div className="map-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Cuadro de zonas y eliminatorias"
      onPointerDown={(event) => { if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('button')) return; drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (drag.current) { event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX; event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY; } }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="map-scaled-area" style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
        <div className="map-canvas" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${scale})` }}>
          {Array.from({ length: columnCount }, (_, column) => <span className="map-round-title" key={column} style={{ left: column * 280 + 12 }}>{roundNames[column]}</span>)}
          <svg className="map-edges" width={canvasWidth} height={canvasHeight} aria-hidden="true"><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke" /></marker></defs>
            {graph.edges.map((edge) => {
              const from = positions.get(edge.from)!, to = positions.get(edge.to)!;
              const source = full.nodes.find((node) => node.id === edge.from)!;
              const x1 = from.x + 224, y1 = from.y + (edge.rank ? edge.rank === 1 ? 57 : 89 : 71);
              const x2 = to.x - 3, y2 = to.y + (edge.side === 'home' ? 53 : 79);
              return <g key={`${edge.from}-${edge.to}-${edge.side}`} data-map-edge={`${edge.from}:${edge.to}`}><path d={`M ${x1} ${y1} C ${x1 + 28} ${y1}, ${x2 - 28} ${y2}, ${x2} ${y2}`} fill="none" stroke={venueColor(source.zone?.venueId ?? source.slot?.court?.venueId)} strokeWidth="1.7" opacity="0.8" markerEnd={`url(#${marker})`} />{edge.rank && <text x={x1 + 5} y={y1 - 5}>{edge.rank}.ª</text>}</g>;
            })}
          </svg>
          {graph.nodes.map((node) => renderNode(node))}
        </div>
      </div>
    </div>
  </>;
}
