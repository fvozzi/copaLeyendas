import type { TournamentScheduleSlot, TournamentZone } from '../types';

export const venueColors = ['#23776b', '#b65b30', '#536dc3', '#995789', '#98751c', '#258197', '#7455a6', '#7b664e'];
export const venueColor = (id?: number | null) => id ? venueColors[(id - 1) % venueColors.length] : '#6b7679';
export const roundNames = ['Zonas', 'Cuartos de final', 'Semifinales', 'Final'];
export interface MapNode { id: string; column: number; zone?: TournamentZone; slot?: TournamentScheduleSlot; }
export interface MapEdge { from: string; to: string; side: 'home' | 'away'; rank?: number | null; }

export function categoryGraph(zones: TournamentZone[], slots: TournamentScheduleSlot[], venueId = 0) {
  const nodes: MapNode[] = [...zones].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })).map((zone) => ({ id: `zone-${zone.id}`, column: 0, zone }));
  const stages = ['ZONE', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];
  for (const slot of slots.filter((item) => item.stage !== 'ZONE').sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.matchOrder - b.matchOrder)) {
    nodes.push({ id: `match-${slot.matchId ?? `slot-${slot.id}`}`, column: stages.indexOf(slot.stage), slot });
  }
  const edges: MapEdge[] = [];
  for (const node of nodes) if (node.slot?.match) {
    for (const side of ['home', 'away'] as const) {
      const match = node.slot.match;
      const qualifier = side === 'home' ? match.homeQualifierZoneId : match.awayQualifierZoneId;
      const source = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
      const from = qualifier ? `zone-${qualifier}` : source ? `match-${source}` : '';
      if (nodes.some((item) => item.id === from)) edges.push({ from, to: node.id, side, rank: qualifier ? side === 'home' ? match.homeQualifierRank : match.awayQualifierRank : null });
    }
  }
  if (!venueId) return { nodes, edges };
  const visible = new Set(nodes.filter((node) => (node.zone?.venueId ?? node.slot?.court?.venueId) === venueId).map((node) => node.id));
  // Keep the downstream bracket so filtering a venue does not break the path to the final.
  for (let column = 1; column <= 3; column++) for (const edge of edges) if (visible.has(edge.from)) visible.add(edge.to);
  return { nodes: nodes.filter((node) => visible.has(node.id)), edges: edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)) };
}

export function mapParticipant(slot: TournamentScheduleSlot, side: 'home' | 'away', zones: TournamentZone[], slots: TournamentScheduleSlot[]) {
  const match = slot.match;
  if (!match) return 'A definir';
  const pair = side === 'home' ? match.homeRegistration : match.awayRegistration;
  if (pair) return `${pair.localityName} · ${pair.playerOneName} / ${pair.playerTwoName}`;
  const qualifier = side === 'home' ? match.homeQualifierZoneId : match.awayQualifierZoneId;
  const rank = side === 'home' ? match.homeQualifierRank : match.awayQualifierRank;
  if (qualifier) return `${rank ?? '?'}.ª de ${zones.find((zone) => zone.id === qualifier)?.name ?? 'zona a definir'}`;
  const sourceId = side === 'home' ? match.homeSourceMatchId : match.awaySourceMatchId;
  const source = side === 'home' ? match.homeSource : match.awaySource;
  return sourceId ? `${source === 'LOSER' ? 'Perdedora' : 'Ganadora'} P${slots.find((item) => item.matchId === sourceId)?.sequence ?? '?'}` : 'A definir';
}
