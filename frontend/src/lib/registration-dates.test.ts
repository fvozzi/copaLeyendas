import { expect, it } from 'vitest';
import { formatRegistrationDate } from './registration-dates';

it('shows the Argentina calendar day and time when UTC falls on the next day', () => {
  expect(formatRegistrationDate('2026-09-10T01:05:00.000Z')).toBe('09/09/2026, 22:05');
});
