import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from './user.entity';

export type AuthenticatedUser = {
  sub: number;
  email: string;
  name: string;
  role: UserRole;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
