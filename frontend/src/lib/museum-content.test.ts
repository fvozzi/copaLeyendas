import { describe, expect, it } from 'vitest';
import { museoPelotari } from './museum-content';

describe('Museo Pelotari links', () => {
  it('keeps the official web, Instagram and YouTube references together', () => {
    expect(museoPelotari.links.map((link) => link.url)).toEqual([
      'https://pasionporlapaleta.com.ar/',
      'https://www.instagram.com/museopelotari/',
      'https://www.youtube.com/@museopelotari',
    ]);
  });
});
