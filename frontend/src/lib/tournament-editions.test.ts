import { describe, expect, it } from 'vitest';
import { getTournamentEdition, normalizeSearchText, tournamentEditions } from './tournament-editions';

describe('tournament editions archive', () => {
  it('keeps the three editions in reverse chronological order', () => {
    expect(tournamentEditions.map((edition) => edition.slug)).toEqual(['femme-2026', '2026', '2025']);
  });

  it('stores every historical final from the supplied results', () => {
    expect(getTournamentEdition('2025')?.finals).toHaveLength(5);
    expect(getTournamentEdition('2026')?.finals).toHaveLength(6);
    expect(getTournamentEdition('2025')?.finals.find((final) => final.category === 'Damas')?.champion.locality).toBe('Plottier');
    expect(getTournamentEdition('2026')?.finals.find((final) => final.category === '1ra')?.champion.locality).toBe('Venado Tuerto');
  });

  it('matches legend names without depending on accents or casing', () => {
    expect(normalizeSearchText('Aarón “Quique” Setter')).toBe('aaron “quique” setter');
    expect(normalizeSearchText('Rodolfo Bazán')).toContain('bazan');
  });
});
