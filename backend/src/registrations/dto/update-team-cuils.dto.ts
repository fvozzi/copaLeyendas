import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, MaxLength, ValidateNested } from 'class-validator';

export class TeamPlayerCuilDto {
  @Type(() => Number)
  @IsInt()
  playerId: number;

  @IsString()
  @MaxLength(20)
  cuil: string;
}

export class UpdateTeamCuilsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TeamPlayerCuilDto)
  players: TeamPlayerCuilDto[];
}
