import { validate } from 'class-validator';
import { expect, it, vi } from 'vitest';
import { UserRole } from '../user.entity';
import { CreateUserDto } from './create-user.dto';

vi.mock('../user.entity', () => ({ UserRole: { DIRECTOR: 'DIRECTOR', COURT_LEADER: 'COURT_LEADER', ASSISTANT: 'ASSISTANT' } }));

const validUser = (role: UserRole) => Object.assign(new CreateUserDto(), {
  name: 'Responsable de cancha', email: 'cancha@example.com', password: 'segura123', role,
});

it('accepts the court leader role when creating a user', async () => {
  expect(await validate(validUser(UserRole.COURT_LEADER))).toHaveLength(0);
});

it('rejects legacy roles with a readable message', async () => {
  const errors = await validate(validUser(UserRole.ASSISTANT));
  expect(errors[0]?.constraints?.isIn).toBe('El rol debe ser Director o Lider de cancha.');
});
