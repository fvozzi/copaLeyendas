import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll() {
    const users = await this.usersRepository.find({ order: { name: 'ASC' } });
    return users.map((user) => this.serialize(user));
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });

    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese email.');
    }

    const user = this.usersRepository.create({
      name: dto.name.trim(),
      email,
      role: dto.role,
      passwordHash: await bcrypt.hash(dto.password, 12),
    });

    return this.serialize(await this.usersRepository.save(user));
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findEntity(id);

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.usersRepository.findOne({ where: { email } });

      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe un usuario con ese email.');
      }

      user.email = email;
    }

    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.password !== undefined) user.passwordHash = await bcrypt.hash(dto.password, 12);

    return this.serialize(await this.usersRepository.save(user));
  }

  async remove(id: number) {
    const user = await this.findEntity(id);
    await this.usersRepository.remove(user);
    return { success: true };
  }

  private async findEntity(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  private serialize(user: User) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
}
