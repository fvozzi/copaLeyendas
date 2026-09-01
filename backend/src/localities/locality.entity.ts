import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Player } from '../players/player.entity';

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

  @OneToMany(() => Player, (player) => player.locality)
  players: Player[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
