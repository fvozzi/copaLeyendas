import type { PairRegistration } from '../types';

type PaymentSummary = Pick<PairRegistration, 'status' | 'feeWaived' | 'paymentDeferredUntilConfirmed' | 'paymentProofStoredName'>;

export function registrationPaymentLabel(registration: PaymentSummary): string {
  if (registration.feeWaived) return 'Bonificada';
  if (registration.paymentProofStoredName) {
    return registration.status === 'CONFIRMED' ? 'Pagado' : 'Comprobante recibido';
  }
  if (registration.paymentDeferredUntilConfirmed && registration.status !== 'CONFIRMED') return 'Al confirmar';
  return 'Pendiente';
}
