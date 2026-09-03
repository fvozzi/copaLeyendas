import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
    FileFieldsInterceptor([{ name: 'paymentProof', maxCount: 1 }, { name: 'playerOnePhoto', maxCount: 1 }, { name: 'playerTwoPhoto', maxCount: 1 }, { name: 'playerThreePhoto', maxCount: 1 }], {
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
        files: 4,
      },
      fileFilter: (_request, file, callback) => {
        if (file.fieldname !== 'paymentProof' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Las fotos deben ser JPG, PNG o WebP'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Body() dto: CreatePublicRegistrationDto,
    @UploadedFiles() files?: Record<string, Express.Multer.File[]>,
  ) {
    return this.registrationsService.createPublic(dto, {
      paymentProof: files?.paymentProof?.[0],
      playerOnePhoto: files?.playerOnePhoto?.[0],
      playerTwoPhoto: files?.playerTwoPhoto?.[0],
      playerThreePhoto: files?.playerThreePhoto?.[0],
    });
  }
}
