import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { PairRegistration } from '../registrations/pair-registration.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { TournamentCategory } from '../tournaments/tournament-category.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @OneToMany(() => Locality, (locality) => locality.category)
  localities: Locality[];

  @OneToMany(() => RegistrationAccessGrant, (grant) => grant.category)
  accessGrants: RegistrationAccessGrant[];

  @OneToMany(() => PairRegistration, (registration) => registration.category)
  registrations: PairRegistration[];

  @OneToMany(() => TournamentCategory, (tournamentCategory) => tournamentCategory.category)
  tournamentCategories: TournamentCategory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
