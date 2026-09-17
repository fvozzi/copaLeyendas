import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { RegistrationAccessGrant } from '../types';
import { WhatsAppDeliveryStatus } from './WhatsAppDeliveryStatus';

const render = (values: Partial<RegistrationAccessGrant>) => renderToStaticMarkup(createElement(WhatsAppDeliveryStatus, { grant: values as RegistrationAccessGrant }));
it('distinguishes accepted sends without confirmation from delivered and read messages', () => {
  expect(render({})).toContain('Sin envío registrado');
  expect(render({ whatsappSentAt: '2026-09-16T19:50:00Z' })).toContain('Sin confirmación de entrega');
  for (const [status, label] of [['delivered', 'Entregado'], ['read', 'Leído']] as const) {
    const html = render({ whatsappDelivery: { messageId: 'one', status, statusAt: '2026-09-16T19:51:00Z', errorCode: null, errorMessage: null } });
    expect(html).toContain(label);
    expect(html).not.toContain('Sin confirmación');
  }
});
it('shows the delivery error code and reason as escaped text', () => {
  const html = render({ whatsappDelivery: { messageId: 'one', status: 'failed', statusAt: '2026-09-16T19:51:00Z', errorCode: 131049, errorMessage: '<script>failure</script>' } });
  expect(html).toContain('Fallido');
  expect(html).toContain('Error 131049');
  expect(html).not.toContain('<script>');
});
