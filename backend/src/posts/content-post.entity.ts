import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContentSection {
  LEYENDAS = 'leyendas',
  CANCHAS = 'canchas',
  TORNEOS = 'torneos',
  HISTORIAS = 'historias',
}

@Entity('content_posts')
export class ContentPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ContentSection,
    enumName: 'content_section',
  })
  section: ContentSection;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 320 })
  excerpt: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @Column({ default: false })
  published: boolean;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
