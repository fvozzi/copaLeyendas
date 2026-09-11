import { IsBoolean, IsInt, Max, Min } from 'class-validator';
export class UpdateBackupSettingsDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(1) @Max(365) retentionCount: number;
  @IsInt() @Min(0) @Max(23) scheduleHour: number;
  @IsInt() @Min(0) @Max(59) scheduleMinute: number;
}
