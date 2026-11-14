import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

export interface MatchResultCardData {
  home: { team: string; players: string; score: number };
  away: { team: string; players: string; score: number };
}

export async function normalizeMatchPhoto(photo: Buffer) {
  return sharp(photo, { failOn: 'none' })
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
}

export async function renderMatchResultCard(photo: Buffer, data: MatchResultCardData) {
  const normalized = await normalizeMatchPhoto(photo);
  const width = normalized.info.width;
  const height = normalized.info.height;
  const panelHeight = Math.max(190, Math.round(height * 0.3));
  const scoreSize = Math.max(48, Math.round(width * 0.055));
  const teamSize = Math.max(25, Math.round(width * 0.027));
  const playerSize = Math.max(18, Math.round(width * 0.016));
  const sidePadding = Math.max(24, Math.round(width * 0.035));
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#062c27" stop-opacity="0"/><stop offset="1" stop-color="#062c27" stop-opacity="0.94"/></linearGradient></defs>
    <rect x="0" y="${height - panelHeight}" width="${width}" height="${panelHeight}" fill="url(#shade)"/>
    <rect x="${width / 2 - 1}" y="${height - panelHeight + 35}" width="2" height="${panelHeight - 60}" fill="#ffffff" opacity="0.42"/>
    <text x="${sidePadding}" y="${height - panelHeight + scoreSize + 35}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800">${data.home.score} PUNTOS</text>
    <text x="${sidePadding}" y="${height - 78}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800">${escapeXml(shorten(`Equipo ${data.home.team}`, 34))}</text>
    <text x="${sidePadding}" y="${height - 40}" fill="#ffffff" opacity="0.86" font-family="Arial, sans-serif" font-size="${playerSize}">${escapeXml(shorten(data.home.players, 46))}</text>
    <text x="${width - sidePadding}" y="${height - panelHeight + scoreSize + 35}" text-anchor="end" fill="#ffffff" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800">${data.away.score} PUNTOS</text>
    <text x="${width - sidePadding}" y="${height - 78}" text-anchor="end" fill="#ffffff" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800">${escapeXml(shorten(`Equipo ${data.away.team}`, 34))}</text>
    <text x="${width - sidePadding}" y="${height - 40}" text-anchor="end" fill="#ffffff" opacity="0.86" font-family="Arial, sans-serif" font-size="${playerSize}">${escapeXml(shorten(data.away.players, 46))}</text>
  </svg>`);
  const logoPath = resolveLogoPath();
  const composites: sharp.OverlayOptions[] = [{ input: overlay, top: 0, left: 0 }];
  if (logoPath) {
    const logoWidth = Math.max(110, Math.min(Math.round(width * 0.2), Math.round(height * 0.25)));
    const logo = await sharp(logoPath).resize({ width: logoWidth, height: logoWidth, fit: 'inside' }).png().toBuffer();
    composites.push({ input: logo, left: Math.round((width - logoWidth) / 2), top: Math.round((height - logoWidth) / 2) });
  }
  return sharp(normalized.data).composite(composites).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

function resolveLogoPath() {
  return [
    resolve(process.cwd(), '../frontend/dist/LogoFemme.png'),
    resolve(process.cwd(), '../frontend/public/LogoFemme.png'),
    resolve(process.cwd(), 'frontend/dist/LogoFemme.png'),
    resolve(process.cwd(), 'frontend/public/LogoFemme.png'),
  ].find(existsSync) ?? null;
}

function shorten(value: string, length: number) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}
