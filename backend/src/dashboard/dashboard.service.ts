import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPost } from '../posts/content-post.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ContentPost)
    private readonly postsRepository: Repository<ContentPost>,
    @InjectRepository(PairRegistration)
    private readonly registrationsRepository: Repository<PairRegistration>,
    @InjectRepository(RegistrationAccessGrant)
    private readonly accessGrantsRepository: Repository<RegistrationAccessGrant>,
  ) {}

  async getSummary() {
    const [posts, registrations, accessGrants] = await Promise.all([
      this.postsRepository.find(),
      this.registrationsRepository.find(),
      this.accessGrantsRepository.find(),
    ]);

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
    };
  }
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
