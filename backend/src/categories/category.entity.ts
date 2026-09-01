import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { PairCategory } from '../registrations/registration.enums';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: PairCategory, enumName: 'pair_category', unique: true })
  code: PairCategory;

  @Column()
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @OneToMany(() => Locality, (locality) => locality.category)
  localities: Locality[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
