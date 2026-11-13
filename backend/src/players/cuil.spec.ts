import { describe, expect, it } from 'vitest';
import { cuilMatchesDni, formatCuil, normalizeAndValidateCuil } from './cuil';

describe('CUIL validation', () => {
  it('normalizes a valid CUIL and verifies its embedded DNI', () => {
    expect(normalizeAndValidateCuil('20-12345678-6', '12345678')).toBe('20123456786');
    expect(formatCuil('20123456786')).toBe('20-12345678-6');
  });

  it('rejects a CUIL belonging to a different DNI', () => {
    expect(() => normalizeAndValidateCuil('20-12345678-6', '87654321')).toThrow('no coincide');
  });

  it('rejects an invalid verifier', () => {
    expect(() => normalizeAndValidateCuil('20-12345678-5', '12345678')).toThrow('verificador');
  });

  it('detects when a corrected DNI requires clearing the previous CUIL', () => {
    expect(cuilMatchesDni('20123456786', '12345678')).toBe(true);
    expect(cuilMatchesDni('20123456786', '87654321')).toBe(false);
  });
});
