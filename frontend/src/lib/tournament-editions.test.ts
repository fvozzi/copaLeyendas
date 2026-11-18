import { describe, expect, it } from 'vitest';
import { getTournamentEdition, normalizeSearchText, tournamentEditions } from './tournament-editions';

describe('tournament editions archive', () => {
  it('keeps the three editions in reverse chronological order', () => {
    expect(tournamentEditions.map((edition) => edition.slug)).toEqual(['femme-2026', '2026', '2025']);
  });

  it('stores every historical final from the supplied results', () => {
    expect(getTournamentEdition('2025')?.finals).toHaveLength(5);
    expect(getTournamentEdition('2026')?.finals).toHaveLength(6);
    expect(getTournamentEdition('2025')?.photos).toHaveLength(133);
    expect(getTournamentEdition('2026')?.photos).toHaveLength(63);
    expect(getTournamentEdition('2025')?.photos[132]?.src).toBe('/torneos/2025/fotos/foto-133.webp');
    expect(getTournamentEdition('2026')?.photos[62]?.src).toBe('/torneos/2026/fotos/foto-63.webp');
    expect(getTournamentEdition('2025')?.finals.find((final) => final.category === 'Damas')?.champion.locality).toBe('Plottier');
    expect(getTournamentEdition('2026')?.finals.find((final) => final.category === '1ra')?.champion.locality).toBe('Venado Tuerto');
  });

  it('matches legend names without depending on accents or casing', () => {
    expect(normalizeSearchText('Aarón “Quique” Sehter')).toBe('aaron “quique” sehter');
    expect(normalizeSearchText('Rodolfo Bazán')).toContain('bazan');
  });

  it('includes the editorial profiles and interviews supplied for each edition', () => {
    expect(getTournamentEdition('femme-2026')?.legendContent.image?.src).toContain('silvina-cimadamore.webp');
    expect(getTournamentEdition('2026')?.legendContent.interview?.url).toContain('mS0TVfKJn0I');
    expect(getTournamentEdition('2026')?.legendContent.interview?.embedUrl).toContain('youtube-nocookie.com/embed/mS0TVfKJn0I?start=17');
    expect(getTournamentEdition('2025')?.legendContent.interview?.url).toContain('WA8mIbbOJzs');
    expect(getTournamentEdition('2025')?.legendContent.interview?.embedUrl).toContain('youtube-nocookie.com/embed/WA8mIbbOJzs?start=114');
  });
});
