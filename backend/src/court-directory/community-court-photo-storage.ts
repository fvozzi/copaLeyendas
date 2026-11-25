import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';

const DEFAULT_DIR = join('storage', 'community-courts');

export function resolveCommunityCourtPhotoDir() {
  const configured = process.env.COMMUNITY_COURT_PHOTO_STORAGE_DIR?.trim();
  if (!configured) return resolve(process.cwd(), DEFAULT_DIR);
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

export async function storeCommunityCourtPhoto(buffer: Buffer) {
  const storedName = `${randomUUID()}.jpg`;
  const normalized = await sharp(buffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  const directory = resolveCommunityCourtPhotoDir();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storedName), normalized, { flag: 'wx' });
  return storedName;
}

export function readCommunityCourtPhoto(storedName: string) {
  return readFile(join(resolveCommunityCourtPhotoDir(), storedName));
}

export async function removeCommunityCourtPhoto(storedName: string) {
  await unlink(join(resolveCommunityCourtPhotoDir(), storedName)).catch(() => undefined);
}
