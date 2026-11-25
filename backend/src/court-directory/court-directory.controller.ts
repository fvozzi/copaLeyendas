import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CreateCommunityCourtDto, QueryCommunityCourtsDto } from './court-directory.dto';
import { CourtDirectoryService } from './court-directory.service';

@Controller('public/court-directory')
export class CourtDirectoryController {
  constructor(private readonly directory: CourtDirectoryService) {}

  @Get()
  list(@Query() query: QueryCommunityCourtsDto) {
    return this.directory.list(query);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 6, { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 6 } }))
  create(@Body() dto: CreateCommunityCourtDto, @UploadedFiles() photos: Express.Multer.File[] = []) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (photos.some((photo) => !allowedTypes.includes(photo.mimetype))) throw new BadRequestException('Las fotos deben ser JPG, PNG, WebP, HEIC o HEIF.');
    return this.directory.create(dto, photos);
  }

  @Get(':courtId/photos/:photoId')
  async photo(@Param('courtId', ParseIntPipe) courtId: number, @Param('photoId', ParseIntPipe) photoId: number, @Res({ passthrough: true }) response: Response) {
    const photo = await this.directory.photo(courtId, photoId);
    response.setHeader('Content-Type', photo.mimeType);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(photo.buffer);
  }
}
