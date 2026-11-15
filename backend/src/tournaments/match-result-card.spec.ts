import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { normalizeMatchPhoto, renderMatchResultCard } from './match-result-card';

describe('match result card', () => {
  it('normalizes a mobile photo into a browser-friendly JPEG', async () => {
    const source = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#6a8f86' } }).png().toBuffer();
    const normalized = await normalizeMatchPhoto(source);
    expect(normalized.info.format).toBe('jpeg');
    expect(normalized.info.width).toBe(1920);
    expect(normalized.info.height).toBe(1280);
  });

  it('creates the final JPEG plate at the original normalized dimensions', async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#d8c9b8' } }).jpeg().toBuffer();
    const result = await renderMatchResultCard(source, {
      home: { team: 'Ciudad', players: 'Ana Local / Bea Local', score: 25 },
      away: { team: 'Salta', players: 'Carla Visitante / Dora Visitante', score: 18 },
    });
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(800);
    expect(result.equals(source)).toBe(false);

    const topPanel = await sharp(result).extract({ left: 30, top: 36, width: 400, height: 224 }).raw().toBuffer();
    const clearBottom = await sharp(result).extract({ left: 30, top: 560, width: 400, height: 200 }).raw().toBuffer();
    const mean = (buffer: Buffer) => [...buffer].reduce((sum, value) => sum + value, 0) / buffer.length;
    expect(mean(topPanel)).toBeLessThan(mean(clearBottom) - 30);
  }, 15_000);
});
