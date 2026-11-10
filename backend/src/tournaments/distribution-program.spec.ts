import { describe, expect, it } from 'vitest';
import { preservedProgramAssignments, type DistributionProgramSlot } from './distribution-program';

const slot = (id: number, overrides: Partial<DistributionProgramSlot> = {}): DistributionProgramSlot => ({
  id, matchId: id, tournamentCategoryId: 4, stage: 'ZONE', zoneName: 'Zona A', matchOrder: 1,
  courtId: 7, scheduledAt: new Date('2026-11-20T13:00:00Z'), ...overrides,
});

describe('preservedProgramAssignments', () => {
  it('carries court and time edits to the same semantic game after redistribution', () => {
    const existing = [slot(1), slot(2, { stage: 'SEMIFINAL', zoneName: '', matchOrder: 2, courtId: 9 })];
    const generated = [slot(101, { courtId: 2, scheduledAt: null }), slot(102, { stage: 'SEMIFINAL', zoneName: '', matchOrder: 2, courtId: 3 })];
    expect(preservedProgramAssignments(existing, generated)).toEqual([
      { id: 101, courtId: 7, scheduledAt: new Date('2026-11-20T13:00:00Z') },
      { id: 102, courtId: 9, scheduledAt: new Date('2026-11-20T13:00:00Z') },
    ]);
  });

  it('does not copy an assignment to a new zone or game', () => {
    expect(preservedProgramAssignments([slot(1)], [slot(2, { zoneName: 'Zona B' }), slot(3, { matchOrder: 2 })])).toEqual([]);
  });
});
