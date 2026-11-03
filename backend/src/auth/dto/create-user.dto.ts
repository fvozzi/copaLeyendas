import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn([UserRole.DIRECTOR, UserRole.COURT_LEADER], { message: 'El rol debe ser Director o Lider de cancha.' })
  role: UserRole.DIRECTOR | UserRole.COURT_LEADER;
}
