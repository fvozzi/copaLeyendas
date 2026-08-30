import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentSection } from '../content-post.entity';

export class QueryPostsDto {
  @IsOptional()
  @IsEnum(ContentSection)
  section?: ContentSection;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
