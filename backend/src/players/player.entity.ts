import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Locality } from '../localities/locality.entity';
import { ShirtSize } from '../registrations/registration.enums';
import { ShirtModel } from './shirt-model';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullName: string;

  @Column({ unique: true })
  dni: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  cuil: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  instagram: string | null;

  @Column({ type: 'enum', enum: ShirtSize, enumName: 'shirt_size', nullable: true })
  shirtSize: ShirtSize | null;

  @Column({ type: 'enum', enum: ShirtModel, enumName: 'shirt_model', nullable: true })
  shirtModel: ShirtModel | null;

  @Column({ type: 'integer', nullable: true })
  localityId: number | null;

  @ManyToOne(() => Locality, (locality) => locality.players, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'localityId' })
  locality: Locality | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
