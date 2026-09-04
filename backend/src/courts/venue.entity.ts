import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) address: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) provinceName: string | null;
  @Column({ type: 'time', default: '10:00' }) startsAt: string;
  @Column({ type: 'integer', default: 40 }) matchDurationMinutes: number;
  @Column({ type: 'integer', default: 16 }) matchesPerDay: number;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
