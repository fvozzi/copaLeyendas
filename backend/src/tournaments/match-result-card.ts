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
  const sidePadding = Math.max(24, Math.round(width * 0.025));
  const topPadding = Math.max(24, Math.round(height * 0.045));
  const panelHeight = Math.max(170, Math.round(height * 0.28));
  const logoWidth = Math.max(110, Math.min(Math.round(width * 0.2), Math.round(height * 0.25)));
  const centerGap = logoWidth + Math.max(36, Math.round(width * 0.04));
  const panelWidth = Math.floor((width - sidePadding * 2 - centerGap) / 2);
  const rightPanelX = width - sidePadding - panelWidth;
  const scoreSize = Math.max(42, Math.min(Math.round(width * 0.055), Math.round(panelWidth * 0.16)));
  const teamSize = Math.max(23, Math.min(Math.round(width * 0.025), Math.round(panelWidth * 0.072)));
  const playerSize = Math.max(17, Math.min(Math.round(width * 0.015), Math.round(panelWidth * 0.045)));
  const scoreY = topPadding + Math.round(panelHeight * 0.17) + scoreSize;
  const teamY = topPadding + Math.round(panelHeight * 0.68);
  const playersY = topPadding + Math.round(panelHeight * 0.86);
  const panelRadius = Math.max(12, Math.round(width * 0.012));
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${sidePadding}" y="${topPadding + 5}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#001b18" opacity="0.42"/>
    <rect x="${rightPanelX}" y="${topPadding + 5}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#001b18" opacity="0.42"/>
    <rect x="${sidePadding}" y="${topPadding}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#062c27" opacity="0.78"/>
    <rect x="${rightPanelX}" y="${topPadding}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#062c27" opacity="0.78"/>
    <text x="${sidePadding + panelWidth / 2}" y="${scoreY}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800">${data.home.score} PUNTOS</text>
    <text x="${sidePadding + panelWidth / 2}" y="${teamY}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800">${escapeXml(shorten(`Equipo ${data.home.team}`, 30))}</text>
    <text x="${sidePadding + panelWidth / 2}" y="${playersY}" text-anchor="middle" fill="#ffffff" opacity="0.9" font-family="Arial, sans-serif" font-size="${playerSize}">${escapeXml(shorten(data.home.players, 42))}</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${scoreY}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800">${data.away.score} PUNTOS</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${teamY}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800">${escapeXml(shorten(`Equipo ${data.away.team}`, 30))}</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${playersY}" text-anchor="middle" fill="#ffffff" opacity="0.9" font-family="Arial, sans-serif" font-size="${playerSize}">${escapeXml(shorten(data.away.players, 42))}</text>
  </svg>`);
  const logoPath = resolveLogoPath();
  const composites: sharp.OverlayOptions[] = [{ input: overlay, top: 0, left: 0 }];
  if (logoPath) {
    const logo = await sharp(logoPath).resize({ width: logoWidth, height: logoWidth, fit: 'inside' }).png().toBuffer();
    composites.push({ input: logo, left: Math.round((width - logoWidth) / 2), top: topPadding });
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
