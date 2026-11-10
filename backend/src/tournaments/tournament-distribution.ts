export interface DistributionRegistration {
  id: number;
  localityId: number;
  localityName: string;
  label: string;
}

export interface DistributionCategoryInput {
  id: number;
  name: string;
  registrations: DistributionRegistration[];
}

export interface DistributionVenueInput {
  id: number;
  name: string;
}

export interface DistributionZonePlan {
  id?: number;
  name: string;
  capacity: number;
  venue?: DistributionVenueInput | null;
  venueAssignment?: 'AUTOMATIC' | 'MANUAL' | 'APPLIED';
  registrations: DistributionRegistration[];
}

export interface DistributionCategoryPlan {
  tournamentCategoryId: number;
  categoryName: string;
  registrationCount: number;
  capacities: number[];
  venue: DistributionVenueInput | null;
  zones: DistributionZonePlan[];
  warnings: string[];
}

/**
 * Tournament rule: prefer zones of three, then zones of four, and only mix
 * both sizes when neither homogeneous option can contain the exact total.
 */
export function calculateZoneCapacities(total: number) {
  if (!Number.isInteger(total) || total < 0) throw new Error('La cantidad de parejas debe ser un entero positivo.');
  if (total === 0) return [];
  // The competition bracket supports up to four zones. Between 12 and 16
  // pairs we keep those four zones and only change their individual size.
  const zoneCount = Math.min(4, Math.floor(total / 3));
  if (zoneCount > 0 && total >= zoneCount * 3 && total <= zoneCount * 4) {
    const extras = total - zoneCount * 3;
    return Array.from({ length: zoneCount }, (_, index) => index < extras ? 4 : 3);
  }
  throw new Error(`No se pueden distribuir exactamente ${total} parejas en zonas de 3 o 4.`);
}

function zoneName(index: number) {
  return `Zona ${String.fromCharCode(65 + index)}`;
}

export function planTournamentDistribution(categories: DistributionCategoryInput[], venues: DistributionVenueInput[], venuePlans = new Map<string, number>()) {
  const venueLoad = new Map(venues.map((venue) => [venue.id, 0]));
  const localityVenueHistory = new Map<number, Map<number, number>>();
  const plans: DistributionCategoryPlan[] = [];

  for (const category of categories) {
    const warnings: string[] = [];
    let capacities: number[] = [];
    try {
      capacities = calculateZoneCapacities(category.registrations.length);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'No se pudo calcular la cantidad de zonas.');
    }
    if (!category.registrations.length) warnings.push('No hay parejas confirmadas en esta categoria.');
    if (!venues.length) warnings.push('No hay sedes activas disponibles.');

    const localityGroups = new Map<number, DistributionRegistration[]>();
    for (const registration of category.registrations) {
      localityGroups.set(registration.localityId, [...(localityGroups.get(registration.localityId) ?? []), registration]);
    }
    for (const group of localityGroups.values()) {
      if (capacities.length && group.length > capacities.length) {
        warnings.push(`${group[0].localityName} tiene ${group.length} parejas y solo hay ${capacities.length} zonas: no es posible separarlas.`);
      }
    }

    const zones: DistributionZonePlan[] = capacities.map((capacity, index) => {
      const plannedVenueId = venuePlans.get(`${category.id}:${index}`);
      const plannedVenue = venues.find((venue) => venue.id === plannedVenueId) ?? null;
      return { name: zoneName(index), capacity, venue: plannedVenue, venueAssignment: plannedVenue ? 'MANUAL' : undefined, registrations: [] };
    });
    if (zones.some((zone) => !zone.venue)) {
      warnings.push('Dirección debe asignar una sede a cada zona antes de distribuir las parejas y generar los partidos.');
      plans.push({ tournamentCategoryId: category.id, categoryName: category.name, registrationCount: category.registrations.length, capacities, venue: null, zones, warnings });
      continue;
    }
    const orderedGroups = [...localityGroups.values()].sort((left, right) => right.length - left.length || left[0].localityName.localeCompare(right[0].localityName, 'es'));
    for (const group of orderedGroups) {
      const venue = [...venues].filter((candidate) => zones.filter((zone) => zone.venue?.id === candidate.id && zone.registrations.length < zone.capacity).length >= group.length)
        .sort((left, right) => {
          const history = (candidate: DistributionVenueInput) => group.reduce((sum, registration) => sum + (localityVenueHistory.get(registration.localityId)?.get(candidate.id) ?? 0), 0);
          const fixed = (candidate: DistributionVenueInput) => zones.filter((zone) => zone.venueAssignment === 'MANUAL' && zone.venue?.id === candidate.id && zone.registrations.length < zone.capacity).length;
          return history(right) - history(left) || fixed(right) - fixed(left) || (venueLoad.get(left.id) ?? 0) - (venueLoad.get(right.id) ?? 0) || left.name.localeCompare(right.name, 'es');
        })[0];
      if (!venue) {
        warnings.push(`${group[0].localityName} no puede ubicarse en una sola sede con la asignación actual de zonas.`);
        continue;
      }
      for (const registration of group) {
        const target = zones
          .map((zone, index) => ({ zone, index }))
          .filter(({ zone }) => zone.venue?.id === venue.id && zone.registrations.length < zone.capacity && !zone.registrations.some((item) => item.localityId === registration.localityId))
          .sort((left, right) => (left.zone.registrations.length / left.zone.capacity) - (right.zone.registrations.length / right.zone.capacity)
            || (right.zone.capacity - right.zone.registrations.length) - (left.zone.capacity - left.zone.registrations.length)
            || left.index - right.index)[0];
        if (!target) {
          if (!warnings.some((warning) => warning.includes('no es posible separarlas'))) warnings.push('No fue posible completar las zonas respetando la separacion por localidad.');
          break;
        }
        target.zone.registrations.push(registration);
      }
      venueLoad.set(venue.id, (venueLoad.get(venue.id) ?? 0) + group.length);
      for (const registration of group) {
        const history = localityVenueHistory.get(registration.localityId) ?? new Map<number, number>();
        history.set(venue.id, (history.get(venue.id) ?? 0) + 1);
        localityVenueHistory.set(registration.localityId, history);
      }
    }
    const assignedVenueIds = new Set(zones.flatMap((zone) => zone.venue ? [zone.venue.id] : []));
    const venue = assignedVenueIds.size === 1 ? zones[0]?.venue ?? null : null;
    plans.push({ tournamentCategoryId: category.id, categoryName: category.name, registrationCount: category.registrations.length, capacities, venue, zones, warnings });
  }
  return plans;
}
