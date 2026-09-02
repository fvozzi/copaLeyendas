import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from './current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from './user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    this.assertDirector(user);
    return this.usersService.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    this.assertDirector(user);
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    this.assertDirector(user);
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    this.assertDirector(user);
    if (user.sub === id) throw new ForbiddenException('No podes eliminar tu propio usuario.');
    return this.usersService.remove(id);
  }

  private assertDirector(user: AuthenticatedUser) {
    if (user.role !== UserRole.DIRECTOR) throw new ForbiddenException('Solo Direccion puede administrar usuarios.');
  }
}
