import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Player } from '../players/player.entity';
import { Category } from '../categories/category.entity';
import { JoinColumn, ManyToOne } from 'typeorm';

@Entity('localities')
export class Locality {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  provinceName: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.localities, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @OneToMany(() => Player, (player) => player.locality)
  players: Player[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
