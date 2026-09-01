import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PairCategory } from '../registrations/registration.enums';
import { CategoriesService } from './categories.service';
class CategoryDto { @IsEnum(PairCategory) code: PairCategory; @IsString() @MinLength(2) @MaxLength(120) name: string; @IsOptional() @IsBoolean() active?: boolean; @IsOptional() @IsInt() sortOrder?: number; }
class UpdateCategoryDto { @IsOptional() @IsEnum(PairCategory) code?: PairCategory; @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string; @IsOptional() @IsBoolean() active?: boolean; @IsOptional() @IsInt() sortOrder?: number; }
@Controller('categories') @UseGuards(JwtAuthGuard)
export class CategoriesController { constructor(private readonly service: CategoriesService) {} @Get() list() { return this.service.list(); } @Post() create(@Body() dto: CategoryDto) { return this.service.create(dto); } @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) { return this.service.update(id, dto); } @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); } }
