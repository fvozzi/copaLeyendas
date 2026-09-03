import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

@Injectable()
export class GoogleDrivePhotoStorageService {
  private readonly logger = new Logger(GoogleDrivePhotoStorageService.name);
  private accessToken: string | null = null;
  private expiresAt = 0;
  private photosFolderId: string | null = null;

  constructor(private readonly config: ConfigService) {}

  enabled() {
    return Boolean(this.config.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON')?.trim() && this.config.get<string>('GOOGLE_DRIVE_TOURNAMENT_FOLDER_ID')?.trim());
  }

  async upload(file: Express.Multer.File, playerName: string) {
    if (!this.enabled()) return null;
    const folderId = await this.getPhotosFolderId();
    const extension = file.originalname.includes('.') ? file.originalname.slice(file.originalname.lastIndexOf('.')) : '';
    const metadata = { name: `${sanitize(playerName)}-${Date.now()}${extension}`, parents: [folderId] };
    const boundary = `copa-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.mimetype}\r\n\r\n`),
      readFileSync(file.path),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    if (!response.ok) throw new Error(`Google Drive rechazo la foto (${response.status}): ${await response.text()}`);
    const payload = await response.json() as { id: string };
    return `drive:${payload.id}`;
  }

  async remove(storedName: string) {
    if (!storedName.startsWith('drive:') || !this.enabled()) return;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${storedName.slice(6)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await this.token()}` } });
    if (!response.ok && response.status !== 404) this.logger.warn(`No se pudo eliminar foto de Drive: ${response.status}`);
  }

  private async getPhotosFolderId() {
    if (this.photosFolderId) return this.photosFolderId;
    const parent = this.config.getOrThrow<string>('GOOGLE_DRIVE_TOURNAMENT_FOLDER_ID').trim();
    const query = encodeURIComponent(`name = 'Fotos Jugadores' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const existing = await this.drive<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`);
    if (existing.files[0]) return this.photosFolderId = existing.files[0].id;
    const created = await this.drive<{ id: string }>('https://www.googleapis.com/drive/v3/files', { method: 'POST', body: JSON.stringify({ name: 'Fotos Jugadores', mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) });
    return this.photosFolderId = created.id;
  }

  private async drive<T>(url: string, init: RequestInit = {}) {
    const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`Google Drive respondio ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }

  private async token() {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    const account = this.account(); const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claims}`); signer.end();
    const assertion = `${header}.${claims}.${signer.sign(account.private_key).toString('base64url')}`;
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
    if (!response.ok) throw new Error(`No se pudo autenticar Google Drive: ${await response.text()}`);
    const result = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = result.access_token; this.expiresAt = Date.now() + (result.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private account(): ServiceAccount {
    const raw = this.config.getOrThrow<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    try { return JSON.parse(raw) as ServiceAccount; } catch { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as ServiceAccount; }
  }
}

function base64Url(value: string) { return Buffer.from(value).toString('base64url'); }
function sanitize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'jugadora'; }
