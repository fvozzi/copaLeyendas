import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CreatePublicRegistrationDto } from './dto/create-public-registration.dto';
import { ensurePaymentProofDir } from './payment-proof-storage';
import { RegistrationsService } from './registrations.service';

@Controller('public/registrations')
export class PublicRegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Get('access/:token')
  getAccessToken(@Param('token') token: string) {
    return this.registrationsService.getPublicAccessGrant(token);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('paymentProof', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          callback(null, ensurePaymentProofDir());
        },
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  create(
    @Body() dto: CreatePublicRegistrationDto,
    @UploadedFile() paymentProof?: Express.Multer.File,
  ) {
    return this.registrationsService.createPublic(dto, paymentProof);
  }
}
