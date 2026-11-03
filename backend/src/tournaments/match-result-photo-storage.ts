import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_DIR = join('storage', 'match-results');
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export function resolveMatchResultPhotoDir() {
  const configured = process.env.MATCH_RESULT_PHOTO_STORAGE_DIR?.trim();
  if (!configured) return resolve(process.cwd(), DEFAULT_DIR);
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

export async function storeMatchResultPhoto(file: Express.Multer.File) {
  const extension = EXTENSIONS[file.mimetype] ?? extname(file.originalname).toLowerCase();
  const storedName = `${randomUUID()}${extension}`;
  const directory = resolveMatchResultPhotoDir();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storedName), file.buffer, { flag: 'wx' });
  return storedName;
}

export function readMatchResultPhoto(storedName: string) {
  return readFile(join(resolveMatchResultPhotoDir(), storedName));
}

export async function removeMatchResultPhoto(storedName: string) {
  await unlink(join(resolveMatchResultPhotoDir(), storedName)).catch(() => undefined);
}
