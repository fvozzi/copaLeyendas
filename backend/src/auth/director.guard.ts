import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from './user.entity';

@Injectable()
export class DirectorGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role === UserRole.DIRECTOR) return true;
    throw new ForbiddenException('Solo Direccion puede realizar esta operacion.');
  }
}
