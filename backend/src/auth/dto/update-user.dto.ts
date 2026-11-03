import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn([UserRole.DIRECTOR, UserRole.COURT_LEADER], { message: 'El rol debe ser Director o Lider de cancha.' })
  role?: UserRole.DIRECTOR | UserRole.COURT_LEADER;
}
