import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../auth/user.entity';
import { CourtsService } from './courts.service';

class CourtDto { @IsString() @MinLength(2) @MaxLength(120) name: string; @IsOptional() @IsString() address?: string; @IsOptional() @IsString() city?: string; @IsOptional() @IsString() provinceName?: string; @IsOptional() @IsBoolean() active?: boolean; }
class CourtAssistantsDto { @IsArray() @IsInt({ each: true }) userIds: number[]; }

@Controller('courts')
@UseGuards(JwtAuthGuard)
export class CourtsController {
  constructor(private readonly service: CourtsService) {}
  @Get() list(@Query('search') search?: string) { return this.service.list(search); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CourtDto) { this.assertDirector(user); return this.service.create(dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CourtDto>) { this.assertDirector(user); return this.service.update(id, dto); }
  @Put(':id/assistants') setAssistants(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CourtAssistantsDto) { this.assertDirector(user); return this.service.setAssistants(id, dto.userIds); }
  @Delete(':id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) { this.assertDirector(user); return this.service.remove(id); }
  private assertDirector(user: AuthenticatedUser) { if (user.role !== UserRole.DIRECTOR) throw new ForbiddenException('Solo Direccion puede administrar canchas.'); }
}
