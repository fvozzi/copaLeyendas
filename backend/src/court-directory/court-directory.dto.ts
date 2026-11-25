import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { CommunityPlayerGender } from './community-court-player-group.entity';
import { CommunityCourtType, FrontonBackType, FrontonWallOrientation, TrinquetShareMaterial } from './community-court.entity';

export class CommunityCourtPlayerGroupDto {
  @IsEnum(CommunityPlayerGender) gender: CommunityPlayerGender;
  @IsOptional() @IsInt() @Min(0) @Max(120) minAge?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(120) maxAge?: number | null;
  @IsInt() @Min(1) @Max(100_000) playerCount: number;
}

export class CreateCommunityCourtDto {
  @IsString() @MinLength(2) @MaxLength(140) name: string;
  @IsString() @MinLength(2) @MaxLength(80) country: string;
  @IsString() @MinLength(2) @MaxLength(120) province: string;
  @IsString() @MinLength(2) @MaxLength(120) locality: string;
  @IsOptional() @IsString() @MaxLength(220) address?: string;
  @IsEnum(CommunityCourtType) courtType: CommunityCourtType;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.TRINQUET) @IsEnum(TrinquetShareMaterial) trinquetShareMaterial?: TrinquetShareMaterial;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.TRINQUET && dto.trinquetShareMaterial === TrinquetShareMaterial.OTHER) @IsString() @MinLength(2) @MaxLength(100) trinquetShareMaterialOther?: string;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.FRONTON) @IsEnum(FrontonWallOrientation) frontonWallOrientation?: FrontonWallOrientation;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.FRONTON) @IsBoolean() frontonHasCacerola?: boolean;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.FRONTON) @IsEnum(FrontonBackType) frontonBackType?: FrontonBackType;
  @ValidateIf((dto: CreateCommunityCourtDto) => dto.courtType === CommunityCourtType.FRONTON && dto.frontonBackType === FrontonBackType.REBOUND) @IsString() @MinLength(2) @MaxLength(100) frontonReboundMaterial?: string;
  @IsNumber() @Min(-90) @Max(90) latitude: number;
  @IsNumber() @Min(-180) @Max(180) longitude: number;
  @IsOptional() @IsNumber() @Min(1) @Max(200) lengthMeters?: number | null;
  @IsOptional() @IsNumber() @Min(1) @Max(200) widthMeters?: number | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CommunityCourtPlayerGroupDto)
  playerGroups: CommunityCourtPlayerGroupDto[];
}

export class QueryCommunityCourtsDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsEnum(CommunityCourtType) courtType?: CommunityCourtType;
  @IsOptional() @IsEnum(CommunityPlayerGender) gender?: CommunityPlayerGender;
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
}
