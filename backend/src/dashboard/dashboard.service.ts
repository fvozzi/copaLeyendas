import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPost } from '../posts/content-post.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { TournamentStatus } from '../tournaments/tournament.enums';
import { Tournament } from '../tournaments/tournament.entity';
import { Zone } from '../tournaments/zone.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ContentPost)
    private readonly postsRepository: Repository<ContentPost>,
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(Zone)
    private readonly zonesRepository: Repository<Zone>,
  ) {}

  async getSummary() {
    const [posts, registrations, accessGrants, tournament] = await Promise.all([
      this.postsRepository.find(),
      this.registrationsRepository.find(),
      this.accessGrantsRepository.find(),
      this.tournamentsRepository.findOne({ where: { status: TournamentStatus.ACTIVE }, order: { startsAt: 'ASC', id: 'ASC' } }),
    ]);
    const zones = tournament ? await this.zonesRepository.find({ where: { tournamentCategory: { tournamentId: tournament.id } }, relations: { venue: true, tournamentCategory: { category: true } } }) : [];

    return {
      posts: {
        total: posts.length,
        published: posts.filter((post) => post.published).length,
        featured: posts.filter((post) => post.featured).length,
        bySection: countBy(posts, 'section'),
      },
      registrations: {
        total: registrations.length,
        byCategory: countBy(registrations, 'category'),
        byStatus: countBy(registrations, 'status'),
        shirtSizes: countShirtSizes(registrations),
      },
      accessGrants: {
        total: accessGrants.length,
        byCategory: countBy(accessGrants, 'category'),
        byStatus: countBy(accessGrants, 'status'),
      },
      matchesByVenue: summarizeMatchesByVenue(tournament?.name ?? null, zones),
    };
  }
}

function summarizeMatchesByVenue(tournamentName: string | null, zones: Zone[]) {
  const venues = new Map<string, { venue: string; categories: Set<string>; matches: number }>();
  for (const zone of zones) {
    const current = venues.get(zone.venue.name) ?? { venue: zone.venue.name, categories: new Set<string>(), matches: 0 };
    current.categories.add(zone.tournamentCategory.category.name);
    current.matches += 4;
    venues.set(zone.venue.name, current);
  }
  const rows = [...venues.values()].sort((left, right) => left.venue.localeCompare(right.venue)).map((item) => ({ venue: item.venue, categories: [...item.categories].sort(), matches: item.matches }));
  return { tournamentName, venues: rows, totalMatches: rows.reduce((total, item) => total + item.matches, 0) };
}

function countShirtSizes(registrations: PairRegistration[]) {
  return registrations.reduce<Record<string, number>>((accumulator, registration) => {
    [registration.playerOneShirtSize, registration.playerTwoShirtSize, registration.playerThreeShirtSize]
      .filter((size): size is NonNullable<typeof size> => Boolean(size))
      .forEach((size) => { accumulator[size] = (accumulator[size] ?? 0) + 1; });
    return accumulator;
  }, {});
}

function countBy<T>(items: T[], key: keyof T & string) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const value = String((item as Record<string, unknown>)[key] ?? 'unknown');
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
