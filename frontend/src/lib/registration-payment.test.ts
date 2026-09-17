import { describe, expect, it } from 'vitest';
import { registrationPaymentLabel } from './registration-payment';

describe('registration payment', () => {
  const registration = { status: 'CONFIRMED' as const, feeWaived: false, paymentDeferredUntilConfirmed: false, paymentProofStoredName: 'receipt.pdf' };
  it('shows confirmed receipts as paid, including formerly deferred payments', () => {
    expect(registrationPaymentLabel(registration)).toBe('Pagado');
    expect(registrationPaymentLabel({ ...registration, paymentDeferredUntilConfirmed: true })).toBe('Pagado');
    expect(registrationPaymentLabel({ ...registration, status: 'UNDER_REVIEW' })).toBe('Comprobante recibido');
  });
  it('does not infer payment from confirmation alone and preserves waivers', () => {
    expect(registrationPaymentLabel({ ...registration, paymentProofStoredName: null })).toBe('Pendiente');
    expect(registrationPaymentLabel({ ...registration, feeWaived: true })).toBe('Bonificada');
    expect(registrationPaymentLabel({ ...registration, status: 'WAITLIST', paymentProofStoredName: null, paymentDeferredUntilConfirmed: true })).toBe('Al confirmar');
  });
});
