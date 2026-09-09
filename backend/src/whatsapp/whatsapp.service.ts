import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MetaMessageResponse = {
  messaging_product?: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string; message_status?: string }[];
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly configService: ConfigService) {}

  configurationStatus() {
    const required = {
      WHATSAPP_GRAPH_API_VERSION: this.config('WHATSAPP_GRAPH_API_VERSION'),
      WHATSAPP_PHONE_NUMBER_ID: this.config('WHATSAPP_PHONE_NUMBER_ID'),
      WHATSAPP_ACCESS_TOKEN: this.config('WHATSAPP_ACCESS_TOKEN'),
      WHATSAPP_VERIFY_TOKEN: this.config('WHATSAPP_VERIFY_TOKEN'),
      WHATSAPP_APP_SECRET: this.config('WHATSAPP_APP_SECRET'),
    };
    const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);

    return {
      configured: missing.length === 0,
      sendingConfigured: Boolean(required.WHATSAPP_GRAPH_API_VERSION && required.WHATSAPP_PHONE_NUMBER_ID && required.WHATSAPP_ACCESS_TOKEN),
      webhookConfigured: Boolean(required.WHATSAPP_VERIFY_TOKEN && required.WHATSAPP_APP_SECRET),
      missing,
      graphApiVersion: required.WHATSAPP_GRAPH_API_VERSION || null,
      phoneNumberId: required.WHATSAPP_PHONE_NUMBER_ID || null,
    };
  }

  sendText(to: string, message: string, previewUrl = false) {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'text',
      text: { body: message, preview_url: previewUrl },
    });
  }

  sendTemplate(to: string, templateName: string, languageCode = 'es_AR') {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'template',
      template: { name: templateName, language: { code: languageCode } },
    });
  }

  verifyWebhook(mode?: string, token?: string) {
    const verifyToken = this.required('WHATSAPP_VERIFY_TOKEN');
    if (mode !== 'subscribe' || !token || !safeEqual(token, verifyToken)) {
      throw new ForbiddenException('No se pudo verificar el webhook de WhatsApp');
    }
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signature?: string) {
    const appSecret = this.required('WHATSAPP_APP_SECRET');
    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new ForbiddenException('Firma de webhook ausente');
    }
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    if (!safeEqual(signature, expected)) {
      throw new ForbiddenException('Firma de webhook invalida');
    }
  }

  processWebhook(payload: unknown) {
    if (!isRecord(payload) || !Array.isArray(payload.entry)) return;
    for (const entry of payload.entry) {
      if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (!isRecord(change) || change.field !== 'messages' || !isRecord(change.value)) continue;
        const messages = Array.isArray(change.value.messages) ? change.value.messages : [];
        const statuses = Array.isArray(change.value.statuses) ? change.value.statuses : [];
        for (const message of messages) {
          if (isRecord(message)) this.logger.log(`Mensaje recibido: id=${String(message.id ?? '')} from=${String(message.from ?? '')} type=${String(message.type ?? '')}`);
        }
        for (const status of statuses) {
          if (isRecord(status)) this.logger.log(`Estado de mensaje: id=${String(status.id ?? '')} status=${String(status.status ?? '')}`);
        }
      }
    }
  }

  private async send(payload: Record<string, unknown>) {
    const version = this.required('WHATSAPP_GRAPH_API_VERSION');
    if (!/^v\d+\.\d+$/.test(version)) throw new ServiceUnavailableException('WHATSAPP_GRAPH_API_VERSION debe tener formato vNN.N');
    const phoneNumberId = this.required('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.required('WHATSAPP_ACCESS_TOKEN');
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as MetaMessageResponse;
    if (!response.ok) {
      this.logger.error(`Meta rechazo el mensaje: status=${response.status} code=${result.error?.code ?? 'unknown'} trace=${result.error?.fbtrace_id ?? 'unknown'}`);
      throw new BadGatewayException({
        message: result.error?.message ?? 'Meta rechazo el mensaje de WhatsApp',
        code: result.error?.code ?? null,
        subcode: result.error?.error_subcode ?? null,
      });
    }
    return result;
  }

  private config(key: string) {
    return this.configService.get<string>(key)?.trim() ?? '';
  }

  private required(key: string) {
    const value = this.config(key);
    if (!value) throw new ServiceUnavailableException(`Falta configurar ${key}`);
    return value;
  }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
