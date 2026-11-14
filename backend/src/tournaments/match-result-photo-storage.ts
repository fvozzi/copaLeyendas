import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_DIR = join('storage', 'match-results');
export function resolveMatchResultPhotoDir() {
  const configured = process.env.MATCH_RESULT_PHOTO_STORAGE_DIR?.trim();
  if (!configured) return resolve(process.cwd(), DEFAULT_DIR);
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

export async function storeMatchPhotoBuffer(buffer: Buffer, extension = '.jpg') {
  const storedName = `${randomUUID()}${extension}`;
  const directory = resolveMatchResultPhotoDir();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, storedName), buffer, { flag: 'wx' });
  return storedName;
}

export function readMatchResultPhoto(storedName: string) {
  return readFile(join(resolveMatchResultPhotoDir(), storedName));
}

export async function removeMatchResultPhoto(storedName: string) {
  await unlink(join(resolveMatchResultPhotoDir(), storedName)).catch(() => undefined);
}
