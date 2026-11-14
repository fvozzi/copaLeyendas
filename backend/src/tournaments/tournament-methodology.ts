export enum ZoneMethodology {
  PROVINCE = 'PROVINCE',
  ROUND_ROBIN = 'ROUND_ROBIN',
}

export type ZoneParticipantDefinition =
  | { source: 'DIRECT'; seed: number }
  | { source: 'WINNER' | 'LOSER'; matchOrder: number };

export interface ZoneMatchDefinition {
  order: number;
  home: ZoneParticipantDefinition;
  away: ZoneParticipantDefinition;
}

export function zoneMatchDefinitions(capacity: number, methodology: ZoneMethodology): ZoneMatchDefinition[] {
  if (capacity !== 3 && capacity !== 4) throw new Error('El cupo de la zona debe ser de 3 o 4 parejas');
  const direct = (seed: number): ZoneParticipantDefinition => ({ source: 'DIRECT', seed });
  const winner = (matchOrder: number): ZoneParticipantDefinition => ({ source: 'WINNER', matchOrder });
  const loser = (matchOrder: number): ZoneParticipantDefinition => ({ source: 'LOSER', matchOrder });
  if (methodology === ZoneMethodology.PROVINCE) {
    return capacity === 3
      ? [
          { order: 1, home: direct(1), away: direct(2) },
          { order: 2, home: winner(1), away: direct(3) },
          { order: 3, home: loser(1), away: direct(3) },
        ]
      : [
          { order: 1, home: direct(1), away: direct(3) },
          { order: 2, home: direct(2), away: direct(4) },
          { order: 3, home: winner(1), away: loser(2) },
          { order: 4, home: winner(2), away: loser(1) },
        ];
  }
  const definitions: ZoneMatchDefinition[] = [];
  let order = 1;
  for (let home = 1; home <= capacity; home += 1) for (let away = home + 1; away <= capacity; away += 1) {
    definitions.push({ order: order++, home: direct(home), away: direct(away) });
  }
  return definitions;
}

export function inferredKnockoutStage(zoneCount: number, qualifiersPerZone: number) {
  const total = zoneCount * qualifiersPerZone;
  if (total === 8) return 'QUARTERFINAL' as const;
  if (total === 4) return 'SEMIFINAL' as const;
  if (total === 2) return 'FINAL' as const;
  return null;
}
