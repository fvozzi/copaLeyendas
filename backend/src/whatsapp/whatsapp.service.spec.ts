import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, ForbiddenException, Logger } from '@nestjs/common';
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

  it('supports a separately approved template name and language and normalizes body variables', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] })));
    const service = createService({ ...configuration,
      WHATSAPP_REGISTRATION_TEMPLATE_NAME: 'inscripcion_copa_v2',
      WHATSAPP_REGISTRATION_TEMPLATE_LANGUAGE: 'es',
    });
    await service.sendRegistrationToken('+5491112345678', ' Facundo\nPerez ', 'COPA-ABCD1234', ' Junin  ', 'https://copa.example.com', 'Damas\tA');
    const payload = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(payload.template.name).toBe('inscripcion_copa_v2');
    expect(payload.template.language.code).toBe('es');
    expect(payload.template.components[0].parameters.map((parameter: { text: string }) => parameter.text)).toEqual([
      'Facundo Perez', 'Junin', 'Damas A', 'https://copa.example.com/inscripcion?token=COPA-ABCD1234',
    ]);
  });

  it('keeps parameterless templates compatible with the existing template endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] })));
    await createService().sendTemplate('+5491112345678', 'hello_world', 'en_US');
    const payload = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(payload.template).toEqual({ name: 'hello_world', language: { code: 'en_US' } });
  });

  it('reports a rejected template without retrying as free-form text', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 132001, message: 'Template not found' },
    }), { status: 400 }));
    await expect(createService().sendRegistrationToken('+5491112345678', 'Facundo', 'COPA-ABCD1234', 'Junin', 'https://copa.example.com', 'Damas A'))
      .rejects.toThrow(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends the registration template with contact, team, category and the token link in order', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.registration' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await createService().sendRegistrationToken(
      '+54 9 11 1234-5678',
      'Facundo',
      'COPA-ABCDEFGH',
      'Rosario',
      'https://copa.example.com',
      'Damas A',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/123456789/messages',
      expect.objectContaining({
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5491112345678',
          type: 'template',
          template: {
            name: 'inscripcion_copa_leyendas',
            language: { code: 'es_AR' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: 'Facundo' },
                { type: 'text', text: 'Rosario' },
                { type: 'text', text: 'Damas A' },
                { type: 'text', text: 'https://copa.example.com/inscripcion?token=COPA-ABCDEFGH' },
              ],
            }],
          },
        }),
      }),
    );
  });
});
