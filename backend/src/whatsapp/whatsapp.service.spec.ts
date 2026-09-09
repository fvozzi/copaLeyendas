import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppService } from './whatsapp.service';

const configuration = {
  WHATSAPP_GRAPH_API_VERSION: 'v25.0',
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_ACCESS_TOKEN: 'test-access-token',
  WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
  WHATSAPP_APP_SECRET: 'test-app-secret',
};

function createService(values: Record<string, string> = configuration) {
  return new WhatsAppService(new ConfigService(values));
}

describe('WhatsAppService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports missing settings without exposing secrets', () => {
    const status = createService({ WHATSAPP_PHONE_NUMBER_ID: '123' }).configurationStatus();
    expect(status.configured).toBe(false);
    expect(status.phoneNumberId).toBe('123');
    expect(status.missing).toContain('WHATSAPP_ACCESS_TOKEN');
    expect(status).not.toHaveProperty('accessToken');
  });

  it('validates the webhook verification token', () => {
    const service = createService();
    expect(() => service.verifyWebhook('subscribe', configuration.WHATSAPP_VERIFY_TOKEN)).not.toThrow();
    expect(() => service.verifyWebhook('subscribe', 'incorrect')).toThrow(ForbiddenException);
  });

  it('validates webhook payload signatures', () => {
    const service = createService();
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac('sha256', configuration.WHATSAPP_APP_SECRET).update(body).digest('hex')}`;
    expect(() => service.verifyWebhookSignature(body, signature)).not.toThrow();
    expect(() => service.verifyWebhookSignature(body, 'sha256=incorrect')).toThrow(ForbiddenException);
  });

  it('logs asynchronous delivery failures with the reason returned by Meta', () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    createService().processWebhook({
      entry: [{ changes: [{ field: 'messages', value: { statuses: [{
        id: 'wamid.failed',
        status: 'failed',
        errors: [null, {
          code: 131047,
          title: 'Re-engagement message',
          message: 'Re-engagement message',
          error_data: { details: 'More than 24 hours have passed since the recipient last replied.' },
        }],
      }] } }] }],
    });
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('id=wamid.failed status=failed'));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('"code":131047'));
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('More than 24 hours'));
  });

  it('sends normalized phone numbers to the configured Graph API endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await createService().sendText('+54 9 11 1234-5678', 'Prueba');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/123456789/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5491112345678',
          type: 'text',
          text: { body: 'Prueba', preview_url: false },
        }),
      }),
    );
  });

  it('sends a personalized registration token message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.registration' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await createService().sendRegistrationToken(
      '+54 9 11 1234-5678',
      'Facundo',
      'COPA-ABCDEFGH',
      'Rosario',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/123456789/messages',
      expect.objectContaining({
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5491112345678',
          type: 'text',
          text: {
            body: [
              'Hola Facundo,',
              '',
              'Te enviamos el token de inscripcion para Rosario en Copa Leyendas:',
              '',
              'COPA-ABCDEFGH',
              '',
              'Ingresalo en la seccion Inscripcion del sitio para completar el registro.',
            ].join('\n'),
            preview_url: false,
          },
        }),
      }),
    );
  });
});
