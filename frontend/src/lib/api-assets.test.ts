import { describe, expect, it } from 'vitest';
import { matchResultPhotoUrl, resolveApiAssetUrl } from './api';

describe('resolveApiAssetUrl', () => {
  it('uses the configured API host for public media paths', () => {
    expect(resolveApiAssetUrl('/api/public/tournaments/matches/8/photo?v=1', 'http://192.168.0.17:3001/api'))
      .toBe('http://192.168.0.17:3001/api/public/tournaments/matches/8/photo?v=1');
  });

  it('keeps production same-origin and absolute URLs valid', () => {
    expect(resolveApiAssetUrl('/api/public/tournaments/matches/8/photo', '/api'))
      .toBe('/api/public/tournaments/matches/8/photo');
    expect(resolveApiAssetUrl('https://cdn.example.com/photo.jpg', '/api'))
      .toBe('https://cdn.example.com/photo.jpg');
  });

  it('builds a stable public result-photo URL instead of a temporary blob URL', () => {
    expect(matchResultPhotoUrl(733, 'http://192.168.0.17:3001/api'))
      .toBe('http://192.168.0.17:3001/api/public/tournaments/matches/733/photo');
  });
});
