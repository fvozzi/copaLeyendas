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
  const teamSize = Math.max(20, Math.min(Math.round(width * 0.021), Math.round(panelWidth * 0.06)));
  const playerSize = Math.max(17, Math.min(Math.round(width * 0.015), Math.round(panelWidth * 0.045)));
  const textWidth = Math.max(1, panelWidth - Math.max(28, Math.round(panelWidth * 0.12)));
  const homeTeam = shorten(data.home.team, 34);
  const awayTeam = shorten(data.away.team, 34);
  const homePlayers = shorten(data.home.players, 42);
  const awayPlayers = shorten(data.away.players, 42);
  const scoreY = topPadding + Math.round(panelHeight * 0.17) + scoreSize;
  const teamY = topPadding + Math.round(panelHeight * 0.68);
  const playersY = topPadding + Math.round(panelHeight * 0.86);
  const panelRadius = Math.max(12, Math.round(width * 0.012));
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="homePanel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#dcf4e6"/>
        <stop offset="1" stop-color="#9fd8b9"/>
      </linearGradient>
      <linearGradient id="awayPanel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f9dedb"/>
        <stop offset="1" stop-color="#eca9a2"/>
      </linearGradient>
    </defs>
    <rect x="${sidePadding}" y="${topPadding + 6}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#174d3e" opacity="0.45"/>
    <rect x="${rightPanelX}" y="${topPadding + 6}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#762f2a" opacity="0.45"/>
    <rect x="${sidePadding}" y="${topPadding}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="url(#homePanel)" opacity="0.94"/>
    <rect x="${rightPanelX}" y="${topPadding}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="url(#awayPanel)" opacity="0.94"/>
    <text x="${sidePadding + panelWidth / 2}" y="${scoreY}" text-anchor="middle" fill="#103c32" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800"${fitText(`${data.home.score} PUNTOS`, scoreSize, textWidth, 0.64)}>${data.home.score} PUNTOS</text>
    <text x="${sidePadding + panelWidth / 2}" y="${teamY}" text-anchor="middle" fill="#103c32" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800"${fitText(homeTeam, teamSize, textWidth, 0.6)}>${escapeXml(homeTeam)}</text>
    <text x="${sidePadding + panelWidth / 2}" y="${playersY}" text-anchor="middle" fill="#1f493f" opacity="0.92" font-family="Arial, sans-serif" font-size="${playerSize}"${fitText(homePlayers, playerSize, textWidth, 0.55)}>${escapeXml(homePlayers)}</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${scoreY}" text-anchor="middle" fill="#642722" font-family="Arial, sans-serif" font-size="${scoreSize}" font-weight="800"${fitText(`${data.away.score} PUNTOS`, scoreSize, textWidth, 0.64)}>${data.away.score} PUNTOS</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${teamY}" text-anchor="middle" fill="#642722" font-family="Arial, sans-serif" font-size="${teamSize}" font-weight="800"${fitText(awayTeam, teamSize, textWidth, 0.6)}>${escapeXml(awayTeam)}</text>
    <text x="${rightPanelX + panelWidth / 2}" y="${playersY}" text-anchor="middle" fill="#743630" opacity="0.92" font-family="Arial, sans-serif" font-size="${playerSize}"${fitText(awayPlayers, playerSize, textWidth, 0.55)}>${escapeXml(awayPlayers)}</text>
  </svg>`);
  const logoPath = resolveLogoPath();
  const composites: sharp.OverlayOptions[] = [{ input: overlay, top: 0, left: 0 }];
  if (logoPath) {
    const logo = await sharp(logoPath).resize({ width: logoWidth, height: logoWidth, fit: 'inside' }).png().toBuffer();
    composites.push({ input: logo, left: Math.round((width - logoWidth) / 2), top: topPadding });
  }
  return sharp(normalized.data).composite(composites).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function renderMatchLogoWatermark(photo: Buffer) {
  const normalized = await normalizeMatchPhoto(photo);
  const width = normalized.info.width;
  const height = normalized.info.height;
  const logoPath = resolveLogoPath();
  if (!logoPath) return normalized.data;

  const logoWidth = Math.max(120, Math.min(Math.round(width * 0.24), Math.round(height * 0.24)));
  const logo = await sharp(logoPath).resize({ width: logoWidth, height: logoWidth, fit: 'inside' }).png().toBuffer();
  const watermark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <image href="data:image/png;base64,${logo.toString('base64')}" x="${Math.round((width - logoWidth) / 2)}" y="${Math.round((height - logoWidth) / 2)}" width="${logoWidth}" height="${logoWidth}" opacity="0.78"/>
  </svg>`);
  return sharp(normalized.data).composite([{ input: watermark, top: 0, left: 0 }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
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

function fitText(value: string, fontSize: number, maxWidth: number, averageGlyphWidth: number) {
  const estimatedWidth = value.length * fontSize * averageGlyphWidth;
  return estimatedWidth > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}
