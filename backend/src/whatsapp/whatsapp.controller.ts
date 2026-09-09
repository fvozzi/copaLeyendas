import { Body, Controller, Get, Headers, HttpCode, Post, Query, RawBodyRequest, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { DirectorGuard } from '../auth/director.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendTemplateMessageDto } from './dto/send-template-message.dto';
import { SendTextMessageDto } from './dto/send-text-message.dto';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, DirectorGuard)
  status() {
    return this.whatsAppService.configurationStatus();
  }

  @Post('messages/text')
  @UseGuards(JwtAuthGuard, DirectorGuard)
  sendText(@Body() dto: SendTextMessageDto) {
    return this.whatsAppService.sendText(dto.to, dto.message, dto.previewUrl);
  }

  @Post('messages/template')
  @UseGuards(JwtAuthGuard, DirectorGuard)
  sendTemplate(@Body() dto: SendTemplateMessageDto) {
    return this.whatsAppService.sendTemplate(dto.to, dto.templateName, dto.languageCode);
  }

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ) {
    this.whatsAppService.verifyWebhook(mode, token);
    return response.status(200).type('text/plain').send(challenge ?? '');
  }

  @Post('webhook')
  @HttpCode(200)
  receiveWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ) {
    this.whatsAppService.verifyWebhookSignature(request.rawBody, signature);
    this.whatsAppService.processWebhook(payload);
    return { received: true };
  }
}
