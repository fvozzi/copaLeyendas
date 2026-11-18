import { describe, expect, it } from 'vitest';
import { pelotaPaletaHistory } from './history-content';

describe('pelota paleta historical feature', () => {
  it('preserves the chronology and selected historical images', () => {
    expect(pelotaPaletaHistory.chapters.map((chapter) => chapter.period)).toEqual(['Hacia 1800', '1905', 'Desde 1909']);
    expect(pelotaPaletaHistory.chapters.flatMap((chapter) => chapter.images)).toHaveLength(5);
    expect(pelotaPaletaHistory.chapters[1].title).toContain('nace la paleta');
  });
});
