import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

export class ProgramScenarioRuleDto {
  @IsInt() @Min(1) categoryId: number;
  @IsIn(['ZONE', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL']) stage: string;
  @IsOptional() @IsInt() @Min(1) zoneId?: number;
  @IsOptional() @IsInt() @Min(1) matchOrder?: number;
  @IsInt() @Min(1) venueId: number;
  @IsOptional() @IsInt() @Min(1) courtId?: number | null;
  @IsIn(['MAIN', 'FINALS']) day: 'MAIN' | 'FINALS';
}
export class ProgramScenarioDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) mainDay: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) finalsDay: string;
  @IsBoolean() interleaveCategories: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => ProgramScenarioRuleDto) rules: ProgramScenarioRuleDto[];
  @IsOptional() @IsString() @Matches(/^[a-f0-9]{64}$/) baseVersion?: string;
}
