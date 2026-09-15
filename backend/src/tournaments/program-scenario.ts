import { BadRequestException } from '@nestjs/common';
import type { ProgramScenarioDto, ProgramScenarioRuleDto } from './program-scenario.dto';
import type { TournamentScheduleSlot } from './tournament-schedule-slot.entity';
import type { Zone } from './zone.entity';
import type { Court } from '../courts/court.entity';
import { programCapacityWarnings } from './program-capacity';

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
      // The final must wait for BOTH semifinals, including partially linked legacy fixtures.
      if (slot.stage === 'FINAL' && other.stage === 'SEMIFINAL' && other.tournamentCategoryId === slot.tournamentCategoryId) return true;
      if (slot.stage === 'SEMIFINAL' && sources.length < 2 && other.stage === 'QUARTERFINAL' && other.tournamentCategoryId === slot.tournamentCategoryId) return [slot.matchOrder * 2 - 1, slot.matchOrder * 2].includes(other.matchOrder);
      if (slot.stage === 'ZONE') return other.match?.zoneId === zone?.id && other.stage === 'ZONE' && other.matchOrder < slot.matchOrder && (zone?.capacity === 3 || slot.matchOrder > 2 && other.matchOrder <= 2);
      return !sources.length && !qualifiers.length && other.tournamentCategoryId === slot.tournamentCategoryId && stages.indexOf(other.stage) === stages.indexOf(slot.stage) - 1;
    });
    return [slot.id, deps];
  }));
  const manual = new Map<number, { court: Court; start: number; end: number }>();
  for (const override of config.overrides ?? []) {
    const slot = items.find((item) => item.sequence === override.sequence);
    const court = courts.find((item) => item.id === override.courtId && item.active && item.venue?.active);
    const start = Date.parse(override.scheduledAt);
    if (!slot || !court || !Number.isFinite(start) || manual.has(slot.id)) throw new BadRequestException('Revisá el partido, la cancha y la fecha del horario manual.');
    manual.set(slot.id, { court, start, end: start + court.venue.matchDurationMinutes * 60_000 });
  }
  const durationOf = (slot: TournamentScheduleSlot) => {
    const rule = ruleFor(slot);
    const venue = manual.get(slot.id)?.court.venue ?? courts.find((c) => c.venueId === rule.venueId && c.active && c.venue.active)!.venue;
    if (!Number.isInteger(venue.matchDurationMinutes) || venue.matchDurationMinutes < 1) throw new BadRequestException(`Revisá la duración de los partidos de ${venue.name}.`);
    return venue.matchDurationMinutes * 60_000;
  };
  items.forEach(durationOf);
  // Leave enough time for every manually fixed downstream match.
  const deadlines = new Map<number, number>();
  const latestEnd = (slot: TournamentScheduleSlot, path = new Set<number>()): number => {
    if (path.has(slot.id)) throw new BadRequestException('Los cruces contienen una dependencia circular. Revisá el fixture.');
    if (deadlines.has(slot.id)) return deadlines.get(slot.id)!;
    const nextPath = new Set(path).add(slot.id);
    const children = items.filter((item) => dependencies.get(item.id)!.some((dep) => dep.id === slot.id));
    const deadline = Math.min(Infinity, ...children.map((child) => manual.get(child.id)?.start ?? latestEnd(child, nextPath) - durationOf(child)));
    deadlines.set(slot.id, deadline); return deadline;
  };
  items.forEach((slot) => latestEnd(slot));
  const pending = new Set(items), completed = new Set<number>();
  const ends = new Map<number, number>();
  const occupied = new Map<number, { start: number; end: number; id: number }[]>();
  for (const [id, reservation] of manual) occupied.set(reservation.court.id, [...(occupied.get(reservation.court.id) ?? []), { ...reservation, id }]);
  const categoryCounts = new Map<string, number>();
  const warnings: { sequence: number; message: string }[] = [];
  const capacityWarnings: { sequence: number; message: string }[] = [];
  while (pending.size) {
    const ready = [...pending].filter((s) => dependencies.get(s.id)!.every((d) => completed.has(d.id)));
    if (!ready.length) throw new BadRequestException('Los cruces contienen una dependencia circular. Revisá el fixture.');
    const chosen = ready.sort((a, b) => {
      const ar = ruleFor(a), br = ruleFor(b);
      const dayA = ar.day === 'MAIN' ? config.mainDay : config.finalsDay, dayB = br.day === 'MAIN' ? config.mainDay : config.finalsDay;
      const fairness = config.interleaveCategories ? (categoryCounts.get(`${ar.venueId}:${dayA}:${ar.categoryId}`) ?? 0) - (categoryCounts.get(`${br.venueId}:${dayB}:${br.categoryId}`) ?? 0) : ar.categoryId - br.categoryId;
      return latestEnd(a) - latestEnd(b) || dayA.localeCompare(dayB) || ar.venueId - br.venueId || fairness || stages.indexOf(a.stage) - stages.indexOf(b.stage) || a.matchOrder - b.matchOrder || a.sequence - b.sequence;
    })[0];
    const rule = ruleFor(chosen), deps = dependencies.get(chosen.id)!;
    const day = rule.day === 'MAIN' ? config.mainDay : config.finalsDay;
    const eligible = courts.filter((c) => c.active && c.venue?.active && c.venueId === rule.venueId && (!rule.courtId || rule.courtId === c.id));
    const fixed = manual.get(chosen.id);
    const venue = fixed?.court.venue ?? eligible[0].venue;
    if (!Number.isInteger(venue.matchDurationMinutes) || venue.matchDurationMinutes < 1 || !Number.isInteger(venue.matchesPerDay) || venue.matchesPerDay < 1 || venue.matchesPerDay > 1440) throw new BadRequestException(`Revisá la duración y los turnos diarios de ${venue.name}.`);
    const earliest = Math.max(0, ...deps.map((d) => ends.get(d.id) ?? Infinity));
    const startOfDay = Date.parse(`${day}T${venue.startsAt.slice(0, 5)}:00-03:00`);
    if (!Number.isFinite(startOfDay)) throw new BadRequestException(`Revisá la hora de inicio de ${venue.name}.`);
    const duration = venue.matchDurationMinutes * 60_000;
    const wrongDay = !fixed && deps.some((dep) => {
      const depRule = ruleFor(dep);
      const plannedDay = manual.has(dep.id) ? new Date(manual.get(dep.id)!.start - 3 * 3_600_000).toISOString().slice(0, 10) : depRule.day === 'MAIN' ? config.mainDay : config.finalsDay;
      return plannedDay > day;
    });
    const clashes = (court: Court, start: number, end: number) => (occupied.get(court.id) ?? []).filter((r) => r.id !== chosen.id && start < r.end && end > r.start);
    const courtLoad = (court: Court, start: number) => {
      const dayStart = Math.floor((start - 3 * 3_600_000) / 86_400_000) * 86_400_000 + 3 * 3_600_000;
      return (occupied.get(court.id) ?? []).filter((r) => r.start >= dayStart && r.start < dayStart + 86_400_000).length;
    };
    const candidates = fixed ? (fixed.start >= earliest && fixed.end <= latestEnd(chosen) && !clashes(fixed.court, fixed.start, fixed.end).length ? [fixed] : []) : eligible.map((court) => {
      if (!Number.isFinite(earliest) || wrongDay) return null;
      // Planned turns are a reference, not a hard stop. Extend the schedule, jumping
      // over reservations, while preserving dependencies and any fixed downstream time.
      let start = startOfDay + Math.max(0, Math.ceil((earliest - startOfDay) / duration)) * duration;
      while (start + duration <= latestEnd(chosen)) {
        const end = start + duration;
        const collisions = clashes(court, start, end);
        if (!collisions.length) return { court, start, end };
        start = startOfDay + Math.ceil((Math.max(...collisions.map((r) => r.end)) - startOfDay) / duration) * duration;
      }
      return null;
    }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => a.start - b.start || courtLoad(a.court, a.start) - courtLoad(b.court, b.start) || a.court.id - b.court.id);
    const candidate = candidates[0];
    if (candidate) {
      chosen.court = candidate.court; chosen.courtId = candidate.court.id; chosen.scheduledAt = new Date(candidate.start);
      ends.set(chosen.id, candidate.end);
      if (!fixed) occupied.set(candidate.court.id, [...(occupied.get(candidate.court.id) ?? []), { start: candidate.start, end: candidate.end, id: chosen.id }]);
      const plannedDay = fixed ? new Date(candidate.start - 3 * 3_600_000).toISOString().slice(0, 10) : day;
      const plannedEnd = Date.parse(`${plannedDay}T${venue.startsAt.slice(0, 5)}:00-03:00`) + venue.matchesPerDay * duration;
      if (candidate.end > plannedEnd) capacityWarnings.push({ sequence: chosen.sequence, message: `Supera los ${venue.matchesPerDay} turnos previstos por cancha en ${venue.name} para el ${plannedDay}. Se asignó horario igualmente; revisá la hora de cierre.` });
    } else {
      // Keep the chosen court visible even when it has no valid time yet.
      chosen.court = fixed?.court ?? (rule.courtId ? eligible[0] : null);
      chosen.courtId = chosen.court?.id ?? null;
      const blocked = deps.filter((dep) => !ends.has(dep.id)).map((dep) => `P${dep.sequence}`);
      const collisions = fixed ? clashes(fixed.court, fixed.start, fixed.end).map((r) => `P${items.find((s) => s.id === r.id)!.sequence}`) : [];
      const message = collisions.length ? `El horario manual se superpone con ${collisions.join(', ')} en ${venue.name}, ${fixed!.court.name}.`
        : blocked.length ? `Primero corregí el horario de ${blocked.join(', ')}.`
        : fixed && fixed.start < earliest ? `El horario manual es anterior al final de ${deps.map((dep) => `P${dep.sequence}`).join(', ')}.`
        : wrongDay ? 'Un cruce previo está configurado para un día posterior. Revisá los días de las etapas.'
        : latestEnd(chosen) < Infinity ? 'Debe terminar antes del horario manual de un cruce siguiente.'
        : `Sede configurada: ${venue.name}. No hay un turno automático libre el ${day} (${venue.matchesPerDay} turnos por cancha, desde ${venue.startsAt.slice(0, 5)}). Podés fijar un horario manual o cambiar el día o la cancha.`;
      warnings.push({ sequence: chosen.sequence, message });
    }
    const countKey = `${rule.venueId}:${day}:${rule.categoryId}`;
    categoryCounts.set(countKey, (categoryCounts.get(countKey) ?? 0) + 1);
    pending.delete(chosen); completed.add(chosen.id);
  }
  for (const warning of programCapacityWarnings(items)) if (!capacityWarnings.some((item) => item.sequence === warning.sequence)) capacityWarnings.push(warning);
  return { slots: items, warnings, capacityWarnings };
}
