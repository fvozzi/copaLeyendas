import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAccessGrantDto } from './dto/create-access-grant.dto';
import { QueryAccessGrantsDto } from './dto/query-access-grants.dto';
import { UpdateAccessGrantStatusDto } from './dto/update-access-grant-status.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { RegistrationsService } from './registrations.service';

@Controller('registrations')
@UseGuards(JwtAuthGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('access-grants')
  listAccessGrants(@Query() query: QueryAccessGrantsDto) {
    return this.registrationsService.listAccessGrants(query);
  }

  @Post('access-grants')
  createAccessGrant(@Body() dto: CreateAccessGrantDto) {
    return this.registrationsService.createAccessGrant(dto);
  }

  @Patch('access-grants/:id/status')
  updateAccessGrantStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccessGrantStatusDto,
  ) {
    return this.registrationsService.updateAccessGrantStatus(id, dto);
  }

  @Get()
  list(@Query() query: QueryRegistrationsDto) {
    return this.registrationsService.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.registrationsService.getById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationStatusDto,
  ) {
    return this.registrationsService.updateStatus(id, dto);
  }

  @Get(':id/payment-proof')
  async getPaymentProof(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.registrationsService.getPaymentProof(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
    return file.stream;
  }
}
