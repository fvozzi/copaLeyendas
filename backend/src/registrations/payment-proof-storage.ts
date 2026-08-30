import { mkdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

const DEFAULT_PAYMENT_PROOF_DIR = join('storage', 'payment-proofs');

export function resolvePaymentProofDir() {
  const configuredDir = process.env.PAYMENT_PROOF_STORAGE_DIR?.trim();

  if (!configuredDir) {
    return resolve(process.cwd(), DEFAULT_PAYMENT_PROOF_DIR);
  }

  return isAbsolute(configuredDir)
    ? configuredDir
    : resolve(process.cwd(), configuredDir);
}

export function ensurePaymentProofDir() {
  const paymentProofDir = resolvePaymentProofDir();
  mkdirSync(paymentProofDir, { recursive: true });
  return paymentProofDir;
}
