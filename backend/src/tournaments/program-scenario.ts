import { BadRequestException } from '@nestjs/common';
import type { ProgramScenarioDto, ProgramScenarioRuleDto } from './program-scenario.dto';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import type { Zone } from './zone.entity';
import type { Court } from '../courts/court.entity';

const stages = ['ZONE', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];
export const scenarioRuleKey = (rule: Pick<ProgramScenarioRuleDto, 'categoryId' | 'stage' | 'zoneId' | 'matchOrder'>) => `${rule.categoryId}:${rule.stage}:${rule.stage === 'ZONE' ? rule.zoneId : rule.matchOrder ?? ''}`;

// Pure simulation: all returned records are copies, so a preview cannot change the schedule.
export function simulateProgram(slots: TournamentScheduleSlot[], zones: Zone[], courts: Court[], config: ProgramScenarioDto) {
  for (const day of [config.mainDay, config.finalsDay]) if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new BadRequestException('Seleccioná fechas válidas.');
  if (config.finalsDay < config.mainDay) throw new BadRequestException('El día de finales no puede ser anterior al día principal.');
  const rules = new Map<string, ProgramScenarioRuleDto>();
  for (const rule of config.rules) {
    const key = scenarioRuleKey(rule);
    if (rules.has(key)) throw new BadRequestException('Hay configuraciones repetidas para una zona o etapa.');
    if (rule.stage === 'ZONE' && !zones.some((z) => z.id === rule.zoneId && z.tournamentCategoryId === rule.categoryId)) throw new BadRequestException('Una zona del escenario ya no pertenece a esa categoría. Volvé a cargar la configuración.');
    if (rule.stage !== 'ZONE' && !slots.some((s) => s.tournamentCategoryId === rule.categoryId && s.stage === rule.stage && (!rule.matchOrder || rule.matchOrder === s.matchOrder))) throw new BadRequestException('Una etapa del escenario ya no existe. Volvé a cargar la configuración.');
    const eligible = courts.filter((c) => c.venueId === rule.venueId && c.active && c.venue?.active);
    if (!eligible.length || (rule.courtId && !eligible.some((c) => c.id === rule.courtId))) throw new BadRequestException('Seleccioná una cancha activa que pertenezca a la sede indicada.');
    rules.set(key, rule);
  }
  const items = slots.map((slot) => ({ ...slot, court: null, courtId: null, scheduledAt: null })) as TournamentScheduleSlot[];
  const ruleFor = (slot: TournamentScheduleSlot) => {
    const key = { categoryId: slot.tournamentCategoryId, stage: slot.stage, zoneId: slot.match?.zoneId ?? undefined };
    const rule = rules.get(scenarioRuleKey({ ...key, matchOrder: slot.matchOrder })) ?? rules.get(scenarioRuleKey(key));
    if (!rule) throw new BadRequestException('Falta configurar una zona o etapa. Volvé a cargar la configuración.');
    return rule;
  };
  items.forEach(ruleFor);
  const dependencies = new Map(items.map((slot) => {
    const match = slot.match;
    const zone = zones.find((z) => z.id === match?.zoneId);
    const sources = [match?.homeSourceMatchId, match?.awaySourceMatchId].filter(Boolean);
    const qualifiers = [match?.homeQualifierZoneId, match?.awayQualifierZoneId].filter(Boolean);
    const deps = items.filter((other) => {
      if (other.id === slot.id) return false;
      if (sources.includes(other.matchId) || (other.stage === 'ZONE' && qualifiers.includes(other.match?.zoneId))) return true;
      if (slot.stage === 'ZONE') return other.match?.zoneId === zone?.id && other.stage === 'ZONE' && other.matchOrder < slot.matchOrder && (zone?.capacity === 3 || slot.matchOrder > 2 && other.matchOrder <= 2);
      return !sources.length && !qualifiers.length && other.tournamentCategoryId === slot.tournamentCategoryId && stages.indexOf(other.stage) === stages.indexOf(slot.stage) - 1;
    });
    return [slot.id, deps];
  }));
  const pending = new Set(items), completed = new Set<number>();
  const ends = new Map<number, number>();
  const occupied = new Map<number, { start: number; end: number }[]>();
  const categoryCounts = new Map<string, number>();
  const warnings: { sequence: number; message: string }[] = [];
  while (pending.size) {
    const ready = [...pending].filter((s) => dependencies.get(s.id)!.every((d) => completed.has(d.id)));
    if (!ready.length) throw new BadRequestException('Los cruces contienen una dependencia circular. Revisá el fixture.');
    const chosen = ready.sort((a, b) => {
      const ar = ruleFor(a), br = ruleFor(b);
      const dayA = ar.day === 'MAIN' ? config.mainDay : config.finalsDay, dayB = br.day === 'MAIN' ? config.mainDay : config.finalsDay;
      const fairness = config.interleaveCategories ? (categoryCounts.get(`${ar.venueId}:${dayA}:${ar.categoryId}`) ?? 0) - (categoryCounts.get(`${br.venueId}:${dayB}:${br.categoryId}`) ?? 0) : ar.categoryId - br.categoryId;
      return dayA.localeCompare(dayB) || ar.venueId - br.venueId || fairness || stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.matchOrder - b.matchOrder || a.sequence - b.sequence;
    })[0];
    const rule = ruleFor(chosen), deps = dependencies.get(chosen.id)!;
    const day = rule.day === 'MAIN' ? config.mainDay : config.finalsDay;
    const eligible = courts.filter((c) => c.active && c.venue?.active && c.venueId === rule.venueId && (!rule.courtId || rule.courtId === c.id));
    const venue = eligible[0].venue;
    if (!Number.isInteger(venue.matchDurationMinutes) || venue.matchDurationMinutes < 1 || !Number.isInteger(venue.matchesPerDay) || venue.matchesPerDay < 1 || venue.matchesPerDay > 1440) throw new BadRequestException(`Revisá la duración y los turnos diarios de ${venue.name}.`);
    const earliest = Math.max(0, ...deps.map((d) => ends.get(d.id) ?? Infinity));
    const startOfDay = Date.parse(`${day}T${venue.startsAt.slice(0, 5)}:00-03:00`);
    if (!Number.isFinite(startOfDay)) throw new BadRequestException(`Revisá la hora de inicio de ${venue.name}.`);
    const nextDay = Date.parse(`${day}T00:00:00-03:00`) + 86_400_000;
    const duration = venue.matchDurationMinutes * 60_000;
    const candidates = eligible.map((court) => {
      for (let index = 0; index < venue.matchesPerDay; index++) {
        const start = startOfDay + index * duration, end = start + duration;
        if (start < earliest || end > nextDay || (occupied.get(court.id) ?? []).some((r) => start < r.end && end > r.start)) continue;
        return { court, start, end };
      }
      return null;
    }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => a.start - b.start || a.court.id - b.court.id);
    const candidate = candidates[0];
    if (candidate) {
      chosen.court = candidate.court; chosen.courtId = candidate.court.id; chosen.scheduledAt = new Date(candidate.start);
      ends.set(chosen.id, candidate.end);
      occupied.set(candidate.court.id, [...(occupied.get(candidate.court.id) ?? []), { start: candidate.start, end: candidate.end }]);
    } else warnings.push({ sequence: chosen.sequence, message: earliest === Infinity ? 'Un partido previo quedó sin horario.' : `No entra en ${venue.name} el ${day}. Revisá el día, la cancha o los turnos disponibles.` });
    const countKey = `${rule.venueId}:${day}:${rule.categoryId}`;
    categoryCounts.set(countKey, (categoryCounts.get(countKey) ?? 0) + 1);
    pending.delete(chosen); completed.add(chosen.id);
  }
  return { slots: items, warnings };
}
