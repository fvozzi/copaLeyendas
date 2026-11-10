export interface DistributionProgramSlot {
  id: number;
  matchId: number | null;
  tournamentCategoryId: number;
  stage: string;
  zoneName: string;
  matchOrder: number;
  courtId: number | null;
  scheduledAt: Date | null;
  match?: { zone?: { name: string } | null } | null;
}

function identity(slot: DistributionProgramSlot) {
  const zone = slot.stage === 'ZONE' ? slot.match?.zone?.name ?? slot.zoneName : '';
  return `${slot.tournamentCategoryId}:${slot.stage}:${zone}:${slot.matchOrder}`;
}

export function preservedProgramAssignments(existing: DistributionProgramSlot[], generated: DistributionProgramSlot[]) {
  const previous = new Map(existing.filter((slot) => slot.matchId).map((slot) => [identity(slot), slot]));
  return generated.flatMap((slot) => {
    const saved = previous.get(identity(slot));
    return saved ? [{ id: slot.id, courtId: saved.courtId, scheduledAt: saved.scheduledAt }] : [];
  });
}
