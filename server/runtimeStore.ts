import fs from 'fs';
import path from 'path';

const dataDirectory = process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');

export function loadJson<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(dataDirectory, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function loadJsonStrict<T>(filename: string, missingFileFallback: T): T {
  try {
    const filePath = path.join(dataDirectory, filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    if (isMissingFileError(error)) return missingFileFallback;
    throw error;
  }
}

export function saveJson<T>(filename: string, value: T) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(dataDirectory, filename), JSON.stringify(value, null, 2), 'utf8');
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
