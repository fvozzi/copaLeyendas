import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContentSection } from '../content-post.entity';

export class CreatePostDto {
  @IsEnum(ContentSection)
  section: ContentSection;

  @IsString()
  @MinLength(4)
  @MaxLength(140)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(320)
  excerpt: string;

  @IsString()
  @MinLength(24)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
