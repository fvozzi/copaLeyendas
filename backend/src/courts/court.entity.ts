import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CourtAssistantAssignment } from './court-assistant-assignment.entity';

@Entity('courts')
export class Court {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) address: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) provinceName: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @OneToMany(() => CourtAssistantAssignment, (assignment) => assignment.court) assignments: CourtAssistantAssignment[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
